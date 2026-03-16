import { useState } from "react";

const COLORS = {
  bg: "#0a0a0a",
  surface: "#141414",
  surfaceHover: "#1a1a1a",
  border: "#262626",
  borderAccent: "#404040",
  text: "#e5e5e5",
  textMuted: "#737373",
  textDim: "#525252",
  accent: "#22d3ee",
  accentDim: "#0891b2",
  green: "#4ade80",
  greenDim: "#16a34a",
  orange: "#fb923c",
  orangeDim: "#c2410c",
  red: "#f87171",
  purple: "#a78bfa",
  purpleDim: "#7c3aed",
};

// ─── Data ───────────────────────────────────────────────────────────
const approaches = [
  {
    name: "LevelDB Local Storage",
    feasibility: "HIGH",
    personalAcct: true,
    complexity: "Medium",
    realtime: "Poll-based",
    badge: "RECOMMENDED",
    badgeColor: COLORS.green,
    desc: "Teams stores its full IndexedDB in LevelDB format at ~/Library/Containers/com.microsoft.teams2/. Confirmed 22MB of chat data on your Mac including thread IDs, 1:1 and group conversations, meetings, and message content. No API registration or auth required.",
    pros: [
      "Full message history — not just notifications",
      "No API keys, no auth, no registration",
      "Works with personal accounts",
      "22MB of confirmed data already on your Mac",
      "Forensic tools exist (teams-decoder, dfindexeddb)",
    ],
    cons: [
      "Requires LevelDB + Snappy decompression parsing",
      "Data only available while Teams has been active",
      "Not true real-time — requires polling .ldb files",
      "Schema may change between Teams updates",
    ],
    path: "~/Library/Containers/com.microsoft.teams2/.../IndexedDB/https_teams.live.com_0.indexeddb.leveldb/",
  },
  {
    name: "Microsoft Graph API",
    feasibility: "MEDIUM",
    personalAcct: "Partial",
    complexity: "Medium",
    realtime: "Yes",
    badge: "1:1 CHATS ONLY",
    badgeColor: COLORS.orange,
    desc: "Graph API supports Chat.Read for personal accounts via OAuth delegated flow. However, Team/channel messages require work/school accounts. Your MSAL 1.34.0 + msgraph-sdk 1.55.0 are ready to go.",
    pros: [
      "Official API with structured JSON responses",
      "Real-time polling with delta queries",
      "MSAL + msgraph-sdk already installed",
      "Stable, versioned API with good docs",
    ],
    cons: [
      "Only 1:1 and group chats — no team channels",
      "Requires Azure app registration (was blocked before)",
      "Needs interactive consent flow first time",
      "Rate-limited by Microsoft",
    ],
    path: "GET /me/chats/{chat-id}/messages",
  },
  {
    name: "Browser Automation",
    feasibility: "MEDIUM",
    personalAcct: true,
    complexity: "Medium",
    realtime: "Possible",
    badge: null,
    badgeColor: null,
    desc: "Playwright or Selenium against teams.microsoft.com. Full access to everything you see in the UI, but resource-heavy and fragile against UI updates.",
    pros: [
      "Access to everything visible in the web UI",
      "Works with any account type",
      "Can interact with search, filters, etc.",
    ],
    cons: [
      "Resource-heavy (full browser process)",
      "Fragile — UI changes break selectors",
      "Session/auth management is complex",
      "Not suitable for always-on monitoring",
    ],
    path: "https://teams.microsoft.com",
  },
  {
    name: "Teams Bot / Webhook",
    feasibility: "LOW",
    personalAcct: false,
    complexity: "N/A",
    realtime: "N/A",
    badge: "NOT VIABLE",
    badgeColor: COLORS.red,
    desc: "Webhooks and bots only work in team channels (not personal chats) and require organizational admin setup. Not applicable for personal accounts.",
    pros: [],
    cons: [
      "Not supported for personal accounts",
      "Only works in team/channel context",
      "Requires Teams admin permissions",
    ],
    path: null,
  },
  {
    name: "Power Automate",
    feasibility: "LOW",
    personalAcct: "Partial",
    complexity: "Medium",
    realtime: "Limited",
    badge: null,
    badgeColor: null,
    desc: "Can trigger flows on some Teams events, but triggers for personal 1:1 chats are extremely limited. No way to read message history.",
    pros: ["GUI-based setup", "Can capture some new message events"],
    cons: [
      "No historical message access",
      "Limited personal chat triggers",
      "Requires subscription",
      "Can't read existing conversations",
    ],
    path: null,
  },
  {
    name: "Export API",
    feasibility: "LOW",
    personalAcct: "Unclear",
    complexity: "High",
    realtime: "No",
    badge: null,
    badgeColor: null,
    desc: "Enterprise-focused bulk export. Requires Teams admin role and application-level permissions. Not designed for continuous access.",
    pros: ["Complete data export when available"],
    cons: [
      "Enterprise/admin only",
      "One-time export, not continuous",
      "Personal account support unclear",
      "24-hour download window",
    ],
    path: null,
  },
];

