// Export/import van de brondocumenten (Open Data-teksten) als gecomprimeerde JSONL,
// zodat een nieuwe installatie zonder volledige herimport kan starten. Afgeleide gegevens
// worden na import opnieuw berekend met de extractor (reproduceerbaar).
import { createGzip, createGunzip } from "node:zlib";
import { createReadStream, createWriteStream, existsSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { q, getPool } from "../src/lib/db";
import { extractAll } from "../src/lib/extract/run";

const FILE = "data/seed/documents.jsonl.gz";

export async function exportSeed() {
  mkdirSync("data/seed", { recursive: true });
  const out = createGzip({ level: 9 });
  const ws = createWriteStream(FILE);
  out.pipe(ws);
  const rows = await q(
    "SELECT ecli, source_code, court_code, to_char(decision_date,'YYYY-MM-DD') decision_date, to_char(publication_date,'YYYY-MM-DD') publication_date, source_modified, zaaknummer, procedure, subjects, title, inhoudsindicatie, full_text, sections, deeplink, content_hash, version, politierechter_evidence FROM documents WHERE is_politierechter ORDER BY ecli",
  );
  for (const r of rows) out.write(JSON.stringify(r) + "\n");
  out.end();
  await new Promise((r) => ws.on("finish", r));
  console.log(`export: ${rows.length} documenten → ${FILE}`);
}

export async function importSeed() {
  if (!existsSync(FILE)) return console.log("geen seed-bestand gevonden; gebruik `npm run import:all`");
  const rl = createInterface({ input: createReadStream(FILE).pipe(createGunzip()), crlfDelay: Infinity });
  let n = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const d = JSON.parse(line);
    await q(
      `INSERT INTO documents (ecli, source_code, court_code, decision_date, publication_date, source_modified, zaaknummer, procedure, subjects, title, inhoudsindicatie, full_text, sections, deeplink, content_hash, version, is_politierechter, politierechter_evidence, search)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true,$17, setweight(to_tsvector('dutch', coalesce($11,'')), 'A') || setweight(to_tsvector('dutch', $12), 'B'))
       ON CONFLICT (ecli) DO NOTHING`,
      [d.ecli, d.source_code, d.court_code, d.decision_date, d.publication_date, d.source_modified, d.zaaknummer, d.procedure, d.subjects, d.title, d.inhoudsindicatie, d.full_text, JSON.stringify(d.sections), d.deeplink, d.content_hash, d.version, d.politierechter_evidence],
    );
    await q("INSERT INTO discovered_eclis (ecli, source_code, fetch_status, decision_date) VALUES ($1,'rechtspraak-open-data','fetched',$2) ON CONFLICT DO NOTHING", [d.ecli, d.decision_date]);
    n++;
  }
  console.log(`seed: ${n} documenten geïmporteerd; extractie start`);
  await extractAll({ onlyMissing: true });
}

if (process.argv[1]?.endsWith("seed-data.ts")) {
  (async () => {
    if (process.argv.includes("export")) await exportSeed();
    else await importSeed();
    await getPool().end();
  })();
}
