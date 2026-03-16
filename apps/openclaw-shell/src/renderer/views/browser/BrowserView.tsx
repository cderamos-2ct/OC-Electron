import React from 'react';

const V = {
  bg: '#0f172a',
  bgMid: '#131d33',
  bgCard: '#131d33',
  border: 'rgba(241,245,249,0.14)',
  border2: 'rgba(241,245,249,0.08)',
  text: '#f1f5f9',
  text2: '#cbd5e1',
  muted: '#94a3b8',
  accent: '#a3862a',
  accentBg: 'rgba(163,134,42,0.2)',
  green: '#2ecc71',
  yellow: '#e0c875',
  red: '#e74c3c',
};

export function BrowserView() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: V.bg,
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: V.text,
      }}
    >
      {/* ── BROWSER CHROME ────────────────────────────────────────────────── */}
      <div
        style={{
          background: V.bgMid,
          borderBottom: `1px solid ${V.border}`,
          flexShrink: 0,
        }}
      >
        {/* Top row: nav buttons + URL bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
          }}
        >
          {/* Back */}
          <button
            style={{
              background: 'none',
              border: 'none',
              color: V.text2,
              fontSize: 16,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 6,
              lineHeight: 1,
            }}
          >
            ←
          </button>
          {/* Forward */}
          <button
            style={{
              background: 'none',
              border: 'none',
              color: V.muted,
              fontSize: 16,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 6,
              lineHeight: 1,
            }}
          >
            →
          </button>
          {/* Reload */}
          <button
            style={{
              background: 'none',
              border: 'none',
              color: V.text2,
              fontSize: 16,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 6,
              lineHeight: 1,
            }}
          >
            ↻
          </button>

          {/* URL bar */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(241,245,249,0.06)',
              border: `1px solid ${V.border}`,
              borderRadius: 8,
              padding: '6px 12px',
            }}
          >
            {/* Lock icon */}
            <span style={{ color: V.green, fontSize: 12 }}>🔒</span>
            <span style={{ color: V.text2, fontSize: 13, flex: 1 }}>
              https://producthunt.com
            </span>
            {/* Bookmark star */}
            <button
              style={{
                background: 'none',
                border: 'none',
                color: V.muted,
                fontSize: 14,
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
              }}
            >
              ☆
            </button>
          </div>
        </div>

        {/* Bookmarks bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '0 12px 8px',
            borderTop: `1px solid ${V.border2}`,
            paddingTop: 6,
          }}
        >
          {[
            { icon: '🏠', label: 'Home' },
            { icon: '📈', label: 'Trending' },
            { icon: '🔥', label: 'Launches' },
            { icon: '🏆', label: 'Collections' },
            { icon: '💬', label: 'Discussions' },
            { icon: '📞', label: 'Newsletter' },
          ].map((bm) => (
            <button
              key={bm.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'none',
                border: 'none',
                color: V.text2,
                fontSize: 12,
                cursor: 'pointer',
                padding: '4px 10px',
                borderRadius: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <span>{bm.icon}</span>
              <span>{bm.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── BROWSER BODY ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LEFT: Page area */}
        <div
          style={{
            flex: 1,
            background: '#ffffff',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* PH top bar */}
          <div
            style={{
              background: '#ffffff',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '12px 24px',
              flexShrink: 0,
            }}
          >
            {/* Logo */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
                fontSize: 15,
                color: '#da552f',
              }}
            >
              <span style={{ fontSize: 20 }}>🐇</span>
              <span>Product Hunt</span>
            </div>

            {/* Search */}
            <div
              style={{
                flex: 1,
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '8px 14px',
                color: '#9ca3af',
                fontSize: 13,
              }}
            >
              Search products, makers, collections...
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={{
                  background: 'none',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '7px 16px',
                  fontSize: 13,
                  color: '#374151',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Sign in
              </button>
              <button
                style={{
                  background: '#da552f',
                  border: 'none',
                  borderRadius: 8,
                  padding: '7px 16px',
                  fontSize: 13,
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Submit
              </button>
            </div>
          </div>

          {/* Feed header */}
          <div
            style={{
              padding: '20px 24px 12px',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: '#111827',
              }}
            >
              Top Products — Today
            </h2>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              March 15, 2026
            </span>
          </div>

          {/* Product rows */}
          <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* Row 1: Gemini Ultra 3.0 */}
            <ProductRow
              rank={1}
              iconBg="linear-gradient(135deg, #4285f4, #34a853)"
              iconChar="G"
              name="Gemini Ultra 3.0"
              maker="Google DeepMind"
              tagline="The most capable AI model ever"
              tags={['AI', 'Productivity', 'Dev Tools']}
              votes={1204}
              voted={false}
              trending={false}
            />

            {/* Row 2: Aegilume — TRENDING */}
            <ProductRow
              rank={2}
              iconBg={`linear-gradient(135deg, ${V.accent}, #c8a84b)`}
              iconChar="A"
              name="Aegilume"
              maker="Christian De Ramos"
              tagline="AI agents that actually run your business"
              tags={['AI Agents', 'Automation', 'Operations']}
              votes={847}
              voted={true}
              trending={true}
            />

            {/* Row 3: Linear AI Copilot */}
            <ProductRow
              rank={3}
              iconBg="linear-gradient(135deg, #5e6ad2, #8b91e3)"
              iconChar="L"
              name="Linear AI Copilot"
              maker="Linear"
              tagline="Your AI teammate for planning"
              tags={['PM', 'AI']}
              votes={632}
              voted={false}
              trending={false}
            />

            {/* Row 4: v0 3.0 */}
            <ProductRow
              rank={4}
              iconBg="linear-gradient(135deg, #000000, #333333)"
              iconChar="v"
              name="v0 3.0"
              maker="Vercel"
              tagline="Ship full-stack apps from a single prompt"
              tags={['Dev Tools', 'No-Code']}
              votes={511}
              voted={false}
              trending={false}
            />
          </div>
        </div>

        {/* RIGHT: CD Agent rail */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            background: V.bgMid,
            borderLeft: `1px solid ${V.border}`,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          {/* Rail header */}
          <div
            style={{
              padding: '16px',
              borderBottom: `1px solid ${V.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <CDAvatar size={32} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: V.text }}>
                CD · Browser Assistant
              </div>
              <div style={{ fontSize: 11, color: V.muted }}>
                Context-aware for this page
              </div>
            </div>
          </div>

          {/* Rail body */}
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Context bubble */}
            <div
              style={{
                background: 'rgba(241,245,249,0.05)',
                border: `1px solid ${V.border}`,
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 12,
                color: V.text2,
                lineHeight: 1.6,
              }}
            >
              You're browsing Product Hunt. I notice Aegilume is trending at #2 today with 847 upvotes
            </div>

            {/* Highlight */}
            <div
              style={{
                background: V.accentBg,
                border: `1px solid rgba(163,134,42,0.35)`,
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 12,
                color: V.yellow,
                fontWeight: 500,
              }}
            >
              🔥 Aegilume is in the top 3 for 6 hours straight
            </div>

            {/* Quick Actions */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: V.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 8,
                }}
              >
                Quick Actions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { icon: '📣', label: 'Share to Slack' },
                  { icon: '🐦', label: 'Draft tweet' },
                  { icon: '🔖', label: 'Save bookmark' },
                ].map((action) => (
                  <button
                    key={action.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'none',
                      border: `1px solid ${V.border2}`,
                      borderRadius: 8,
                      padding: '9px 12px',
                      color: V.text2,
                      fontSize: 13,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{action.icon}</span>
                      <span>{action.label}</span>
                    </span>
                    <span style={{ color: V.muted, fontSize: 12 }}>→</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Page Stats */}
            <div
              style={{
                background: 'rgba(241,245,249,0.04)',
                border: `1px solid ${V.border2}`,
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: V.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 10,
                }}
              >
                Page Stats
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <StatRow label="Products today" value="28" />
                <StatRow label="Aegilume rank" value="#2 🔥" accent />
                <StatRow label="Total upvotes" value="847" />
                <StatRow label="Comments" value="43" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── AGENT TOOLBAR (bottom) ─────────────────────────────────────────── */}
      <div
        style={{
          background: V.bgMid,
          borderTop: `1px solid ${V.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          flexShrink: 0,
        }}
      >
        {/* Left: identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CDAvatar size={28} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: V.text }}>
              CD · Browser Assistant
            </div>
            <div style={{ fontSize: 11, color: V.muted }}>
              Browsing Product Hunt · No blocked trackers · Secure connection
            </div>
          </div>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { icon: '🔖', label: 'Bookmark' },
            { icon: '📤', label: 'Share' },
            { icon: '📱', label: 'Save as App' },
          ].map((btn) => (
            <button
              key={btn.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(241,245,249,0.06)',
                border: `1px solid ${V.border}`,
                borderRadius: 7,
                padding: '6px 12px',
                color: V.text2,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <span>{btn.icon}</span>
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components (inline) ────────────────────────────────────────────────

interface ProductRowProps {
  rank: number;
  iconBg: string;
  iconChar: string;
  name: string;
  maker: string;
  tagline: string;
  tags: string[];
  votes: number;
  voted: boolean;
  trending: boolean;
}

function ProductRow({
  rank,
  iconBg,
  iconChar,
  name,
  maker,
  tagline,
  tags,
  votes,
  voted,
  trending,
}: ProductRowProps) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 0',
        borderBottom: '1px solid #f3f4f6',
      }}
    >
      {/* Trending badge */}
      {trending && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 70,
            background: 'rgba(163,134,42,0.15)',
            border: '1px solid rgba(163,134,42,0.4)',
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 11,
            color: '#a3862a',
            fontWeight: 600,
          }}
        >
          🔥 Trending
        </div>
      )}

      {/* Rank */}
      <div
        style={{
          width: 24,
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 600,
          color: '#9ca3af',
          flexShrink: 0,
        }}
      >
        {rank}
      </div>

      {/* Product icon */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 10,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          color: '#ffffff',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {iconChar}
      </div>

      {/* Product info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            marginBottom: 3,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#111827',
            }}
          >
            {name}
          </span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>by {maker}</span>
        </div>
        <div style={{ fontSize: 13, color: '#374151', marginBottom: 7 }}>
          {tagline}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 11,
                color: '#6b7280',
                border: '1px solid #e5e7eb',
                borderRadius: 5,
                padding: '2px 7px',
                background: '#f9fafb',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Upvote button */}
      <button
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          background: voted ? 'rgba(163,134,42,0.1)' : '#f9fafb',
          border: `1px solid ${voted ? 'rgba(163,134,42,0.5)' : '#e5e7eb'}`,
          borderRadius: 8,
          padding: '8px 14px',
          cursor: 'pointer',
          flexShrink: 0,
          minWidth: 56,
        }}
      >
        <span
          style={{
            fontSize: 14,
            color: voted ? '#a3862a' : '#6b7280',
            lineHeight: 1,
          }}
        >
          ▲
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: voted ? '#a3862a' : '#374151',
          }}
        >
          {votes.toLocaleString()}
        </span>
      </button>
    </div>
  );
}

function CDAvatar({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #a3862a, #c8a84b)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        color: '#ffffff',
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      CD
    </div>
  );
}

interface StatRowProps {
  label: string;
  value: string;
  accent?: boolean;
}

function StatRow({ label, value, accent }: StatRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
      }}
    >
      <span style={{ color: V.muted }}>{label}</span>
      <span
        style={{
          color: accent ? V.yellow : V.text2,
          fontWeight: accent ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}
