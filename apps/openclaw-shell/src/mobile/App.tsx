import { useState, useEffect, useReducer, useCallback, useRef } from 'react';
import { MobileGatewayClient } from './lib/mobile-gateway';
import { getPendingCount } from './lib/offline-queue';
import { getPermission, showNotification } from './lib/notifications';
import { usePushNotifications } from './lib/use-push-notifications';
import { NotificationBanner } from './components/NotificationBanner';
import type { FeedEntry } from './components/AgentFeed';
import type { TaskDocument, QuickDecision, GatewayConnectionState } from '../shared/types';
import type { ViewId } from '../shared/types';
import { MobileNav } from './MobileNav';
import {
  MobileHomeView,
  MobileTasksView,
  MobileCommsView,
  MobileCalendarView,
  MobileAgentsView,
  MobileDraftReviewView,
  MobileGitHubView,
  MobileBrowserView,
  MobileVaultView,
} from './views';
import './styles/responsive.css';

// ─── State ───────────────────────────────────────────────────────────────────

interface AppState {
  tasks: TaskDocument[];
  handledCount: number;
  feedEntries: FeedEntry[];
}

type AppAction =
  | { type: 'set_tasks'; tasks: TaskDocument[] }
  | { type: 'task_decision'; taskId: string; decision: QuickDecision }
  | { type: 'approve_all_safe' }
  | { type: 'add_feed'; entry: FeedEntry };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'set_tasks':
      return { ...state, tasks: action.tasks };
    case 'task_decision': {
      const task = state.tasks.find((t) => t.id === action.taskId);
      if (!task) return state;
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.taskId),
        handledCount: state.handledCount + 1,
        feedEntries: [
          ...state.feedEntries,
          {
            id: crypto.randomUUID(),
            agentId: 'you',
            action: `${action.decision} \u2192 ${task.title}`,
            ts: Date.now(),
          },
        ],
      };
    }
    case 'approve_all_safe': {
      const safe = state.tasks.filter(
        (t) => t.priority.toLowerCase() === 'low' || t.priority.toLowerCase() === 'medium'
      );
      const entries: FeedEntry[] = safe.map((t) => ({
        id: crypto.randomUUID(),
        agentId: 'you',
        action: `approve \u2192 ${t.title}`,
        ts: Date.now(),
      }));
      return {
        ...state,
        tasks: state.tasks.filter(
          (t) => t.priority.toLowerCase() !== 'low' && t.priority.toLowerCase() !== 'medium'
        ),
        handledCount: state.handledCount + safe.length,
        feedEntries: [...state.feedEntries, ...entries],
      };
    }
    case 'add_feed':
      return { ...state, feedEntries: [...state.feedEntries, action.entry] };
    default:
      return state;
  }
}

// ─── View navigation ──────────────────────────────────────────────────────────

