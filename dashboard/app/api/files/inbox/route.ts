import { NextResponse } from "next/server";
import {
  scanDirectory,
  classifyFile,
  loadKnownAccounts,
  loadInboxState,
  INBOX_DIR,
  DOWNLOADS_DIR,
} from "@/lib/file-classification";

export async function GET() {
  const [inboxFiles, downloadFiles, accounts, inboxState] = await Promise.all([
    scanDirectory(INBOX_DIR),
    scanDirectory(DOWNLOADS_DIR),
    loadKnownAccounts(),
    loadInboxState(),
  ]);

  const allFiles = [...inboxFiles, ...downloadFiles];

  const items = allFiles.map((file) => {
    const classification = classifyFile(file, accounts);
    const status = inboxState[file.absolutePath] ?? "pending";
    return { file, classification, status };
  });

  const pending = items.filter((i) => i.status === "pending");
  const autoFiled = items.filter((i) => i.status === "auto-filed");

  return NextResponse.json({
    items,
    counts: {
      pending: pending.length,
      autoFiled: autoFiled.length,
      total: items.length,
    },
  });
}
