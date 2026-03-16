// ─── Browser module barrel ────────────────────────────────────────────────────
export type {
  CDPDebugger,
  CDPClientOptions,
  CDPScreenshot,
  CDPEvalResult,
  CDPNodeInfo,
} from './cdp-client.js';
export { CDPClient } from './cdp-client.js';
export * from './actions.js';