function useViewNav(initial: ViewId = 'home') {
  const [activeView, setActiveViewState] = useState<ViewId>(initial);
  const [history, setHistory] = useState<ViewId[]>([]);

  const setActiveView = useCallback((view: ViewId) => {
    setActiveViewState((prev) => {
      if (view !== prev) {
        setHistory((h) => [...h, prev].slice(-20));
      }
      return view;
    });
  }, []);

  const goBack = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setActiveViewState(prev);
      return h.slice(0, -1);
    });
  }, []);

  return { activeView, setActiveView, goBack };
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const { activeView, setActiveView, goBack } = useViewNav('home');
  const [connState, setConnState] = useState<GatewayConnectionState>('disconnected');
  const [state, dispatch] = useReducer(appReducer, {
    tasks: [],
    handledCount: 0,
    feedEntries: [],
  });

  // Use stable refs so the gateway callbacks don't need to be recreated
  const setConnStateRef = useRef(setConnState);
  const dispatchRef = useRef(dispatch);

  const gatewayRef = useRef<MobileGatewayClient | null>(null);

  if (!gatewayRef.current) {
    gatewayRef.current = new MobileGatewayClient({
      onStateChange: (s) => setConnStateRef.current(s),
      onEvent: (evt) => {
        if (evt.event === 'agent') {
          const payload = evt.payload as { agentId?: string; action?: string } | undefined;
          if (payload?.agentId && payload?.action) {
            dispatchRef.current({
              type: 'add_feed',
              entry: {
                id: crypto.randomUUID(),
                agentId: payload.agentId,
                action: payload.action,
                ts: Date.now(),
              },
            });
          }
        }
      },
    });
  }

  const gateway = gatewayRef.current;

  useEffect(() => {
    gateway.connect();
    return () => gateway.disconnect();
  }, [gateway]);

  // Push notification support — delegates permission lifecycle and SW message relay
  // to the usePushNotifications hook. The onMessage callback flushes queued
  // tasks when the SW signals FLUSH_ACTION_QUEUE (e.g. back-online event).
  const handleSwMessage = useCallback(
    (data: unknown) => {
      const msg = data as { type?: string } | null;
      if (msg?.type === 'FLUSH_ACTION_QUEUE') {
        gateway.request('tasks.list', {}).catch(() => {});
      }
    },
    [gateway]
  );

  const { permission: pushPermission, requestPermission: requestPushPermission } =
    usePushNotifications(handleSwMessage);

  // Keep the legacy getPermission sentinel in sync for NotificationBanner's callback
  void getPermission; // consumed indirectly via usePushNotifications initial state

  // Show local notification when high-priority tasks arrive while app is open
  useEffect(() => {
    const highCount = state.tasks.filter(
      (t) => t.priority.toLowerCase() === 'high' || t.priority.toLowerCase() === 'critical'
    ).length;
    if (highCount > 0 && pushPermission === 'granted') {
      showNotification(
        'Aegilume',
        `${highCount} high-priority task${highCount > 1 ? 's' : ''} need your review`,
        { tag: 'openclaw-tasks', category: 'task_approvals' }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tasks.length]);

  const handleDecision = useCallback(
    (taskId: string, decision: QuickDecision) => {
      dispatch({ type: 'task_decision', taskId, decision });
      if (gateway.isConnected) {
        gateway
          .request('task.quick-decision', { taskId, decision })
          .catch((err) => console.warn('[mobile] decision RPC failed:', err));
      }
    },
    [gateway]
  );

  const handleApproveAllSafe = useCallback(() => {
    dispatch({ type: 'approve_all_safe' });
  }, []);

  const pendingTasks = state.tasks.filter(
    (t) => t.status === 'pending' || t.status === 'review'
  );

  function renderView() {
    switch (activeView) {
      case 'home':
        return <MobileHomeView />;
      case 'tasks':
        return (
          <MobileTasksView
            tasks={pendingTasks}
            handledCount={state.handledCount}
            onDecision={handleDecision}
            onApproveAllSafe={handleApproveAllSafe}
          />
        );
      case 'comms':
        return <MobileCommsView />;
      case 'calendar':
        return <MobileCalendarView />;
      case 'agents':
        return (
          <MobileAgentsView
            gateway={gateway}
            feedEntries={state.feedEntries}
            onBack={goBack}
          />
        );
      case 'draft-review':
        return <MobileDraftReviewView onBack={goBack} />;
      case 'github':
        return <MobileGitHubView onBack={goBack} />;
      case 'browser':
        return <MobileBrowserView onBack={goBack} />;
      case 'vault':
        return <MobileVaultView onBack={goBack} />;
      default:
        return <MobileHomeView />;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)', overflow: 'hidden' }}>
      <StatusBar state={connState} />
      <NotificationBanner
        permission={pushPermission}
        gateway={gateway}
        onPermissionGranted={requestPushPermission}
      />
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {renderView()}
      </div>
      <MobileNav
        activeView={activeView}
        onSelect={setActiveView}
        badges={{ tasks: pendingTasks.length > 0 ? pendingTasks.length : undefined }}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBar({ state }: { state: GatewayConnectionState }) {
  const [queueCount, setQueueCount] = useState(0);

  // Poll queue count when offline so the indicator stays fresh
  useEffect(() => {
    if (state === 'connected') {
      setQueueCount(0);
      return;
    }
    setQueueCount(getPendingCount());
    const id = setInterval(() => setQueueCount(getPendingCount()), 2000);
    return () => clearInterval(id);
  }, [state]);

  if (state === 'connected') return null;

  const colors: Record<GatewayConnectionState, string> = {
    connected: '#22c55e',
    connecting: '#eab308',
    authenticating: '#eab308',
    disconnected: '#71717a',
    error: '#ef4444',
  };
  const labels: Record<GatewayConnectionState, string> = {
    connected: 'Connected',
    connecting: 'Connecting...',
    authenticating: 'Authenticating...',
    disconnected: 'Disconnected',
    error: 'Connection error',
  };

  return (
    <div style={{
      background: '#27272a',
      padding: '6px 16px',
      paddingTop: 'max(6px, env(safe-area-inset-top))',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '12px',
      color: colors[state],
    }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors[state] }} />
      {labels[state]}
      {queueCount > 0 && (
        <span style={{ marginLeft: 'auto', color: '#a1a1aa' }}>
          {queueCount} action{queueCount !== 1 ? 's' : ''} queued
        </span>
      )}
    </div>
  );
}

