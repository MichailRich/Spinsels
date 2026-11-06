import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPool, q } from "../src/lib/db";
import { COURTS } from "../src/lib/reference/courts";
import { OFFENSES, GROUPS } from "../src/lib/reference/offenses";
import { ARTICLES } from "../src/lib/reference/articles";
import { SOURCES } from "../src/lib/reference/sources";

async function main() {
  const dir = join(__dirname, "..", "db", "migrations");
  await q("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const done = await q("SELECT 1 FROM schema_migrations WHERE name=$1", [f]);
    if (done.length) continue;
    try {
      await q(readFileSync(join(dir, f), "utf8"));
      await q("INSERT INTO schema_migrations(name) VALUES ($1)", [f]);
      console.log("migratie toegepast:", f);
    } catch (e) {
      if (f.includes("vector")) console.warn(`optionele migratie ${f} overgeslagen: ${(e as Error).message}`);
      else throw e;
    }
  }
  // referentiegegevens (idempotent)
  for (const s of SOURCES) {
    await q(
      `INSERT INTO sources (code,name,url,access_method,license,terms_note,rate_limit_ms) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (code) DO UPDATE SET name=$2,url=$3,access_method=$4,license=$5,terms_note=$6,rate_limit_ms=$7`,
      [s.code, s.name, s.url, s.access_method, s.license, s.terms_note, s.rate_limit_ms],
    );
  }
  for (const c of COURTS) {
    await q(
      `INSERT INTO courts (code,name,current_code,seat,lat,lon,historical,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (code) DO UPDATE SET name=$2,current_code=$3,seat=$4,lat=$5,lon=$6,historical=$7,note=$8`,
      [c.code, c.name, c.currentCode, c.seat, c.lat, c.lon, c.historical, c.note ?? null],
    );
  }
  let i = 0;
  for (const o of OFFENSES) {
    await q(
      `INSERT INTO offense_categories (code,group_code,group_label,label,description,articles,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (code) DO UPDATE SET group_code=$2,group_label=$3,label=$4,description=$5,articles=$6,sort_order=$7`,
      [o.code, o.group, GROUPS[o.group], o.label, o.description, o.articles, i++],
    );
  }
  for (const a of ARTICLES) {
    await q(
      `INSERT INTO legal_articles (code,law,bwb_id,article,title,history) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (code) DO UPDATE SET law=$2,bwb_id=$3,article=$4,title=$5,history=$6`,
      [a.code, a.law, a.bwbId, a.article, a.title, JSON.stringify(a.history)],
    );
  }
  console.log("referentiegegevens bijgewerkt");
  await getPool().end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
