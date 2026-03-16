import React, { Suspense } from 'react';
import type { NativeViewId } from './NavRail';
import {
  HomeView,
  TasksView,
  CommsView,
  AgentsView,
  DraftReviewView,
  CalendarView,
  GitHubView,
  BrowserView,
  VaultView,
} from '../../views';

interface ViewRouterProps {
  activeView: NativeViewId;
}

function ViewFallback() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#444460',
      fontSize: 13,
    }}>
      Loading…
    </div>
  );
}

export function ViewRouter({ activeView }: ViewRouterProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      <Suspense fallback={<ViewFallback />}>
        {/* Mount all views, only show active — preserves state across nav */}
        <ViewPane id="home" activeView={activeView}><HomeView /></ViewPane>
        <ViewPane id="tasks" activeView={activeView}><TasksView /></ViewPane>
        <ViewPane id="comms" activeView={activeView}><CommsView /></ViewPane>
        <ViewPane id="calendar" activeView={activeView}><CalendarView /></ViewPane>
        <ViewPane id="github" activeView={activeView}><GitHubView /></ViewPane>
        <ViewPane id="agents" activeView={activeView}><AgentsView /></ViewPane>
        <ViewPane id="draft-review" activeView={activeView}><DraftReviewView /></ViewPane>
        <ViewPane id="browser" activeView={activeView}><BrowserView /></ViewPane>
        <ViewPane id="vault" activeView={activeView}><VaultView /></ViewPane>
      </Suspense>
    </div>
  );
}

interface ViewPaneProps {
  id: NativeViewId;
  activeView: NativeViewId;
  children: React.ReactNode;
}

function ViewPane({ id, activeView, children }: ViewPaneProps) {
  const isActive = id === activeView;
  return (
    <div
      style={{
        display: isActive ? 'flex' : 'none',
        flex: 1,
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}
