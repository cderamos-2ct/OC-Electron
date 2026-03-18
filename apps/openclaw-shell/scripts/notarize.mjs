/**
 * notarize.mjs
 * electron-builder afterSign hook — notarizes the macOS app bundle.
 *
 * Triggered automatically by electron-builder via:
 *   afterSign: scripts/notarize.mjs
 *
 * Required environment variables (set in CI secrets):
 *   APPLE_ID            — Apple ID email used for notarization
 *   APPLE_ID_PASSWORD   — App-specific password for the Apple ID
 *   APPLE_TEAM_ID       — 10-character Apple Developer Team ID
 *
 * This hook is a no-op outside of CI (process.env.CI is unset).
 */

import { notarize } from '@electron/notarize';

export default async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  if (!process.env.CI) {
    console.log('[notarize] Skipping notarization — not running in CI.');
    return;
  }

  const { APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID } = process.env;

  if (!APPLE_ID || !APPLE_ID_PASSWORD || !APPLE_TEAM_ID) {
    throw new Error(
      '[notarize] Missing required environment variables: ' +
        ['APPLE_ID', 'APPLE_ID_PASSWORD', 'APPLE_TEAM_ID']
          .filter((k) => !process.env[k])
          .join(', ')
    );
  }

  const appName = context.packager.appInfo.productFilename;
  const appBundleId = context.packager.config.appId;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`[notarize] Notarizing ${appBundleId} at ${appPath}…`);

  await notarize({
    appBundleId,
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_ID_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });

  console.log('[notarize] Notarization complete.');
}
