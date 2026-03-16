import { MobileViewShell } from '../MobileViewShell';

export function MobileHomeView() {
  return (
    <MobileViewShell title="Home">
      <div style={{ padding: '16px' }}>
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🟢</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Agent Status</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: 'Active', value: 8, color: '#22c55e' },
              { label: 'Idle', value: 2, color: 'var(--text-muted)' },
              { label: 'Needs Review', value: 3, color: '#f59e0b' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: 8,
                  padding: '10px 8px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
            Today's Summary
          </div>
          {[
            { label: 'Tasks running', value: 8, color: '#3b82f6' },
            { label: 'Approvals pending', value: 3, color: '#f5c842' },
            { label: 'Completed', value: 34, color: '#22c55e' },
            { label: 'Meetings today', value: 2, color: 'var(--text-secondary)' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '7px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </MobileViewShell>
  );
}
