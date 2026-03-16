import React from 'react';

export interface ShellLayoutProps {
  titleBar?: React.ReactNode;
  tabBar?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function ShellLayout({ titleBar, tabBar, children, style }: ShellLayoutProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        overflow: 'hidden',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
        ...style,
      }}
    >
      {titleBar}
      {tabBar}
      <div
        style={{
          display: 'flex',
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}
