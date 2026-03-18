#!/usr/bin/env node
/**
 * generate-icon-ico.mjs
 * Generates assets/icons/icon.ico from assets/icons/icon.png.
 *
 * Usage:
 *   node scripts/generate-icon-ico.mjs
 *
 * Requires one of:
 *   pnpm add -D png-to-ico   (preferred, pure JS)
 *   pnpm add -D sharp         (alternative)
 *
 * If neither package is installed this script prints manual instructions
 * and exits with code 0 so CI does not break (icon.ico is only required
 * for Windows builds).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcPng = path.join(root, 'assets', 'icons', 'icon.png');
const destIco = path.join(root, 'assets', 'icons', 'icon.ico');

if (!existsSync(srcPng)) {
  console.error(`[generate-icon-ico] Source PNG not found: ${srcPng}`);
  process.exit(1);
}

if (existsSync(destIco)) {
  console.log(`[generate-icon-ico] icon.ico already exists — skipping. Delete it to regenerate.`);
  process.exit(0);
}

const require = createRequire(import.meta.url);

// ── Attempt 1: png-to-ico ────────────────────────────────────────────────────
let pngToIco;
try {
  pngToIco = require('png-to-ico');
} catch {
  pngToIco = null;
}

if (pngToIco) {
  console.log('[generate-icon-ico] Using png-to-ico…');
  try {
    const buf = await pngToIco(srcPng);
    writeFileSync(destIco, buf);
    console.log(`[generate-icon-ico] Written: ${destIco}`);
    process.exit(0);
  } catch (err) {
    console.error('[generate-icon-ico] png-to-ico failed:', err.message);
    process.exit(1);
  }
}

// ── Attempt 2: sharp ─────────────────────────────────────────────────────────
let sharp;
try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

if (sharp) {
  console.log('[generate-icon-ico] Using sharp (produces single-size ICO)…');
  try {
    // ICO files are simply BMP/PNG inside a container; for a basic single-res
    // ICO we write a 256×256 PNG-based ICO manually using a minimal header.
    const sizes = [16, 32, 48, 64, 128, 256];
    const pngs = await Promise.all(
      sizes.map((s) =>
        sharp(srcPng).resize(s, s).png().toBuffer()
      )
    );

    // Build ICO manually (ICONDIR + ICONDIRENTRYs + image data)
    const ICONDIR_SIZE = 6;
    const ICONDIRENTRY_SIZE = 16;
    const headerSize = ICONDIR_SIZE + sizes.length * ICONDIRENTRY_SIZE;

    let dataOffset = headerSize;
    const entries = pngs.map((buf, i) => {
      const entry = { size: sizes[i], buf, offset: dataOffset };
      dataOffset += buf.length;
      return entry;
    });

    const totalSize = dataOffset;
    const ico = Buffer.alloc(totalSize);

    // ICONDIR
    ico.writeUInt16LE(0, 0);           // reserved
    ico.writeUInt16LE(1, 2);           // type: 1 = ICO
    ico.writeUInt16LE(sizes.length, 4); // count

    // ICONDIRENTRY array
    let pos = ICONDIR_SIZE;
    for (const { size, buf, offset } of entries) {
      ico.writeUInt8(size === 256 ? 0 : size, pos);      // width (0 = 256)
      ico.writeUInt8(size === 256 ? 0 : size, pos + 1);  // height
      ico.writeUInt8(0, pos + 2);   // color count
      ico.writeUInt8(0, pos + 3);   // reserved
      ico.writeUInt16LE(1, pos + 4); // planes
      ico.writeUInt16LE(32, pos + 6); // bit count
      ico.writeUInt32LE(buf.length, pos + 8);  // size of image data
      ico.writeUInt32LE(offset, pos + 12);     // offset of image data
      pos += ICONDIRENTRY_SIZE;
    }

    // Image data
    for (const { buf, offset } of entries) {
      buf.copy(ico, offset);
    }

    writeFileSync(destIco, ico);
    console.log(`[generate-icon-ico] Written: ${destIco}`);
    process.exit(0);
  } catch (err) {
    console.error('[generate-icon-ico] sharp failed:', err.message);
    process.exit(1);
  }
}

// ── No converter available ────────────────────────────────────────────────────
console.warn(`
[generate-icon-ico] No ICO converter found.

To generate icon.ico automatically, install one of:
  pnpm add -D png-to-ico        # pure JS, recommended
  pnpm add -D sharp             # native bindings

Manual alternative (macOS/Linux with ImageMagick):
  convert assets/icons/icon.png \\
    -define icon:auto-resize=256,128,64,48,32,16 \\
    assets/icons/icon.ico

Manual alternative (online):
  https://convertico.com  — upload icon.png, download icon.ico, save to
  apps/openclaw-shell/assets/icons/icon.ico

Windows builds will fail until icon.ico is present.
`);
// Exit 0 so non-Windows CI steps are not blocked.
process.exit(0);
