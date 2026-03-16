import { NextResponse } from "next/server";
import { getPersonalOpsSnapshot } from "@/lib/personal-ops-store";

export async function GET() {
  return NextResponse.json(getPersonalOpsSnapshot());
}
