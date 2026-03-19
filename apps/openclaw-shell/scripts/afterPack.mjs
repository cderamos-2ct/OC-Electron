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

import { execFileSync, execSync } from 'child_process';

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

  console.log(`[afterPack] Ad-hoc re-signing all Mach-O binaries in ${appPath}...`);

  try {
    // Find and sign ALL Mach-O binaries (dylibs, .so, executables in Resources/)
    // codesign --deep misses binaries in Resources/ — must sign explicitly
    const findCmd = `find "${appPath}/Contents/Resources" -type f \\( -name "*.dylib" -o -name "*.so" \\) 2>/dev/null`;
    const dylibs = execSync(findCmd, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
    for (const lib of dylibs) {
      execFileSync('codesign', ['--force', '--sign', '-', lib], { stdio: 'pipe', timeout: 10_000 });
    }
    console.log(`[afterPack] Signed ${dylibs.length} dylibs/shared objects.`);

    // Sign executables in Resources (postgres/bin/*, gws/*, code-server/bin/*)
    const binDirs = ['postgres/bin', 'gws', 'code-server/bin'];
    let binCount = 0;
    for (const dir of binDirs) {
      const findBins = `find "${appPath}/Contents/Resources/${dir}" -type f -perm +111 2>/dev/null`;
      try {
        const bins = execSync(findBins, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
        for (const bin of bins) {
          execFileSync('codesign', ['--force', '--sign', '-', bin], { stdio: 'pipe', timeout: 10_000 });
          binCount++;
        }
      } catch { /* dir may not exist */ }
    }
    console.log(`[afterPack] Signed ${binCount} resource executables.`);

    // Sign frameworks
    const fwFind = `find "${appPath}/Contents/Frameworks" -name "*.framework" -maxdepth 1 2>/dev/null`;
    const frameworks = execSync(fwFind, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
    for (const fw of frameworks) {
      execFileSync('codesign', ['--force', '--sign', '-', fw], { stdio: 'pipe', timeout: 30_000 });
    }
    console.log(`[afterPack] Signed ${frameworks.length} frameworks.`);

    // Finally sign the app bundle itself
    execFileSync('codesign', ['--force', '--sign', '-', appPath], {
      stdio: 'inherit',
      timeout: 120_000,
    });
    console.log('[afterPack] Ad-hoc re-sign complete.');
  } catch (err) {
    console.warn('[afterPack] Ad-hoc re-sign failed (non-fatal):', err.message);
  }
}
