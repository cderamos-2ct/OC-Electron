import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = process.env.OPENCLAW_DATA_DIR ?? "/Volumes/Storage/OpenClaw-Data";

function resolveAndGuard(relativePath: string): string | null {
  // Normalize and strip leading slashes so path.resolve doesn't treat it as absolute
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const resolved = path.resolve(DATA_DIR, normalized);
  // Guard: resolved path must be within DATA_DIR
  const base = path.resolve(DATA_DIR);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    return null;
  }
  return resolved;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawPath = searchParams.get("path") ?? "/";
  const depth = Math.min(Math.max(parseInt(searchParams.get("depth") ?? "1", 10), 1), 5);

  const resolved = resolveAndGuard(rawPath);
  if (!resolved) {
    return NextResponse.json({ error: "Forbidden: path traversal detected" }, { status: 403 });
  }

  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(resolved);
  } catch {
    return NextResponse.json({ error: "Path not found" }, { status: 404 });
  }

  if (!stat.isDirectory()) {
    return NextResponse.json({ error: "Path is not a directory" }, { status: 400 });
  }

  // Normalize the display path
  const base = path.resolve(DATA_DIR);
  const displayPath = "/" + path.relative(base, resolved).replace(/\\/g, "/");

  const entries = await listEntries(resolved, depth);

  return NextResponse.json({ path: displayPath, entries });
}

interface FileEntry {
  name: string;
  type: "file" | "directory";
  size?: number;
  modified: string;
}

async function listEntries(dirPath: string, depth: number): Promise<FileEntry[]> {
  let names: string[];
  try {
    names = await fs.readdir(dirPath);
  } catch {
    return [];
  }

  const entries: FileEntry[] = [];

  for (const name of names) {
    // Skip hidden files
    if (name.startsWith(".")) continue;

    const full = path.join(dirPath, name);
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(full);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      entries.push({
        name,
        type: "directory",
        modified: stat.mtime.toISOString(),
      });
    } else {
      entries.push({
        name,
        type: "file",
        size: stat.size,
        modified: stat.mtime.toISOString(),
      });
    }
  }

  // Sort: directories first, then files, both alphabetically
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return entries;
}
