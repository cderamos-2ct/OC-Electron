import type { ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MobileViewShellProps {
  /** Page title shown in the header */
  title: string;
  /** Optional right-side action(s) for the header */
  headerRight?: ReactNode;
  /** Whether to show a back button — pass a handler to enable it */
  onBack?: () => void;
  /** The view content */
  children: ReactNode;
  /** Extra class on the scroll container */
  contentClassName?: string;
}

// ─── MobileViewShell ─────────────────────────────────────────────────────────

export function MobileViewShell({
  title,
  headerRight,
  onBack,
  children,
  contentClassName = '',
}: MobileViewShellProps) {
  return (
    <div className="mobile-view-shell">
      {/* Header bar */}
      <header className="mobile-header">
        {onBack && (
          <button
            className="btn-icon"
            onClick={onBack}
            aria-label="Go back"
            style={{ marginLeft: -4 }}
          >
            ‹
          </button>
        )}

        <span
          style={{
            flex: 1,
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>

        {headerRight && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {headerRight}
          </div>
        )}
      </header>

      {/* Scrollable content area */}
      <main
        className={`mobile-view-shell__content scrollbar-hide ${contentClassName}`}
        id="mobile-view-content"
      >
        {children}
      </main>
    </div>
  );
}
