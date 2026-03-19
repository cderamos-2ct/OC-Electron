/**
 * vault-autofill-preload.ts — Auto-fill preload for webviews
 *
 * Detects login forms, queries the vault for matching credentials,
 * and shows a fill pill that the user clicks to populate fields.
 *
 * Runs in sandboxed context with contextIsolation=true.
 * Page JS cannot access vault APIs — only the preload bridge can.
 */

import { ipcRenderer } from 'electron';

// ─── Constants ──────────────────────────────────────────────────

const FILL_PILL_ID = '__openclaw-autofill-pill';
const SAVE_BANNER_ID = '__openclaw-save-banner';
const PASSWORD_SELECTORS = [
  'input[type="password"]',
  'input[autocomplete="current-password"]',
  'input[autocomplete="new-password"]',
];
const USERNAME_SELECTORS = [
  'input[type="email"]',
  'input[type="text"][name*="user"]',
  'input[type="text"][name*="email"]',
  'input[type="text"][name*="login"]',
  'input[autocomplete="username"]',
  'input[autocomplete="email"]',
];
const TOTP_SELECTORS = [
  'input[name*="otp"]',
  'input[name*="totp"]',
  'input[name*="2fa"]',
  'input[name*="mfa"]',
  'input[autocomplete="one-time-code"]',
];

// ─── State ──────────────────────────────────────────────────────

let currentMatch: { secretName: string; username: string | null; password: string } | null = null;
let pillElement: HTMLElement | null = null;
let observerActive = false;

// ─── Form Detection ─────────────────────────────────────────────

function findPasswordField(): HTMLInputElement | null {
  for (const selector of PASSWORD_SELECTORS) {
    const el = document.querySelector<HTMLInputElement>(selector);
    if (el && el.offsetParent !== null) return el; // visible
  }
  return null;
}

function findUsernameField(passwordField: HTMLInputElement): HTMLInputElement | null {
  // Look for username/email field in the same form or nearby
  const form = passwordField.closest('form');
  const scope = form ?? document;

  for (const selector of USERNAME_SELECTORS) {
    const el = scope.querySelector<HTMLInputElement>(selector);
    if (el && el.offsetParent !== null && el !== passwordField) return el;
  }
  return null;
}

function findTotpField(): HTMLInputElement | null {
  for (const selector of TOTP_SELECTORS) {
    const el = document.querySelector<HTMLInputElement>(selector);
    if (el && el.offsetParent !== null) return el;
  }
  return null;
}

function isRegistrationForm(passwordField: HTMLInputElement): boolean {
  const form = passwordField.closest('form');
  if (!form) return false;

  // Check for password confirmation field
  const passwordFields = form.querySelectorAll('input[type="password"]');
  if (passwordFields.length >= 2) return true;

  // Check for new-password autocomplete
  if (passwordField.autocomplete === 'new-password') return true;

  return false;
}

// ─── Fill Pill UI ───────────────────────────────────────────────

function createFillPill(anchorField: HTMLInputElement): HTMLElement {
  removePill();

  const pill = document.createElement('div');
  pill.id = FILL_PILL_ID;
  pill.textContent = '🔑 Fill';
  pill.setAttribute('style', [
    'position: absolute',
    'z-index: 2147483647',
    'background: #1a1a2e',
    'color: #e0c875',
    'font-family: -apple-system, BlinkMacSystemFont, sans-serif',
    'font-size: 11px',
    'font-weight: 700',
    'padding: 4px 10px',
    'border-radius: 6px',
    'border: 1px solid rgba(224,200,117,0.3)',
    'cursor: pointer',
    'box-shadow: 0 2px 8px rgba(0,0,0,0.3)',
    'user-select: none',
    'transition: opacity 0.15s',
  ].join('; '));

  // Position near the password field
  const rect = anchorField.getBoundingClientRect();
  pill.style.top = `${window.scrollY + rect.top + rect.height + 4}px`;
  pill.style.left = `${window.scrollX + rect.right - 60}px`;

  pill.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fillCredentials(anchorField);
  });

  document.body.appendChild(pill);
  pillElement = pill;
  return pill;
}

function removePill(): void {
  const existing = document.getElementById(FILL_PILL_ID);
  if (existing) existing.remove();
  pillElement = null;
}

// ─── Fill Logic ─────────────────────────────────────────────────

