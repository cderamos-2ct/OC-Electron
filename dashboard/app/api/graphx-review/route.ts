import { NextResponse } from "next/server";
import { getGraphxReviewSnapshot } from "@/lib/graphx-review-store";

export async function GET() {
  return NextResponse.json(getGraphxReviewSnapshot());
}
