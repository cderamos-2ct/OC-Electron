import React from 'react';

export interface ViewContainerProps {
  children: React.ReactNode;
  active?: boolean;
  style?: React.CSSProperties;
}

export function ViewContainer({ children, active = true, style }: ViewContainerProps) {
  if (!active) return null;
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        animation: 'viewIn 0.15s ease-out',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface MainContentProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function MainContent({ children, style }: MainContentProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
