import React, { useState } from 'react';
import { useBrowserStore } from '../../stores/browser-store';
import type { AddAppConfig } from '@openclaw/core';

interface AddAppModalProps {
  onClose: () => void;
}

const SUGGESTED_APPS: AddAppConfig[] = [
  { name: 'Linear', url: 'https://linear.app', description: 'Issue tracker' },
  { name: 'GitHub', url: 'https://github.com', description: 'Code hosting' },
  { name: 'Notion', url: 'https://notion.so', description: 'Notes & docs' },
  { name: 'Figma', url: 'https://figma.com', description: 'Design tool' },
  { name: 'Slack', url: 'https://app.slack.com', description: 'Team chat' },
  { name: 'Vercel', url: 'https://vercel.com', description: 'Deploy platform' },
];

export function AddAppModal({ onClose }: AddAppModalProps) {
  const addPinnedApp = useBrowserStore((s) => s.addPinnedApp);
  const pinnedApps = useBrowserStore((s) => s.pinnedApps);

  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'browse' | 'custom'>('browse');

  const isPinned = (url: string) => pinnedApps.some((a) => a.url === url);

  const handlePinSuggested = (app: AddAppConfig) => {
    addPinnedApp(app);
    onClose();
  };

  const handleAddCustom = () => {
    if (!customName.trim() || !customUrl.trim()) return;
    const normalized = customUrl.startsWith('http://') || customUrl.startsWith('https://')
      ? customUrl
      : `https://${customUrl}`;
    addPinnedApp({ name: customName.trim(), url: normalized });
    onClose();
  };

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '440px',
          maxHeight: '500px',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Add App</span>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '0 4px',
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px', gap: '0' }}>
          {(['browse', 'custom'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 16px',
                fontSize: '12px',
                border: 'none',
                background: 'transparent',
                color: activeTab === tab ? 'var(--text)' : 'var(--muted)',
                cursor: 'pointer',
                borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {activeTab === 'browse' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {SUGGESTED_APPS.map((app) => (
                <div
                  key={app.url}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'var(--bg-mid)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      flexShrink: 0,
                    }}
                  >
                    🌐
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>{app.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{app.description}</div>
                  </div>
                  <button
                    onClick={() => handlePinSuggested(app)}
                    disabled={isPinned(app.url)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: isPinned(app.url) ? 'var(--bg-mid)' : 'transparent',
                      color: isPinned(app.url) ? 'var(--faint)' : 'var(--text-2)',
                      cursor: isPinned(app.url) ? 'default' : 'pointer',
                      fontSize: '12px',
                      flexShrink: 0,
                      fontFamily: 'inherit',
                    }}
                  >
                    {isPinned(app.url) ? 'Pinned' : 'Pin'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--muted)' }}>Name</label>
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="My App"
                  style={{
                    height: '32px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-mid)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    padding: '0 10px',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--muted)' }}>URL</label>
                <input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com"
                  style={{
                    height: '32px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-mid)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    padding: '0 10px',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCustom();
                  }}
                />
              </div>
              <button
                onClick={handleAddCustom}
                disabled={!customName.trim() || !customUrl.trim()}
                style={{
                  padding: '8px 16px',
                  borderRadius: '7px',
                  border: 'none',
                  background: customName.trim() && customUrl.trim() ? 'var(--accent)' : 'var(--bg-mid)',
                  color: customName.trim() && customUrl.trim() ? '#fff' : 'var(--faint)',
                  cursor: customName.trim() && customUrl.trim() ? 'pointer' : 'default',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  alignSelf: 'flex-end',
                }}
              >
                Add App
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
