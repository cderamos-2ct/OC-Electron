import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = process.env.OPENCLAW_DATA_DIR ?? "/Volumes/Storage/OpenClaw-Data";

const TEXT_EXTENSIONS = new Set([
  ".md", ".json", ".jsonl", ".txt", ".yml", ".yaml",
  ".csv", ".py", ".ts", ".js", ".sh", ".toml",
]);

function resolveAndGuard(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const resolved = path.resolve(DATA_DIR, normalized);
  const base = path.resolve(DATA_DIR);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    return null;
  }
  return resolved;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawPath = searchParams.get("path");

  if (!rawPath) {
    return NextResponse.json({ error: "path parameter is required" }, { status: 400 });
  }

  const resolved = resolveAndGuard(rawPath);
  if (!resolved) {
    return NextResponse.json({ error: "Forbidden: path traversal detected" }, { status: 403 });
  }

  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(resolved);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (!stat.isFile()) {
    return NextResponse.json({ error: "Path is not a file" }, { status: 400 });
  }

  const base = path.resolve(DATA_DIR);
  const displayPath = "/" + path.relative(base, resolved).replace(/\\/g, "/");
  const name = path.basename(resolved);
  const ext = path.extname(name).toLowerCase();
  const modified = stat.mtime.toISOString();
  const size = stat.size;

  if (!TEXT_EXTENSIONS.has(ext)) {
    return NextResponse.json({ path: displayPath, name, binary: true, size, modified });
  }

  let content: string;
  try {
    content = await fs.readFile(resolved, "utf-8");
  } catch {
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }

  return NextResponse.json({ path: displayPath, name, size, modified, content });
}
