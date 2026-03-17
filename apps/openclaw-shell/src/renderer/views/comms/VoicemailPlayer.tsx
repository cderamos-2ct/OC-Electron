import React, { useState } from 'react';
import { Voicemail } from './types';

const WAVEFORM_HEIGHTS = [
  12, 18, 24, 16, 28, 20, 14, 32, 22, 18, 26, 30, 16, 24, 20,
  28, 14, 18, 32, 24, 20, 16, 28, 22, 18, 30, 14, 26, 20, 24,
  18, 28, 16, 22, 30, 14, 24, 20, 18, 26,
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface VoicemailPlayerProps {
  voicemail: Voicemail;
}

export function VoicemailPlayer({ voicemail }: VoicemailPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1

  const playedBars = Math.floor(progress * WAVEFORM_HEIGHTS.length);

  const handlePlayPause = () => {
    setIsPlaying((p) => !p);
    // Simulate progress
    if (!isPlaying) {
      let p = progress;
      const interval = setInterval(() => {
        p += 0.01;
        if (p >= 1) {
          p = 1;
          setIsPlaying(false);
          clearInterval(interval);
        }
        setProgress(p);
      }, voicemail.duration * 10);
    }
  };

  return (
    <div style={{
      background: '#1a1814',
      border: '1px solid #3c341e',
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#2c2414',
          border: '1px solid #5e4a2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          color: '#ffb86b',
        }}>
          {voicemail.callerInitials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0' }}>{voicemail.caller}</div>
          <div style={{ fontSize: 11, color: '#7e6a4a' }}>{voicemail.timestamp}</div>
        </div>
        <div style={{
          fontSize: 11,
          color: '#7e6a4a',
          background: '#2c2414',
          borderRadius: 6,
          padding: '3px 8px',
        }}>
          {formatDuration(voicemail.duration)}
        </div>
      </div>

      {/* Player controls + waveform */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Play button */}
        <button
          onClick={handlePlayPause}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#ffb86b',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* Waveform */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          height: 36,
        }}>
          {WAVEFORM_HEIGHTS.map((h, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: h,
                borderRadius: 2,
                background: i < playedBars ? '#ffb86b' : '#5e4a2a',
                transition: 'background 0.1s',
                cursor: 'pointer',
              }}
              onClick={() => setProgress(i / WAVEFORM_HEIGHTS.length)}
            />
          ))}
        </div>

        {/* Progress time */}
        <div style={{ fontSize: 11, color: '#7e6a4a', flexShrink: 0 }}>
          {formatDuration(Math.floor(progress * voicemail.duration))}
        </div>
      </div>

      {/* Transcript */}
      <div style={{
        background: '#16140e',
        borderRadius: 8,
        padding: '10px 14px',
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#7e6a4a',
          marginBottom: 6,
        }}>
          Transcript
        </div>
        <div style={{
          fontSize: 12,
          color: '#a89070',
          fontStyle: 'italic',
          lineHeight: 1.6,
        }}>
          {voicemail.transcript}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {['Call Back', 'Send Message', 'Delete'].map((label) => (
          <button
            key={label}
            style={{
              background: label === 'Delete' ? 'transparent' : 'rgba(163,134,42,0.1)',
              border: `1px solid ${label === 'Delete' ? '#3c1e28' : 'rgba(163,134,42,0.3)'}`,
              borderRadius: 8,
              color: label === 'Delete' ? '#e05a6a' : 'var(--accent)',
              fontSize: 12,
              fontWeight: 500,
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
