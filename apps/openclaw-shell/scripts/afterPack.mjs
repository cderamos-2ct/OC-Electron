/**
 * afterPack.mjs
 * electron-builder afterPack hook — ad-hoc re-signs the macOS app bundle
 * so all frameworks share a consistent identity.
 *
 * macOS 26+ (Tahoe) enforces matching Team IDs across all Mach-O binaries
 * in a bundle. Without this, unsigned builds crash on launch with:
 *   "mapping process and mapped file have different Team IDs"
 *
 * In CI with real certs (CSC_LINK set), electron-builder handles signing
 * automatically — this hook is a no-op in that case.
 */

import { execFileSync } from 'child_process';

export default async function afterPack(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Skip if real code signing is configured (CI builds)
  if (process.env.CSC_LINK || process.env.CSC_NAME) {
    console.log('[afterPack] Real signing configured, skipping ad-hoc re-sign.');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`[afterPack] Ad-hoc re-signing ${appPath} for macOS 26+ compatibility...`);

  try {
    execFileSync('codesign', ['--deep', '--force', '--sign', '-', appPath], {
      stdio: 'inherit',
      timeout: 120_000,
    });
    console.log('[afterPack] Ad-hoc re-sign complete.');
  } catch (err) {
    console.warn('[afterPack] Ad-hoc re-sign failed (non-fatal):', err.message);
  }
}
