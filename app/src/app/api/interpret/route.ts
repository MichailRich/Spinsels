import { NextRequest, NextResponse } from "next/server";
import { interpret } from "@/lib/search/nlq";

export async function GET(req: NextRequest) {
  return NextResponse.json(interpret((req.nextUrl.searchParams.get("text") ?? "").slice(0, 500)));
}
