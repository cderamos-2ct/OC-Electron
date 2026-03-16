import React, { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Channel = 'email' | 'imessage' | 'voicemail' | 'telegram';
type Filter = 'all' | 'email' | 'imessage' | 'voicemail';

interface Message {
  id: string;
  sender: string;
  initials: string;
  avatarColor: string;
  subject: string;
  preview: string;
  time: string;
  channel: Channel;
  unread?: boolean;
  flagged?: boolean;
  draft?: boolean;
  isDraft?: boolean;
  body?: string;
  from?: string;
  to?: string;
  date?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MESSAGES: Message[] = [
  {
    id: '1',
    sender: 'Marcus Chen',
    initials: 'MC',
    avatarColor: '#2563eb',
    subject: 'Re: Series A Term Sheet',
    preview: "Christian — looked over the term sheet. A few things stand out that we should discuss before you sign anything. The liquidation preference...",
    time: '9:41 AM',
    channel: 'email',
    unread: true,
    flagged: true,
    from: 'Marcus Chen <marcus.chen@sequoiacap.com>',
    to: 'Christian De Ramos <christian@openclaw.ai>',
    date: 'Monday, March 16, 2026 at 9:41 AM',
    body: `Christian,

Looked over the term sheet. A few things stand out that we should discuss before you sign anything. The liquidation preference clause on page 4 is structured as 2x participating preferred — that's aggressive for a Series A and could significantly dilute your payout at exit.

Also noticed the pro-rata rights don't include a right of first refusal on the Series B. Worth pushing back on that before you're locked in.

I can hop on a call this week. Are you free Wednesday afternoon?

— Marcus

Marcus Chen
Partner, Sequoia Capital
marcus.chen@sequoiacap.com`,
  },
  {
    id: '2',
    sender: 'Lynn Nelson',
    initials: 'LN',
    avatarColor: '#7c3aed',
    subject: 'Buckner Project — Status Update',
    preview: 'Hey Christian, wanted to loop you in on where things stand with the Buckner install. We hit a snag with the permit office but...',
    time: '8:15 AM',
    channel: 'email',
    unread: false,
    flagged: false,
    from: 'Lynn Nelson <lynn@alphagraphics.com>',
    to: 'Christian De Ramos <christian@openclaw.ai>',
    date: 'Monday, March 16, 2026 at 8:15 AM',
    body: `Hey Christian,

Wanted to loop you in on where things stand with the Buckner install. We hit a snag with the permit office but the team is handling it — should be resolved by Thursday.

Printing is 80% complete. Lamination scheduled for Wednesday morning. Install crew is confirmed for Friday.

Let me know if you need anything before then.

Lynn`,
  },
  {
    id: '3',
    sender: 'Kyle Lasseter',
    initials: 'KL',
    avatarColor: '#059669',
    subject: 'New project pipeline',
    preview: "Christian — got a few prospects I want to run by you. One's a 10-location retail rollout, another is a stadium banner deal...",
    time: 'Yesterday',
    channel: 'email',
    unread: false,
    from: 'Kyle Lasseter <kyle@lasseter.co>',
    to: 'Christian De Ramos <christian@openclaw.ai>',
    date: 'Sunday, March 15, 2026 at 4:22 PM',
    body: `Christian —

Got a few prospects I want to run by you. One's a 10-location retail rollout, another is a stadium banner deal for a local sports team. Both have budgets north of $80K.

Can we set up a quick call this week to go over the pitch decks?

Kyle`,
  },
  {
    id: '4',
    sender: 'Ashley',
    initials: 'A',
    avatarColor: '#db2777',
    subject: 'Bella cheer comp — flights',
    preview: "Hey babe — found some flights for the competition in Dallas. Southwest has a good deal leaving Friday night. Want me to book them?",
    time: 'Yesterday',
    channel: 'imessage',
    unread: false,
    from: 'Ashley De Ramos',
    to: 'Christian De Ramos',
    date: 'Sunday, March 15, 2026 at 2:10 PM',
    body: `Hey babe — found some flights for the competition in Dallas. Southwest has a good deal leaving Friday night. Want me to book them? It's $189/person round trip. We'd need to book soon before prices go up.

Also Bella needs new cheer shoes before the trip, her current ones are falling apart 😅`,
  },
  {
    id: '5',
    sender: 'Southwest Airlines',
    initials: 'SW',
    avatarColor: '#b45309',
    subject: 'Your upcoming trip',
    preview: 'Your flight to Dallas DAL is confirmed. Check in opens 24 hours before departure. View your boarding pass in the app.',
    time: 'Mar 14',
    channel: 'email',
    unread: false,
    from: 'Southwest Airlines <noreply@southwest.com>',
    to: 'christian@openclaw.ai',
    date: 'Friday, March 14, 2026 at 11:05 AM',
    body: `Your upcoming trip is confirmed.

Flight: WN 2847
Route: Houston HOU → Dallas DAL
Departure: Friday, March 21 at 7:40 PM
Arrival: Friday, March 21 at 8:55 PM

Check-in opens 24 hours before departure. View your boarding pass in the Southwest app or at southwest.com.

Rapid Rewards #: 6284910
Points earned this trip: 1,240

Safe travels!
Southwest Airlines`,
  },
  {
    id: '6',
    sender: 'Karoline',
    initials: 'K',
    avatarColor: '#a3862a',
    subject: 'Re: Series A Term Sheet',
    preview: '[DRAFT] Hi Marcus, thanks for the thorough review. Regarding the liquidation preference — I agree that 2x participating preferred is...',
    time: 'Draft',
    channel: 'email',
    isDraft: true,
    from: 'Christian De Ramos <christian@openclaw.ai>',
    to: 'Marcus Chen <marcus.chen@sequoiacap.com>',
    date: 'Draft',
    body: `[DRAFT — Drafted by Karoline, Comms Commander]

Hi Marcus,

Thanks for the thorough review. Regarding the liquidation preference — I agree that 2x participating preferred is aggressive and I'd like to negotiate that down to 1x non-participating. That's more standard for our stage and gives us cleaner cap table math at exit.

On the pro-rata rights, we'd want to retain ROFR for the Series B. Happy to add that as a side letter if it's easier to keep the main term sheet clean.

Wednesday afternoon works for me. Does 3pm CT work for you?

Best,
Christian`,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ChannelBadge({ channel }: { channel: Channel }) {
  const map: Record<Channel, { label: string; color: string; bg: string }> = {
    email: { label: 'Gmail', color: '#93c5fd', bg: 'rgba(37,99,235,0.18)' },
    imessage: { label: 'iMessage', color: '#86efac', bg: 'rgba(22,163,74,0.18)' },
    voicemail: { label: 'Voicemail', color: '#fca5a5', bg: 'rgba(220,38,38,0.18)' },
    telegram: { label: 'Telegram', color: '#7dd3fc', bg: 'rgba(14,165,233,0.18)' },
  };
  const { label, color, bg } = map[channel];
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      color,
      background: bg,
      borderRadius: 4,
      padding: '1px 6px',
      letterSpacing: '0.02em',
      flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

function Avatar({ initials, color, size = 36 }: { initials: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.35,
      fontWeight: 700,
      color: '#fff',
      flexShrink: 0,
      letterSpacing: '0.02em',
    }}>
      {initials}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CommsView() {
  const [activeNav, setActiveNav] = useState<string>('all-inbound');
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string>('1');

  const selectedMessage = MESSAGES.find(m => m.id === selectedId) ?? null;

  const filteredMessages = activeFilter === 'all'
    ? MESSAGES
    : MESSAGES.filter(m => m.channel === activeFilter);

  // ── Sidebar nav items ──

  const inboxItems = [
    { id: 'all-inbound', label: 'All Inbound', count: 16 },
    { id: 'needs-reply', label: 'Needs Reply', count: 5 },
    { id: 'flagged', label: 'Flagged', count: 2 },
  ];

  const channelItems = [
    { id: 'ch-email', label: 'Email', count: 8, channel: 'email' as Filter },
    { id: 'ch-imessage', label: 'iMessage', count: 4, channel: 'imessage' as Filter },
    { id: 'ch-voicemail', label: 'Voicemail', count: 2, channel: 'voicemail' as Filter },
    { id: 'ch-telegram', label: 'Telegram', count: 2, channel: null },
  ];

  const filterTabs: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: MESSAGES.length },
    { key: 'email', label: 'Email', count: MESSAGES.filter(m => m.channel === 'email').length },
    { key: 'imessage', label: 'iMessage', count: MESSAGES.filter(m => m.channel === 'imessage').length },
    { key: 'voicemail', label: 'Voicemail', count: 0 },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      height: '100%',
      width: '100%',
      background: '#0f172a',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
    }}>

      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
      <div style={{
        width: 200,
        minWidth: 200,
        flexShrink: 0,
        background: '#131d33',
        borderRight: '1px solid rgba(241,245,249,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Compose button */}
        <div style={{ padding: '16px 12px 12px' }}>
          <button
            style={{
              width: '100%',
              background: 'rgba(163,134,42,0.2)',
              border: '1px solid rgba(163,134,42,0.45)',
              borderRadius: 8,
              color: '#e0c875',
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              letterSpacing: '0.01em',
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>✎</span>
            Compose
          </button>
        </div>

        {/* Nav sections */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>

          {/* Inboxes section */}
          <div style={{ marginBottom: 4 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#94a3b8',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '6px 14px 4px',
            }}>
              Inboxes
            </div>
            {inboxItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                style={{
                  width: 'calc(100% - 12px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 14px',
                  background: activeNav === item.id ? 'rgba(163,134,42,0.15)' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: activeNav === item.id ? '#e0c875' : '#cbd5e1',
                  fontSize: 13,
                  fontWeight: activeNav === item.id ? 600 : 400,
                  textAlign: 'left',
                  margin: '1px 6px',
                  transition: 'background 0.15s',
                }}
              >
                <span>{item.label}</span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: activeNav === item.id ? '#e0c875' : '#94a3b8',
                  background: activeNav === item.id ? 'rgba(163,134,42,0.25)' : 'rgba(241,245,249,0.08)',
                  borderRadius: 10,
                  padding: '0 6px',
                  lineHeight: '18px',
                  minWidth: 22,
                  textAlign: 'center',
                }}>
                  {item.count}
                </span>
              </button>
            ))}
          </div>

          {/* Channels section */}
          <div style={{ marginTop: 8, marginBottom: 4 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#94a3b8',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '6px 14px 4px',
            }}>
              Channels
            </div>
            {channelItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNav(item.id);
                  if (item.channel) setActiveFilter(item.channel);
                }}
                style={{
                  width: 'calc(100% - 12px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 14px',
                  background: activeNav === item.id ? 'rgba(163,134,42,0.15)' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: activeNav === item.id ? '#e0c875' : '#cbd5e1',
                  fontSize: 13,
                  fontWeight: activeNav === item.id ? 600 : 400,
                  textAlign: 'left',
                  margin: '1px 6px',
                  transition: 'background 0.15s',
                }}
              >
                <span>{item.label}</span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: activeNav === item.id ? '#e0c875' : '#94a3b8',
                  background: activeNav === item.id ? 'rgba(163,134,42,0.25)' : 'rgba(241,245,249,0.08)',
                  borderRadius: 10,
                  padding: '0 6px',
                  lineHeight: '18px',
                  minWidth: 22,
                  textAlign: 'center',
                }}>
                  {item.count}
                </span>
              </button>
            ))}
          </div>

          {/* Agent section */}
          <div style={{ marginTop: 8 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#94a3b8',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '6px 14px 4px',
            }}>
              Agent
            </div>

            {/* Karoline */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 14px',
              margin: '1px 6px',
              borderRadius: 6,
              background: 'rgba(163,134,42,0.08)',
              border: '1px solid rgba(163,134,42,0.2)',
              cursor: 'pointer',
            }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #a3862a, #e0c875)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#0f172a',
                }}>K</div>
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#2ecc71',
                  border: '1.5px solid #131d33',
                }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e0c875', lineHeight: 1.2 }}>Karoline</div>
                <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Comms Commander</div>
              </div>
            </div>

            {/* Iris */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 14px',
              margin: '4px 6px',
              borderRadius: 6,
              cursor: 'pointer',
            }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2563eb, #7dd3fc)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                }}>I</div>
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#94a3b8',
                  border: '1.5px solid #131d33',
                }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', lineHeight: 1.2 }}>Iris</div>
                <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Channel Aggregator</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CENTER: TWO-COLUMN ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minWidth: 0 }}>

        {/* ── MESSAGE LIST COLUMN (~380px) ── */}
        <div style={{
          width: 380,
          minWidth: 280,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(241,245,249,0.08)',
          overflow: 'hidden',
          background: '#0f172a',
        }}>
          {/* Filter tabs */}
          <div style={{
            display: 'flex',
            gap: 6,
            padding: '12px 12px 10px',
            borderBottom: '1px solid rgba(241,245,249,0.08)',
            flexShrink: 0,
          }}>
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: activeFilter === tab.key
                    ? '1px solid rgba(163,134,42,0.5)'
                    : '1px solid rgba(241,245,249,0.1)',
                  background: activeFilter === tab.key
                    ? 'rgba(163,134,42,0.2)'
                    : 'rgba(241,245,249,0.04)',
                  color: activeFilter === tab.key ? '#e0c875' : '#94a3b8',
                  fontSize: 12,
                  fontWeight: activeFilter === tab.key ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: activeFilter === tab.key ? 'rgba(163,134,42,0.35)' : 'rgba(241,245,249,0.1)',
                    color: activeFilter === tab.key ? '#e0c875' : '#94a3b8',
                    borderRadius: 8,
                    padding: '0 5px',
                    lineHeight: '16px',
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Message rows */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredMessages.map(msg => {
              const isSelected = msg.id === selectedId;
              return (
                <div
                  key={msg.id}
                  onClick={() => setSelectedId(msg.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '11px 14px',
                    cursor: 'pointer',
                    background: isSelected
                      ? 'rgba(163,134,42,0.1)'
                      : 'transparent',
                    borderLeft: isSelected
                      ? '2px solid #a3862a'
                      : '2px solid transparent',
                    borderBottom: '1px solid rgba(241,245,249,0.06)',
                    transition: 'background 0.12s',
                    position: 'relative',
                  }}
                >
                  {/* Unread dot */}
                  {msg.unread && (
                    <div style={{
                      position: 'absolute',
                      left: isSelected ? 18 : 16,
                      top: 20,
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#a3862a',
                      flexShrink: 0,
                    }} />
                  )}

                  {/* Avatar */}
                  <Avatar initials={msg.initials} color={msg.isDraft ? '#a3862a' : msg.avatarColor} size={36} />

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{
                        fontSize: 13,
                        fontWeight: msg.unread ? 700 : 500,
                        color: msg.isDraft ? '#e0c875' : '#f1f5f9',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 160,
                      }}>
                        {msg.isDraft ? `${msg.sender} [DRAFT]` : msg.sender}
                      </span>
                      <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, marginLeft: 6 }}>
                        {msg.time}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 12,
                      fontWeight: msg.unread ? 600 : 400,
                      color: msg.unread ? '#e2e8f0' : '#94a3b8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: 3,
                    }}>
                      {msg.subject}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: '#64748b',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: 6,
                    }}>
                      {msg.preview}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ChannelBadge channel={msg.channel} />
                      {msg.flagged && (
                        <span style={{ fontSize: 11, color: '#e0c875' }}>⚑</span>
                      )}
                      {msg.isDraft && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: '#e0c875',
                          background: 'rgba(163,134,42,0.2)',
                          borderRadius: 4,
                          padding: '1px 6px',
                        }}>DRAFT</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── READING PANE ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#0f172a',
          minWidth: 0,
          position: 'relative',
        }}>
          {selectedMessage ? (
            <>
              {/* Email header */}
              <div style={{
                padding: '20px 28px 16px',
                borderBottom: '1px solid rgba(241,245,249,0.08)',
                flexShrink: 0,
              }}>
                <div style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#f1f5f9',
                  marginBottom: 14,
                  lineHeight: 1.3,
                }}>
                  {selectedMessage.subject}
                </div>

                {/* From / To / Date */}
                {[
                  { label: 'From', value: selectedMessage.from },
                  { label: 'To', value: selectedMessage.to },
                  { label: 'Date', value: selectedMessage.date },
                ].map(row => (
                  <div key={row.label} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    marginBottom: 5,
                  }}>
                    <span style={{
                      fontSize: 12,
                      color: '#94a3b8',
                      minWidth: 36,
                      fontWeight: 500,
                      paddingTop: 1,
                    }}>
                      {row.label}
                    </span>
                    <span style={{
                      fontSize: 12,
                      color: '#cbd5e1',
                      lineHeight: 1.5,
                    }}>
                      {row.value}
                    </span>
                  </div>
                ))}

                {/* Channel badge + flag */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <ChannelBadge channel={selectedMessage.channel} />
                  {selectedMessage.flagged && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#e0c875',
                      background: 'rgba(224,200,117,0.12)',
                      borderRadius: 4,
                      padding: '1px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      ⚑ Flagged
                    </span>
                  )}
                  {selectedMessage.isDraft && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#e0c875',
                      background: 'rgba(163,134,42,0.2)',
                      borderRadius: 4,
                      padding: '1px 8px',
                    }}>
                      DRAFT
                    </span>
                  )}
                </div>
              </div>

              {/* Email body */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px 28px',
              }}>
                <div style={{
                  fontSize: 14,
                  color: '#cbd5e1',
                  lineHeight: 1.85,
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                }}>
                  {selectedMessage.body}
                </div>
              </div>

              {/* Agent overlay toolbar */}
              <div style={{
                flexShrink: 0,
                padding: '12px 20px',
                borderTop: '1px solid rgba(241,245,249,0.08)',
                background: 'rgba(19,29,51,0.95)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                {/* Karoline avatar */}
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #a3862a, #e0c875)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#0f172a',
                  }}>K</div>
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#2ecc71',
                    border: '1.5px solid #131d33',
                  }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 1 }}>
                    Karoline · Comms Commander
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                    {selectedMessage.isDraft
                      ? 'Draft reply ready to review. Tap Send to dispatch.'
                      : 'Ready to help. Reply, summarize, or draft a response.'}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {['Reply', 'Draft', 'Summarize'].map(action => (
                    <button
                      key={action}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 6,
                        border: '1px solid rgba(241,245,249,0.14)',
                        background: 'rgba(241,245,249,0.05)',
                        color: '#cbd5e1',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >
                      {action}
                    </button>
                  ))}
                  {selectedMessage.isDraft && (
                    <button
                      style={{
                        padding: '5px 14px',
                        borderRadius: 6,
                        border: '1px solid rgba(163,134,42,0.5)',
                        background: 'rgba(163,134,42,0.2)',
                        color: '#e0c875',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Send
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 12,
              color: '#475569',
            }}>
              <div style={{ fontSize: 40, opacity: 0.4 }}>✉</div>
              <div style={{ fontSize: 14 }}>Select a message to read</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
