// ─── OpenClaw Design Tokens (TypeScript) ────────────────────────────────────
// Mirrors tokens.css for use in JS/TS contexts (inline styles, theme objects)

export const colors = {
  // Backgrounds
  bg: '#0a0a0e',
  bgMid: '#111115',
  bgCard: '#161618',

  // Borders
  border: '#252528',
  border2: '#1a1a1e',

  // Text
  text: '#e0e0e8',
  text2: '#c8c8cc',
  text3: '#b0b0b5',
  muted: '#888890',
  dim: '#666670',
  dimmer: '#555558',
  faint: '#444448',

  // Accent
  accent: '#e85d3a',
  accentBg: '#3d1a12',
  accentBg2: '#2d1512',

  // Status
  green: '#2ecc71',
  yellow: '#f39c12',
  red: '#e74c3c',
} as const;

export const layout = {
  titleH: '38px',
  tabbarH: '40px',
  navbarH: '48px',
  railW: '340px',
} as const;

export const typography = {
  fontSans: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
  fontMono: "'SF Mono', 'Menlo', monospace",
} as const;

export const radii = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '10px',
  full: '9999px',
} as const;

// ── Agent avatar background colors ───────────────────────────────────────────
export const agentAvatarColors: Record<string, string> = {
  brain:     colors.accentBg,
  shield:    '#5e1f2d',
  rainbow:   '#1f4e5e',
  compass:   '#1f5e3d',
  hourglass: '#5e4e1f',
  temple:    '#1f3d5e',
  crystal:   '#3d1f5e',
  home:      '#5e3d1f',
  scroll:    '#2d2d5e',
  fire:      '#5e2d1f',
  scale:     '#2d5e2d',
  satellite: '#1f2d5e',
  socrates:  '#4e2d1f',
  eye:       '#2d2d5e',
};

export type AgentAvatarTheme = keyof typeof agentAvatarColors;
