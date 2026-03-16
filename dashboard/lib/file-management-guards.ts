import path from "path";

const ALLOWED_ROOTS = [
  "/Volumes/Storage/Home-Overflow",
  path.join(process.env.HOME ?? "/Users/cderamos", "Library/CloudStorage/GoogleDrive-christian@visualgraphx.com"),
  path.join(process.env.HOME ?? "/Users/cderamos", "Downloads"),
];

/**
 * Validates that an absolute path is within one of the allowed storage roots.
 * Returns the resolved path if valid, null if outside allowed roots.
 */
export function guardPath(absolutePath: string): string | null {
  const resolved = path.resolve(absolutePath);
  const isAllowed = ALLOWED_ROOTS.some(
    (root) => resolved === root || resolved.startsWith(root + path.sep)
  );
  return isAllowed ? resolved : null;
}

/**
 * Validates both source and destination paths.
 * Returns { src, dst } with resolved paths, or throws with descriptive error.
 */
export function guardMovePaths(src: string, dst: string): { src: string; dst: string } {
  const resolvedSrc = guardPath(src);
  if (!resolvedSrc) {
    throw new Error(`Source path outside allowed storage: ${src}`);
  }
  const resolvedDst = guardPath(dst);
  if (!resolvedDst) {
    throw new Error(`Destination path outside allowed storage: ${dst}`);
  }
  return { src: resolvedSrc, dst: resolvedDst };
}

export { ALLOWED_ROOTS };
