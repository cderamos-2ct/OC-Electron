import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message ?? 'Unknown error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console in dev; in production avoid exposing raw stack traces
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          gap: '16px',
          zIndex: 99999,
        }}
      >
        <div
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: '18px',
            color: 'var(--accent)',
            letterSpacing: '2px',
            marginBottom: '8px',
          }}
        >
          AE
        </div>
        <p
          style={{
            color: 'var(--text-3)',
            fontSize: '14px',
            margin: 0,
          }}
        >
          Something went wrong.
        </p>
        <button
          onClick={this.handleReload}
          style={{
            marginTop: '8px',
            padding: '8px 20px',
            background: 'var(--accent)',
            color: 'var(--bg)',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            fontWeight: 600,
            letterSpacing: '0.5px',
          }}
        >
          Reload App
        </button>
      </div>
    );
  }
}
