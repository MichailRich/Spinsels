import { NextRequest, NextResponse } from "next/server";
import { parseFilters } from "@/lib/filters";
import { computeStats } from "@/lib/stats";

export async function GET(req: NextRequest) {
  const f = parseFilters(req.nextUrl.searchParams);
  return NextResponse.json(await computeStats(f), { headers: { "Cache-Control": "private, max-age=60" } });
}
