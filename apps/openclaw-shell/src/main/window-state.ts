// Window state persistence — remembers position, size, and shell state across restarts
// Stored at ~/.openclaw-shell/window-state.json

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { BrowserWindow, screen } from 'electron';
import { SHELL_CONFIG_DIR_NAME } from '../shared/constants.js';

const STATE_FILE = join(homedir(), SHELL_CONFIG_DIR_NAME, 'window-state.json');

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullScreen: boolean;
  activeServiceId?: string;
  railVisible?: boolean;
  railWidth?: number;
}

const DEFAULT_STATE: WindowState = {
  x: -1,
  y: -1,
  width: 1440,
  height: 900,
  isMaximized: false,
  isFullScreen: false,
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function loadWindowState(): WindowState {
  if (!existsSync(STATE_FILE)) {
    return { ...DEFAULT_STATE };
  }
  try {
    const raw = readFileSync(STATE_FILE, 'utf-8');
    const state = JSON.parse(raw) as Partial<WindowState>;
    return { ...DEFAULT_STATE, ...state };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveWindowState(state: WindowState): void {
  const dir = join(homedir(), SHELL_CONFIG_DIR_NAME);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Validate that the saved position is still on a visible display.
 * If the monitor layout has changed, reset to center of primary display.
 */
function validatePosition(state: WindowState): WindowState {
  if (state.x === -1 && state.y === -1) return state;

  const displays = screen.getAllDisplays();
  const onScreen = displays.some((display) => {
    const { x, y, width, height } = display.bounds;
    return (
      state.x >= x - 50 &&
      state.x < x + width + 50 &&
      state.y >= y - 50 &&
      state.y < y + height + 50
    );
  });

  if (!onScreen) {
    return { ...state, x: -1, y: -1 };
  }
  return state;
}

/**
 * Apply saved window state to a BrowserWindow.
 * Call this before showing the window.
 */
export function applyWindowState(win: BrowserWindow): void {
  const state = validatePosition(loadWindowState());

  if (state.x !== -1 && state.y !== -1) {
    win.setBounds({
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
    });
  } else {
    win.setSize(state.width, state.height);
    win.center();
  }

  if (state.isMaximized) {
    win.maximize();
  }
  if (state.isFullScreen) {
    win.setFullScreen(true);
  }

  // Send shell state to renderer once ready
  win.webContents.once('did-finish-load', () => {
    if (state.activeServiceId) {
      win.webContents.send('shell:focus-service', { serviceId: state.activeServiceId });
    }
    if (state.railVisible !== undefined) {
      win.webContents.send('shell:restore-state', {
        railVisible: state.railVisible,
        railWidth: state.railWidth,
      });
    }
  });
}

/**
 * Track window state changes and save them.
 * Debounces saves to avoid writing on every pixel of resize.
 */
export function trackWindowState(win: BrowserWindow): void {
  const debounceSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (win.isDestroyed()) return;

      const bounds = win.getBounds();
      const state: WindowState = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: win.isMaximized(),
        isFullScreen: win.isFullScreen(),
      };
      saveWindowState(state);
    }, 500);
  };

  win.on('resize', debounceSave);
  win.on('move', debounceSave);
  win.on('maximize', debounceSave);
  win.on('unmaximize', debounceSave);
  win.on('enter-full-screen', debounceSave);
  win.on('leave-full-screen', debounceSave);
}