const archLayers = [
  {
    label: "DATA SOURCES",
    color: COLORS.accent,
    items: [
      { name: "LevelDB Reader", detail: "Parse Teams IndexedDB, poll for changes every 5s", icon: "DB" },
      { name: "Notification Center", detail: "Current SQLite approach — real-time alerts", icon: "NC" },
      { name: "Graph API (optional)", detail: "1:1 chat polling via MSAL delegated auth", icon: "API" },
    ],
  },
  {
    label: "PROCESSING LAYER",
    color: COLORS.purple,
    items: [
      { name: "Message Deduplicator", detail: "Merge LevelDB + Notification sources, prevent duplicates", icon: "DD" },
      { name: "Thread Reconstructor", detail: "Rebuild conversation threads from flat message list", icon: "TR" },
      { name: "Priority Classifier", detail: "DM/@mention = HIGH, group = MED, reactions = LOW", icon: "PC" },
    ],
  },
  {
    label: "STORAGE",
    color: COLORS.green,
    items: [
      { name: "SQLite Cache", detail: "Local message DB with FTS5 full-text search", icon: "SQ" },
      { name: "State Manager", detail: "Track last-seen per thread, read/unread status", icon: "SM" },
      { name: "Contact Index", detail: "Map thread IDs → human names (Sandy, OPS Dev, etc.)", icon: "CI" },
    ],
  },
  {
    label: "OUTPUT CHANNELS",
    color: COLORS.orange,
    items: [
      { name: "Telegram Bot", detail: "Priority alerts, summaries, search via AntiGravity", icon: "TG" },
      { name: "Heartbeat Engine", detail: "Proactive monitoring every 5-min cycle", icon: "HB" },
      { name: "Dashboard API", detail: "REST/WebSocket for local web dashboard", icon: "WS" },
    ],
  },
];

const uiConcepts = [
  {
    id: "command-center",
    title: "Command Center",
    subtitle: "Unified inbox with AI triage",
    desc: "A dark-themed unified inbox that aggregates Teams, Gmail, iMessage, and Calendar into a single prioritized feed. The AI assistant triages everything and surfaces what needs your attention. Think of it as mission control for your digital life.",
    features: [
      "Priority-ranked message feed across all platforms",
      "AI-generated action items extracted from messages",
      "Thread grouping with conversation context",
      "Quick-reply via Telegram without opening apps",
      "Keyboard-driven navigation (vim-style)",
    ],
  },
  {
    id: "radar",
    title: "Radar View",
    subtitle: "Ambient awareness dashboard",
    desc: "A spatial dashboard where contacts and channels are positioned by urgency/recency. Items drift toward the center as they become more urgent. Designed to sit on a second monitor as an ambient awareness tool — glanceable, not interactive.",
    features: [
      "Orbital visualization — urgent items pull to center",
      "Color-coded rings: red (urgent), amber (today), green (low)",
      "Contact avatars with unread count badges",
      "Subtle animations show activity patterns",
      "Auto-dims when nothing needs attention",
    ],
  },
  {
    id: "timeline",
    title: "Timeline / Chronicle",
    subtitle: "Chronological activity stream",
    desc: "A vertical timeline that shows everything that happened across all your communication channels. Scroll through your day like reading a story. Perfect for catching up after meetings or reviewing what you missed overnight.",
    features: [
      "Vertical scrolling timeline with time markers",
      "Collapsible sections per channel/person",
      "AI-generated daily digest at the top",
      "Inline previews of files, links, images",
      "Filter by platform, person, or priority",
    ],
  },
];

