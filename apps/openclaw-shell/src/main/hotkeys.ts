import { globalShortcut, BrowserWindow, Menu } from 'electron';
import {
  SHOW_SHELL_HOTKEY,
  NEXT_NOTIFICATION_HOTKEY,
} from '../shared/constants.js';

export function registerHotkeys(mainWindow: BrowserWindow): void {
  // Cmd+Shift+O: show/hide shell window from any app (genuinely global)
  globalShortcut.register(SHOW_SHELL_HOTKEY, () => {
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Cmd+Shift+N: show next pending notification/approval (genuinely global)
  globalShortcut.register(NEXT_NOTIFICATION_HOTKEY, () => {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('shell:toggle-rail', undefined);
    mainWindow.webContents.send('shell:show-next-approval', undefined);
  });

  // Cmd+1-9, Cmd+W, Cmd+Shift+C: app-scoped via application menu accelerators
  const tabItems: Electron.MenuItemConstructorOptions[] = [];
  for (let i = 1; i <= 9; i++) {
    tabItems.push({
      label: `Switch to Tab ${i}`,
      accelerator: `CommandOrControl+${i}`,
      visible: false,
      click: () => {
        mainWindow.webContents.send('shell:focus-service', { serviceIndex: i - 1 });
      },
    });
  }

  const menu = Menu.buildFromTemplate([
    {
      label: 'Shell',
      submenu: [
        ...tabItems,
        {
          label: 'Close Tab',
          accelerator: 'CommandOrControl+W',
          visible: false,
          click: () => {
            mainWindow.webContents.send('shell:close-active-tab', undefined);
          },
        },
        {
          label: 'Toggle Chat Rail',
          accelerator: 'CommandOrControl+Shift+C',
          visible: false,
          click: () => {
            mainWindow.webContents.send('shell:toggle-rail', undefined);
          },
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll();
}
