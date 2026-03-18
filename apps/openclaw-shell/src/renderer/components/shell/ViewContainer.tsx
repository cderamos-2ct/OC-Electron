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
import { ViewErrorBoundary } from '../errors/ViewErrorBoundary';

function renderView(view: ViewId): React.ReactNode {
  switch (view) {
    case 'home':         return <ViewErrorBoundary viewId="home"><HomeView /></ViewErrorBoundary>;
    case 'tasks':        return <ViewErrorBoundary viewId="tasks"><TasksView /></ViewErrorBoundary>;
    case 'draft-review': return <ViewErrorBoundary viewId="draft-review"><DraftReviewView /></ViewErrorBoundary>;
    case 'agents':       return <ViewErrorBoundary viewId="agents"><AgentsView /></ViewErrorBoundary>;
    case 'comms':        return <ViewErrorBoundary viewId="comms"><CommsView /></ViewErrorBoundary>;
    case 'calendar':     return <ViewErrorBoundary viewId="calendar"><CalendarView /></ViewErrorBoundary>;
    case 'github':       return <ViewErrorBoundary viewId="github"><GitHubView /></ViewErrorBoundary>;
    case 'browser':      return <ViewErrorBoundary viewId="browser"><BrowserView /></ViewErrorBoundary>;
    case 'vault':        return <ViewErrorBoundary viewId="vault"><VaultView /></ViewErrorBoundary>;
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
