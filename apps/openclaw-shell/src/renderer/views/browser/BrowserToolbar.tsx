import React, { useState, useRef, useEffect } from 'react';
import { useBrowserStore } from '../../stores/browser-store';
import type { BrowserTab } from '@openclaw/core';

interface BrowserToolbarProps {
  tabId: string | null;
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '5px',
        border: 'none',
        background: 'transparent',
        color: disabled ? 'var(--faint)' : 'var(--text-2)',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: '14px',
        fontFamily: 'inherit',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = 'var(--border)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

export function BrowserToolbar({ tabId }: BrowserToolbarProps) {
  const tab = useBrowserStore((s) => s.tabs.find((t) => t.id === tabId));
  const goBack = useBrowserStore((s) => s.goBack);
  const goForward = useBrowserStore((s) => s.goForward);
  const navigateTab = useBrowserStore((s) => s.navigateTab);

  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingUrl && inputRef.current) {
      inputRef.current.select();
    }
  }, [editingUrl]);

  if (!tabId || !tab) {
    return (
      <div
        style={{
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-mid)',
          gap: '6px',
          flexShrink: 0,
        }}
      />
    );
  }

  const handleNavigate = (url: string) => {
    const normalized = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    navigateTab(tabId, normalized);
    setEditingUrl(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNavigate(urlInput);
    } else if (e.key === 'Escape') {
      setEditingUrl(false);
    }
  };

  return (
    <div
      style={{
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-mid)',
        gap: '4px',
        flexShrink: 0,
      }}
    >
      {/* Back */}
      <NavButton label="Back" onClick={() => goBack(tabId)}>
        ‹
      </NavButton>

      {/* Forward */}
      <NavButton label="Forward" onClick={() => goForward(tabId)}>
        ›
      </NavButton>

      {/* Reload / Stop */}
      <NavButton
        label={tab.state === 'loading' ? 'Stop' : 'Reload'}
        onClick={() => {
          // Reload signal — the webview layer handles it via IPC
          window.dispatchEvent(new CustomEvent('browser:reload', { detail: { tabId } }));
        }}
      >
        {tab.state === 'loading' ? '✕' : '↻'}
      </NavButton>

      {/* URL bar */}
      {editingUrl ? (
        <input
          ref={inputRef}
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setEditingUrl(false)}
          style={{
            flex: 1,
            height: '28px',
            borderRadius: '5px',
            border: '1px solid var(--accent)',
            background: 'var(--bg-card)',
            color: 'var(--text)',
            fontSize: '12px',
            padding: '0 10px',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <div
          onClick={() => {
            setUrlInput(tab.url);
            setEditingUrl(true);
          }}
          style={{
            flex: 1,
            height: '28px',
            borderRadius: '5px',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text-2)',
            fontSize: '12px',
            padding: '0 10px',
            cursor: 'text',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.url}
          </span>
        </div>
      )}

      {/* Agent overlay indicator */}
      {tab.agentId && (
        <div
          title={`Agent: ${tab.agentId}`}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--accent)',
            flexShrink: 0,
          }}
        />
      )}
    </div>
  );
}
