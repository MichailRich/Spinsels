import { NextRequest, NextResponse } from "next/server";
import { parseFilters } from "@/lib/filters";
import { searchCases } from "@/lib/search/query";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const f = parseFilters(sp);
  const res = await searchCases(f, { page: Number(sp.get("page") ?? 1), pageSize: Number(sp.get("size") ?? 25), sort: sp.get("sort") ?? undefined });
  return NextResponse.json(res);
}