// ─── Components ─────────────────────────────────────────────────────

function Badge({ text, color }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.05em",
        borderRadius: 4,
        color: COLORS.bg,
        backgroundColor: color,
      }}
    >
      {text}
    </span>
  );
}

function FeasibilityDot({ level }) {
  const c =
    level === "HIGH"
      ? COLORS.green
      : level === "MEDIUM"
      ? COLORS.orange
      : COLORS.red;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: c, fontWeight: 600 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} />
      {level}
    </span>
  );
}

function SectionTitle({ children }) {
  return (
    <h2
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: COLORS.textMuted,
        margin: "48px 0 20px",
        paddingBottom: 8,
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      {children}
    </h2>
  );
}

function ApproachCard({ data, isExpanded, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        background: COLORS.surface,
        border: `1px solid ${isExpanded ? COLORS.borderAccent : COLORS.border}`,
        borderRadius: 8,
        padding: "16px 20px",
        cursor: "pointer",
        transition: "border-color 0.2s",
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>{data.name}</span>
          {data.badge && <Badge text={data.badge} color={data.badgeColor} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <FeasibilityDot level={data.feasibility} />
          <span style={{ color: COLORS.textDim, fontSize: 18 }}>{isExpanded ? "−" : "+"}</span>
        </div>
      </div>
      {isExpanded && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: COLORS.textMuted, margin: "0 0 16px" }}>{data.desc}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Personal Acct</div>
              <div style={{ fontSize: 13, color: data.personalAcct === true ? COLORS.green : data.personalAcct === false ? COLORS.red : COLORS.orange }}>
                {data.personalAcct === true ? "Yes" : data.personalAcct === false ? "No" : data.personalAcct}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Complexity</div>
              <div style={{ fontSize: 13, color: COLORS.text }}>{data.complexity}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Real-time</div>
              <div style={{ fontSize: 13, color: COLORS.text }}>{data.realtime}</div>
            </div>
          </div>
          {data.pros.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: COLORS.greenDim, fontWeight: 600, marginBottom: 6 }}>ADVANTAGES</div>
              {data.pros.map((p, i) => (
                <div key={i} style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.7, paddingLeft: 12, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: COLORS.greenDim }}>+</span> {p}
                </div>
              ))}
            </div>
          )}
          {data.cons.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: COLORS.orangeDim, fontWeight: 600, marginBottom: 6 }}>LIMITATIONS</div>
              {data.cons.map((c, i) => (
                <div key={i} style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.7, paddingLeft: 12, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: COLORS.orangeDim }}>-</span> {c}
                </div>
              ))}
            </div>
          )}
          {data.path && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                background: COLORS.bg,
                borderRadius: 4,
                fontFamily: "monospace",
                fontSize: 11,
                color: COLORS.accent,
                overflowX: "auto",
              }}
            >
              {data.path}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArchDiagram() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {archLayers.map((layer, li) => (
        <div key={li}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: layer.color,
              marginBottom: 8,
              marginTop: li > 0 ? 16 : 0,
            }}
          >
            {layer.label}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {layer.items.map((item, ii) => (
              <div
                key={ii}
                style={{
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 6,
                  padding: "12px 14px",
                  borderLeft: `3px solid ${layer.color}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                      background: `${layer.color}15`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: layer.color,
                      fontFamily: "monospace",
                    }}
                  >
                    {item.icon}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{item.name}</span>
                </div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>{item.detail}</div>
              </div>
            ))}
          </div>
          {li < archLayers.length - 1 && (
            <div style={{ textAlign: "center", padding: "6px 0", color: COLORS.textDim, fontSize: 16 }}>↓</div>
          )}
        </div>
      ))}
    </div>
  );
}

function CommandCenterMockup() {
  const msgs = [
    { pri: "HIGH", src: "Teams", from: "Sandy", text: "Can you review the PrintDeed mockups before 3pm?", time: "11:42a", unread: true },
    { pri: "HIGH", src: "Gmail", from: "AWS Billing", text: "Your February invoice is ready — $247.83", time: "11:30a", unread: true },
    { pri: "MED", src: "Teams", from: "OPS Dev Team", text: "Rahul: deployed hotfix to staging, needs QA", time: "11:15a", unread: true },
    { pri: "MED", src: "Teams", from: "Designer KD-PD", text: "New color palette options uploaded to Figma", time: "10:50a", unread: false },
    { pri: "LOW", src: "iMessage", from: "Mom", text: "Don't forget dinner Sunday!", time: "10:22a", unread: false },
    { pri: "LOW", src: "Teams", from: "PrintDeed Dev Chat", text: "Build #412 passed all tests", time: "9:45a", unread: false },
  ];
  const priColor = { HIGH: COLORS.red, MED: COLORS.orange, LOW: COLORS.textDim };
  const srcColor = { Teams: COLORS.purple, Gmail: COLORS.red, iMessage: COLORS.green };

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
      {/* Title bar */}
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.accent }}>AG</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Command Center</span>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: COLORS.textDim }}>
          <span>3 urgent</span>
          <span>12 today</span>
          <span style={{ color: COLORS.green }}>AI: watching</span>
        </div>
      </div>
      {/* AI Summary */}
      <div style={{ padding: "10px 16px", background: `${COLORS.accent}08`, borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 600, marginBottom: 4 }}>AI BRIEFING — Feb 22, 11:45am</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6 }}>
          Sandy needs PrintDeed mockup review by 3pm (2 hrs). Rahul's staging hotfix needs QA sign-off. AWS bill is $47 over last month's baseline. 3 action items extracted.
        </div>
      </div>
      {/* Messages */}
      {msgs.map((m, i) => (
        <div
          key={i}
          style={{
            padding: "10px 16px",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "grid",
            gridTemplateColumns: "44px 60px 1fr 50px",
            alignItems: "center",
            gap: 8,
            background: m.unread ? `${COLORS.accent}04` : "transparent",
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: priColor[m.pri] }}>{m.pri}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: srcColor[m.src], padding: "2px 6px", background: `${srcColor[m.src]}15`, borderRadius: 3, textAlign: "center" }}>{m.src}</span>
          <div>
            <span style={{ fontSize: 12, fontWeight: m.unread ? 600 : 400, color: m.unread ? COLORS.text : COLORS.textMuted }}>{m.from}: </span>
            <span style={{ fontSize: 12, color: m.unread ? COLORS.textMuted : COLORS.textDim }}>{m.text}</span>
          </div>
          <span style={{ fontSize: 11, color: COLORS.textDim, textAlign: "right" }}>{m.time}</span>
        </div>
      ))}
    </div>
  );
}

function RadarMockup() {
  const contacts = [
    { name: "Sandy", angle: 30, dist: 0.2, unread: 3, urgent: true },
    { name: "Rahul", angle: 120, dist: 0.35, unread: 1, urgent: true },
    { name: "AWS", angle: 200, dist: 0.5, unread: 1, urgent: false },
    { name: "KD-PD", angle: 280, dist: 0.55, unread: 0, urgent: false },
    { name: "Mom", angle: 340, dist: 0.7, unread: 1, urgent: false },
    { name: "OPS Dev", angle: 80, dist: 0.4, unread: 2, urgent: false },
    { name: "PrintDeed", angle: 160, dist: 0.6, unread: 0, urgent: false },
  ];

  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 30;

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Radar View</div>
      <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 16 }}>Closer to center = more urgent</div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Rings */}
        {[0.33, 0.66, 1].map((r, i) => (
          <circle key={i} cx={cx} cy={cy} r={maxR * r} fill="none" stroke={COLORS.border} strokeWidth={1} strokeDasharray={i === 0 ? "none" : "4 4"} />
        ))}
        {/* Ring labels */}
        <text x={cx + 4} y={cy - maxR * 0.33 + 4} fill={COLORS.red} fontSize={9} fontWeight="600" opacity={0.5}>urgent</text>
        <text x={cx + 4} y={cy - maxR * 0.66 + 4} fill={COLORS.orange} fontSize={9} fontWeight="600" opacity={0.5}>today</text>
        <text x={cx + 4} y={cy - maxR + 4} fill={COLORS.textDim} fontSize={9} fontWeight="600" opacity={0.4}>low</text>
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={3} fill={COLORS.accent} opacity={0.6} />
        {/* Contacts */}
        {contacts.map((c, i) => {
          const rad = (c.angle * Math.PI) / 180;
          const r = maxR * c.dist;
          const x = cx + Math.cos(rad) * r;
          const y = cy + Math.sin(rad) * r;
          const col = c.urgent ? COLORS.red : c.unread > 0 ? COLORS.orange : COLORS.textDim;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={c.urgent ? 18 : 14} fill={`${col}20`} stroke={col} strokeWidth={1.5} />
              <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fill={col} fontSize={8} fontWeight="600">
                {c.name.slice(0, 3).toUpperCase()}
              </text>
              {c.unread > 0 && (
                <>
                  <circle cx={x + 12} cy={y - 10} r={7} fill={col} />
                  <text x={x + 12} y={y - 9} textAnchor="middle" dominantBaseline="middle" fill={COLORS.bg} fontSize={8} fontWeight="700">
                    {c.unread}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TimelineMockup() {
  const events = [
    { time: "11:42a", src: "Teams", color: COLORS.purple, title: "Sandy", body: "Can you review the PrintDeed mockups before 3pm?", ai: "Action: Review needed in 2hrs" },
    { time: "11:30a", src: "Gmail", color: COLORS.red, title: "AWS Billing", body: "February invoice ready — $247.83", ai: "$47 over baseline" },
    { time: "11:15a", src: "Teams", color: COLORS.purple, title: "Rahul → OPS Dev", body: "Deployed hotfix to staging, needs QA", ai: "Action: QA sign-off needed" },
    { time: "10:50a", src: "Teams", color: COLORS.purple, title: "Designer KD-PD", body: "New color palette options uploaded to Figma", ai: null },
    { time: "10:22a", src: "iMsg", color: COLORS.green, title: "Mom", body: "Don't forget dinner Sunday!", ai: null },
    { time: "9:45a", src: "Teams", color: COLORS.purple, title: "PrintDeed Dev Chat", body: "Build #412 passed all tests", ai: null },
  ];

  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "16px 20px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Timeline / Chronicle</div>
      <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 16 }}>Your day as a scrollable story</div>
      <div style={{ position: "relative", paddingLeft: 40 }}>
        {/* Vertical line */}
        <div style={{ position: "absolute", left: 16, top: 0, bottom: 0, width: 1, background: COLORS.border }} />
        {events.map((e, i) => (
          <div key={i} style={{ marginBottom: 16, position: "relative" }}>
            {/* Dot */}
            <div
              style={{
                position: "absolute",
                left: -28,
                top: 4,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: e.color,
                border: `2px solid ${COLORS.bg}`,
              }}
            />
            {/* Time */}
            <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 2 }}>{e.time}</div>
            {/* Card */}
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "8px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: e.color, padding: "1px 5px", background: `${e.color}15`, borderRadius: 3 }}>{e.src}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>{e.title}</span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>{e.body}</div>
              {e.ai && (
                <div style={{ marginTop: 6, fontSize: 11, color: COLORS.accent, fontStyle: "italic" }}>
                  → {e.ai}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileTree() {
  const lines = [
    { indent: 0, text: "OpenClaw/", color: COLORS.accent },
    { indent: 1, text: "apps/", color: COLORS.green },
    { indent: 2, text: "runtime/", color: COLORS.green, note: "Python runtime app" },
    { indent: 3, text: "heartbeat.py", color: COLORS.text, note: "5-min proactive monitoring" },
    { indent: 3, text: "server.py", color: COLORS.green, note: "FastAPI + WebSocket server" },
    { indent: 3, text: "runtime_directives.py", color: COLORS.textMuted, note: "Runtime directive registry" },
    { indent: 1, text: "dashboard/", color: COLORS.green, note: "Web dashboard" },
    { indent: 2, text: "app/", color: COLORS.green, note: "Next.js app shell" },
    { indent: 2, text: "components/", color: COLORS.green, note: "Dashboard UI components" },
    { indent: 1, text: "packages/", color: COLORS.text },
    { indent: 2, text: "openclaw-orchestrator/", color: COLORS.text, note: "Repo-local orchestration plugin" },
    { indent: 1, text: "scripts/", color: COLORS.text },
    { indent: 2, text: "get_teams_messages.sh", color: COLORS.text, note: "Current — Notification Center" },
    { indent: 2, text: "teams_leveldb_reader.py", color: COLORS.green, note: "NEW — full LevelDB reader" },
    { indent: 2, text: "get_calendar_events.sh", color: COLORS.textMuted },
    { indent: 2, text: "gmail_unread.sh", color: COLORS.textMuted },
  ];

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "14px 16px", fontFamily: "monospace", fontSize: 12 }}>
      {lines.map((l, i) => (
        <div key={i} style={{ paddingLeft: l.indent * 20, lineHeight: 1.8, display: "flex", gap: 12 }}>
          <span style={{ color: l.color }}>{l.text}</span>
          {l.note && <span style={{ color: COLORS.textDim, fontSize: 10, fontStyle: "italic" }}>← {l.note}</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────

export default function App() {
  const [expandedApproach, setExpandedApproach] = useState(0);
  const [activeTab, setActiveTab] = useState("research");

  const tabs = [
    { id: "research", label: "Research" },
    { id: "architecture", label: "Architecture" },
    { id: "ui", label: "UI Concepts" },
  ];

  return (
    <div style={{ background: COLORS.bg, color: COLORS.text, minHeight: "100vh", fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif' }}>
      {/* Header */}
      <div style={{ padding: "24px 32px 0", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.accent, fontFamily: "monospace" }}>AG</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>AntiGravity</span>
          <span style={{ fontSize: 13, color: COLORS.textDim, marginLeft: 4 }}>Teams Deep Integration Research</span>
        </div>
        <p style={{ fontSize: 13, color: COLORS.textMuted, margin: "8px 0 20px", lineHeight: 1.6, maxWidth: 680 }}>
          Moving beyond notification-only access. Research into full Teams message history, app architecture, and dashboard concepts.
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${COLORS.border}` }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: activeTab === t.id ? 600 : 400,
                color: activeTab === t.id ? COLORS.accent : COLORS.textMuted,
                background: "none",
                border: "none",
                borderBottom: activeTab === t.id ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 32px 60px", maxWidth: 900, margin: "0 auto" }}>
        {activeTab === "research" && (
          <>
            {/* Key Finding */}
            <div
              style={{
                margin: "24px 0",
                padding: "16px 20px",
                background: `${COLORS.green}08`,
                border: `1px solid ${COLORS.green}30`,
                borderRadius: 8,
                borderLeft: `3px solid ${COLORS.green}`,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.green, marginBottom: 6 }}>KEY FINDING</div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.7 }}>
                Your Mac already has <strong style={{ color: COLORS.text }}>22MB of Teams LevelDB data</strong> at{" "}
                <code style={{ color: COLORS.accent, fontSize: 11 }}>~/Library/Containers/com.microsoft.teams2/.../IndexedDB/</code>{" "}
                containing full chat history, thread IDs, 1:1 conversations, group chats, and meetings. This can be parsed without any API registration or authentication using existing open-source forensic tools.
              </div>
            </div>

            <SectionTitle>Access Methods Evaluated</SectionTitle>
            {approaches.map((a, i) => (
              <ApproachCard
                key={i}
                data={a}
                isExpanded={expandedApproach === i}
                onToggle={() => setExpandedApproach(expandedApproach === i ? -1 : i)}
              />
            ))}

            {/* Recommendation */}
            <div
              style={{
                margin: "32px 0",
                padding: "20px 24px",
                background: COLORS.surface,
                border: `1px solid ${COLORS.accent}30`,
                borderRadius: 8,
                borderLeft: `3px solid ${COLORS.accent}`,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.accent, marginBottom: 8 }}>RECOMMENDED: HYBRID APPROACH</div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.8 }}>
                <strong style={{ color: COLORS.text }}>Primary — LevelDB Reader:</strong> Parse the local IndexedDB for full message history + search. Poll every 5 seconds for new .ldb file modifications. No auth required, works with personal accounts, contains everything.
              </div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.8, marginTop: 8 }}>
                <strong style={{ color: COLORS.text }}>Secondary — Notification Center (current):</strong> Keep the existing get_teams_messages.sh for real-time alerts. Notifications arrive faster than LevelDB writes in many cases.
              </div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.8, marginTop: 8 }}>
                <strong style={{ color: COLORS.text }}>Optional — Graph API:</strong> If you can register an Azure app (try the /consumers authority), add for structured 1:1 chat polling as a third source.
              </div>
            </div>
          </>
        )}

        {activeTab === "architecture" && (
          <>
            <SectionTitle>System Architecture</SectionTitle>
            <ArchDiagram />

            <SectionTitle>Proposed File Structure</SectionTitle>
            <FileTree />

            <SectionTitle>Implementation Phases</SectionTitle>
            {[
              {
                phase: "Phase 1 — LevelDB Reader",
                time: "1-2 days",
                items: [
                  "Build teams_leveldb_reader.py using dfindexeddb or custom LevelDB parser",
                  "Extract and decode Snappy-compressed message blocks",
                  "Map thread IDs to human-readable contact names",
                  "Store parsed messages in SQLite with FTS5 full-text search",
                  "Wire into existing get_teams_messages.sh as a replacement backend",
                ],
              },
              {
                phase: "Phase 2 — Dashboard Server",
                time: "1-2 days",
                items: [
                  "FastAPI server on localhost:8420",
                  "REST endpoints: /messages, /threads, /search, /contacts",
                  "WebSocket for real-time push to browser dashboard",
                  "Aggregate Teams + Gmail + Calendar + iMessage data",
                ],
              },
              {
                phase: "Phase 3 — Dashboard UI",
                time: "2-3 days",
                items: [
                  "React SPA served by FastAPI",
                  "Command Center view as default",
                  "Radar and Timeline views as alternatives",
                  "Telegram-like quick reply integration",
                  "Dark theme matching AntiGravity brand",
                ],
              },
              {
                phase: "Phase 4 — AI Layer",
                time: "1-2 days",
                items: [
                  "Claude-powered message summarization per thread",
                  "Action item extraction from conversation context",
                  "Priority auto-classification with learning",
                  "Morning briefing dashboard widget",
                ],
              },
            ].map((p, i) => (
              <div
                key={i}
                style={{
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  padding: "16px 20px",
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{p.phase}</span>
                  <span style={{ fontSize: 11, color: COLORS.textDim, padding: "2px 8px", background: COLORS.bg, borderRadius: 4 }}>{p.time}</span>
                </div>
                {p.items.map((item, j) => (
                  <div key={j} style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.8, paddingLeft: 16, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: COLORS.textDim }}>→</span> {item}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

        {activeTab === "ui" && (
          <>
            <SectionTitle>UI Concept Descriptions</SectionTitle>
            {uiConcepts.map((c) => (
              <div
                key={c.id}
                style={{
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  padding: "20px 24px",
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text, marginBottom: 2 }}>{c.title}</div>
                <div style={{ fontSize: 11, color: COLORS.accent, marginBottom: 10 }}>{c.subtitle}</div>
                <p style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.7, margin: "0 0 12px" }}>{c.desc}</p>
                <div style={{ fontSize: 11, color: COLORS.textDim, fontWeight: 600, marginBottom: 6 }}>KEY FEATURES</div>
                {c.features.map((f, i) => (
                  <div key={i} style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.7, paddingLeft: 12, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: COLORS.accent }}>·</span> {f}
                  </div>
                ))}
              </div>
            ))}

            <SectionTitle>Concept 1 — Command Center</SectionTitle>
            <CommandCenterMockup />

            <SectionTitle>Concept 2 — Radar View</SectionTitle>
            <RadarMockup />

            <SectionTitle>Concept 3 — Timeline / Chronicle</SectionTitle>
            <TimelineMockup />

            <div
              style={{
                margin: "32px 0",
                padding: "16px 20px",
                background: `${COLORS.accent}08`,
                border: `1px solid ${COLORS.accent}30`,
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.accent, marginBottom: 6 }}>MY RECOMMENDATION</div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.7 }}>
                Start with the <strong style={{ color: COLORS.text }}>Command Center</strong> as your default view — it's the most practical for daily use. Add the <strong style={{ color: COLORS.text }}>Timeline</strong> as a secondary view for catching up after meetings. The <strong style={{ color: COLORS.text }}>Radar</strong> is a great ambient second-monitor display once the core system is solid. All three can coexist as tabs in the same dashboard.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
