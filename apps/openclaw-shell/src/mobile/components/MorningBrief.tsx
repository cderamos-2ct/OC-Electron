interface MorningBriefProps {
  onDismiss: () => void;
}

interface BriefSection {
  label: string;
  items: string[];
}

// In production these would come from the gateway; for MVP they're static placeholders
const PLACEHOLDER_SECTIONS: BriefSection[] = [
  { label: 'Meetings Today', items: [] },
  { label: 'Tasks Due', items: [] },
  { label: 'PRs Awaiting Review', items: [] },
];

export function MorningBrief({ onDismiss }: MorningBriefProps) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', color: '#71717a', marginBottom: '4px' }}>{today}</div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f4f4f5' }}>Morning Brief</h1>
      </div>

      {/* Summary sections */}
      {PLACEHOLDER_SECTIONS.map((section) => (
        <BriefCard key={section.label} section={section} />
      ))}

      {/* Overnight agent activity */}
      <div style={{
        background: '#27272a',
        borderRadius: '12px',
        padding: '14px 16px',
        marginBottom: '12px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#a1a1aa', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Overnight
        </div>
        <div style={{ fontSize: '14px', color: '#71717a' }}>
          No agent activity while you were away.
        </div>
      </div>

      {/* Blockers */}
      <div style={{
        background: '#27272a',
        borderRadius: '12px',
        padding: '14px 16px',
        marginBottom: '24px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Blockers
        </div>
        <div style={{ fontSize: '14px', color: '#71717a' }}>
          No blockers detected.
        </div>
      </div>

      {/* Start Day */}
      <button
        onClick={onDismiss}
        style={{
          width: '100%',
          minHeight: '52px',
          background: '#2563eb',
          border: 'none',
          borderRadius: '14px',
          color: '#fff',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Start Day
      </button>
    </div>
  );
}

function BriefCard({ section }: { section: BriefSection }) {
  return (
    <div style={{
      background: '#27272a',
      borderRadius: '12px',
      padding: '14px 16px',
      marginBottom: '12px',
    }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#a1a1aa', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {section.label}
      </div>
      {section.items.length === 0 ? (
        <div style={{ fontSize: '14px', color: '#52525b' }}>Nothing scheduled.</div>
      ) : (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {section.items.map((item, i) => (
            <li key={i} style={{ fontSize: '14px', color: '#d4d4d8' }}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
