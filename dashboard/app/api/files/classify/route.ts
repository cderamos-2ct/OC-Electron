import { NextRequest, NextResponse } from "next/server";
import { guardPath } from "@/lib/file-management-guards";
import {
  scanDirectory,
  classifyFile,
  loadKnownAccounts,
} from "@/lib/file-classification";

export async function POST(req: NextRequest) {
  let body: { path: string; recursive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const resolved = guardPath(body.path);
  if (!resolved) {
    return NextResponse.json(
      { error: "Path outside allowed storage" },
      { status: 403 }
    );
  }

  const accounts = await loadKnownAccounts();
  const files = await scanDirectory(resolved, {
    recursive: body.recursive ?? false,
  });

  const results = files.map((file) => classifyFile(file, accounts));

  return NextResponse.json({ results });
}
