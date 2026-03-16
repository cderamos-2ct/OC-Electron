import React, { useEffect, useRef, useState } from 'react';
import { useViewStore, ViewId } from '../../stores/view-store';
import {
  HomeView,
  TasksView,
  DraftReviewView,
  AgentsView,
  CommsView,
  CalendarView,
  GitHubView,
  BrowserView,
  VaultView,
} from '../../views';

function renderView(view: ViewId): React.ReactNode {
  switch (view) {
    case 'home':         return <HomeView />;
    case 'tasks':        return <TasksView />;
    case 'draft-review': return <DraftReviewView />;
    case 'agents':       return <AgentsView />;
    case 'comms':        return <CommsView />;
    case 'calendar':     return <CalendarView />;
    case 'github':       return <GitHubView />;
    case 'browser':      return <BrowserView />;
    case 'vault':        return <VaultView />;
  }
}

export function ViewContainer() {
  const activeView = useViewStore((s) => s.activeView);
  const [displayedView, setDisplayedView] = useState<ViewId>(activeView);
  const [animating, setAnimating] = useState(false);
  const prevView = useRef<ViewId>(activeView);

  useEffect(() => {
    if (activeView === prevView.current) return;
    prevView.current = activeView;
    setAnimating(false);
    // Trigger fade-in on next frame
    requestAnimationFrame(() => {
      setDisplayedView(activeView);
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 150);
      return () => clearTimeout(t);
    });
  }, [activeView]);

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        key={displayedView}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: animating ? 1 : 1,
          transform: 'translateY(0)',
          animation: 'viewIn 0.15s ease forwards',
          overflow: 'hidden',
        }}
      >
        {renderView(displayedView)}
      </div>

      <style>{`
        @keyframes viewIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
