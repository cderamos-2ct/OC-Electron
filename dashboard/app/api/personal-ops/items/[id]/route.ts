import { NextResponse } from "next/server";
import { getPersonalOpsItemDetail } from "@/lib/personal-ops-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const detail = getPersonalOpsItemDetail(id);

  if (!detail) {
    return NextResponse.json({ error: "Personal ops item not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
