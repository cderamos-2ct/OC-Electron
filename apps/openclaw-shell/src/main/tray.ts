import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import { join } from 'path';

let tray: Tray | null = null;

function getIconPath(): string {
  // Placeholder icon path — replace with actual asset in production
  return join(__dirname, '../../assets/icons/tray-icon.png');
}

function buildMenu(mainWindow: BrowserWindow): Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Show/Hide Aegilume Shell',
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Services',
      submenu: [
        { label: 'Dashboard', enabled: false },
        { label: 'Gmail', enabled: false },
        { label: 'Calendar', enabled: false },
        { label: 'GitHub', enabled: false },
      ],
    },
    { type: 'separator' },
    {
      label: 'Quick CD Message',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('shell:toggle-rail', undefined);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Aegilume Shell',
      click: () => {
        app.quit();
      },
    },
  ]);
}

export function createTray(mainWindow: BrowserWindow): void {
  const icon = nativeImage.createFromPath(getIconPath());
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('Aegilume Shell');
  tray.setContextMenu(buildMenu(mainWindow));

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

export function updateTrayBadge(count: number): void {
  if (!tray) return;
  if (count > 0) {
    tray.setTitle(String(count));
    tray.setToolTip(`(${count}) Aegilume Shell`);
  } else {
    tray.setTitle('');
    tray.setToolTip('Aegilume Shell');
  }
}
