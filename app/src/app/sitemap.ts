import type { MetadataRoute } from "next";
import { q } from "@/lib/db";
import { OFFENSES } from "@/lib/reference/offenses";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL ?? "https://politierechter.nl";
  const pages = ["", "/zoeken", "/delicten", "/statistieken", "/vergelijker", "/uitspraken", "/over"].map((p) => ({ url: `${base}${p}`, changeFrequency: "daily" as const, priority: p === "" ? 1 : 0.8 }));
  const delicten = OFFENSES.map((o) => ({ url: `${base}/delicten/${o.code}`, changeFrequency: "weekly" as const, priority: 0.7 }));
  const docs = await q<{ ecli: string; d: string }>("SELECT ecli, to_char(fetched_at,'YYYY-MM-DD') d FROM documents WHERE is_politierechter");
  return [...pages, ...delicten, ...docs.map((r) => ({ url: `${base}/uitspraak/${encodeURIComponent(r.ecli)}`, lastModified: r.d, priority: 0.5 }))];
}
