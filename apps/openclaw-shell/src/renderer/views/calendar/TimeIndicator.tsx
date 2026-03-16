import React, { useState, useEffect } from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TimeIndicatorProps {
  hourStart: number;
  totalHours: number;
}

// ─── TimeIndicator ────────────────────────────────────────────────────────────

export function TimeIndicator({ hourStart, totalHours }: TimeIndicatorProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const currentHour = now.getHours() + now.getMinutes() / 60;
  const topPct = ((currentHour - hourStart) / totalHours) * 100;

  // Don't render if outside visible range
  if (topPct < 0 || topPct > 100) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: `${topPct}%`,
        left: -1,
        right: 0,
        height: 2,
        background: '#ef4444',
        zIndex: 3,
        pointerEvents: 'none',
      }}
    >
      {/* Dot on the left edge */}
      <div
        style={{
          position: 'absolute',
          left: -4,
          top: -3,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#ef4444',
        }}
      />
    </div>
  );
}
