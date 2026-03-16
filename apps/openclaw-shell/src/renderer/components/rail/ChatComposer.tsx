import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ChatComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatComposer({ onSend, disabled = false }: ChatComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea up to 4 lines
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const lineHeight = 20; // ~13px font * 1.4 line-height ≈ 18px, rounded up
    const maxHeight = lineHeight * 4 + 12; // 4 lines + padding
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px';
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div
      style={{
        padding: '8px 12px',
        borderTop: '1px solid #3f3f46',
        display: 'flex',
        gap: '6px',
        alignItems: 'flex-end',
        flexShrink: 0,
        backgroundColor: '#18181b',
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Gateway offline...' : 'Message CD...'}
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          background: disabled ? '#27272a' : '#27272a',
          border: '1px solid #3f3f46',
          borderRadius: '8px',
          color: disabled ? '#71717a' : '#f4f4f5',
          fontSize: '13px',
          padding: '7px 10px',
          resize: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          lineHeight: '1.4',
          overflowY: 'auto',
          transition: 'border-color 0.15s',
          cursor: disabled ? 'not-allowed' : 'text',
        }}
        onFocus={(e) => {
          if (!disabled) {
            (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#3b82f6';
          }
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#3f3f46';
        }}
      />

      {/* Send button — arrow icon */}
      <button
        onClick={handleSend}
        disabled={!canSend}
        title="Send (Enter)"
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: canSend ? '#2563eb' : '#3f3f46',
          color: canSend ? '#fff' : '#71717a',
          cursor: canSend ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => {
          if (canSend) {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1d4ed8';
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = canSend
            ? '#2563eb'
            : '#3f3f46';
        }}
      >
        {/* Up-arrow SVG */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 11V3M7 3L3.5 6.5M7 3L10.5 6.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