function fillCredentials(passwordField: HTMLInputElement): void {
  if (!currentMatch) return;

  // Fill password
  setInputValue(passwordField, currentMatch.password);

  // Fill username if available
  if (currentMatch.username) {
    const usernameField = findUsernameField(passwordField);
    if (usernameField) {
      setInputValue(usernameField, currentMatch.username);
    }
  }

  // Notify host that auto-fill was used (for audit)
  ipcRenderer.sendToHost('vault:autofill-used', {
    secretName: currentMatch.secretName,
    url: window.location.href,
  });

  removePill();
}

/**
 * Set input value programmatically and dispatch events so frameworks detect the change.
 */
function setInputValue(input: HTMLInputElement, value: string): void {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value',
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

// ─── Save Password Banner ───────────────────────────────────────

function showSaveBanner(username: string, password: string): void {
  const existing = document.getElementById(SAVE_BANNER_ID);
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = SAVE_BANNER_ID;
  banner.setAttribute('style', [
    'position: fixed',
    'top: 0',
    'left: 0',
    'right: 0',
    'z-index: 2147483647',
    'background: #1a1a2e',
    'color: #f1f5f9',
    'font-family: -apple-system, BlinkMacSystemFont, sans-serif',
    'font-size: 13px',
    'padding: 10px 16px',
    'display: flex',
    'align-items: center',
    'gap: 12px',
    'border-bottom: 1px solid rgba(224,200,117,0.3)',
    'box-shadow: 0 2px 12px rgba(0,0,0,0.4)',
  ].join('; '));

  banner.innerHTML = `
    <span style="flex:1">Save login for <strong>${window.location.hostname}</strong>?</span>
    <button id="__oc-save-yes" style="background:#a3862a;color:#fff;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer">Save</button>
    <button id="__oc-save-no" style="background:transparent;color:#94a3b8;border:1px solid rgba(241,245,249,0.14);padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer">Dismiss</button>
  `;

  document.body.appendChild(banner);

  document.getElementById('__oc-save-yes')?.addEventListener('click', () => {
    ipcRenderer.sendToHost('vault:autofill-offer-save', {
      url: window.location.href,
      username,
      password,
    });
    banner.remove();
  });

  document.getElementById('__oc-save-no')?.addEventListener('click', () => {
    banner.remove();
  });

  // Auto-dismiss after 15 seconds
  setTimeout(() => banner.remove(), 15_000);
}

// ─── Form Submit Detection (for save-password offer) ────────────

function watchFormSubmissions(): void {
  document.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    const passwordField = form.querySelector<HTMLInputElement>('input[type="password"]');
    if (!passwordField || !passwordField.value) return;

    // Don't offer to save if we just auto-filled (user already has this credential)
    if (currentMatch) return;

    const usernameField = findUsernameField(passwordField);
    const username = usernameField?.value ?? '';

    showSaveBanner(username, passwordField.value);
  }, true);
}

// ─── Main Detection Loop ────────────────────────────────────────

async function detectAndOffer(): Promise<void> {
  const passwordField = findPasswordField();
  if (!passwordField) {
    removePill();
    return;
  }

  // Query the host for matching credentials
  try {
    ipcRenderer.sendToHost('vault:autofill-query', { url: window.location.href });
  } catch {
    // Host not available
  }
}

// ─── IPC from Host ──────────────────────────────────────────────

ipcRenderer.on('vault:autofill-response', (_event, data: { secretName: string; username: string | null; password: string } | null) => {
  if (!data) {
    currentMatch = null;
    removePill();
    return;
  }

  currentMatch = data;

  const passwordField = findPasswordField();
  if (passwordField) {
    createFillPill(passwordField);
  }
});

ipcRenderer.on('vault:autofill-totp', (_event, data: { code: string } | null) => {
  if (!data) return;

  const totpField = findTotpField();
  if (totpField) {
    setInputValue(totpField, data.code);
  }
});

// ─── Initialization ─────────────────────────────────────────────

function init(): void {
  if (observerActive) return;
  observerActive = true;

  // Initial scan
  void detectAndOffer();

  // Watch for SPA navigation / dynamic form rendering
  const observer = new MutationObserver(() => {
    void detectAndOffer();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Watch for form submissions (save-password offer)
  watchFormSubmissions();
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
