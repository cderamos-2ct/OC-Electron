import { useEffect, useRef } from 'react';
import type { MobileGatewayClient } from '../lib/mobile-gateway';

export interface FeedEntry {
  id: string;
  agentId: string;
  action: string;
  ts: number;
}

interface AgentFeedProps {
  gateway: MobileGatewayClient;
  entries: FeedEntry[];
}

export function AgentFeed({ entries }: AgentFeedProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [entries]);

  return (
    <div ref={listRef} style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
      {entries.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#52525b', padding: '48px 0', fontSize: '15px' }}>
          No agent activity yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {entries.map((entry) => (
            <FeedCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedCard({ entry }: { entry: FeedEntry }) {
  const time = new Date(entry.ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div style={{
      background: '#27272a',
      borderRadius: '12px',
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
    }}>
      {/* Agent dot */}
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#2563eb',
        marginTop: '5px',
        flexShrink: 0,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#a1a1aa' }}>
            {entry.agentId}
          </span>
          <span style={{ fontSize: '11px', color: '#52525b', marginLeft: 'auto' }}>
            {time}
          </span>
        </div>
        <div style={{ fontSize: '14px', color: '#d4d4d8', lineHeight: 1.4 }}>
          {entry.action}
        </div>
      </div>
    </div>
  );
}
