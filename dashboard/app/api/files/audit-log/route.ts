import { NextRequest, NextResponse } from "next/server";
import { readAuditLog, todayString } from "@/lib/file-classification";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? todayString();
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const entries = await readAuditLog(date, limit, offset);

  return NextResponse.json({ entries, date });
}
