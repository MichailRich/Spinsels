// Importpipeline voor Rechtspraak-uitspraken.
//
//  1. discover  — vindt kandidaat-ECLI's (politierechter, strafrecht, rechtbanken)
//                 a) via de zoekdienst van uitspraken.rechtspraak.nl (alleen ECLI-lijsten)
//                 b) incrementeel via de Open Data-feed (gewijzigd sinds laatste run)
//  2. fetch     — haalt per ECLI het volledige document op via de Open Data API,
//                 herkent politierechtervonnissen en bewaart de brontekst (met versiebeheer)
//  3. extract   — zie src/lib/extract
//
// Alle stappen zijn idempotent en herstartbaar: de status staat in de database.

import { q, q1, tx } from "../db";
import { politeFetch, mapPool } from "./http";
import { parseRechtspraakXml, detectPolitierechter } from "./parse-xml";
import { COURT_BY_CODE } from "../reference/courts";

const SEARCH_URL = "https://uitspraken.rechtspraak.nl/api/zoek";
const OPEN_DATA = "https://data.rechtspraak.nl/uitspraken";

export type Log = (msg: string) => void;

async function startRun(kind: string, source: string | null) {
  const r = await q1<{ id: string }>(
    "INSERT INTO import_runs(kind, source_code) VALUES ($1,$2) RETURNING id",
    [kind, source],
  );
  return Number(r!.id);
}
async function finishRun(id: number, status: string, stats: unknown, error?: string, cursor?: unknown) {
  await q(
    "UPDATE import_runs SET finished_at=now(), status=$2, stats=$3, error=$4, cursor=COALESCE($5, cursor) WHERE id=$1",
    [id, status, JSON.stringify(stats), error ?? null, cursor ? JSON.stringify(cursor) : null],
  );
}

type SearchResult = {
  TitelEmphasis: string;
  Uitspraakdatum: string;
  Publicatiedatum: string;
  Proceduresoorten?: string[];
};

function nlDate(d: string | undefined): string | null {
  if (!d) return null;
  const m = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function searchBody(startRow: number, pageSize: number, extra: Record<string, unknown> = {}) {
  return {
    StartRow: startRow,
    PageSize: pageSize,
    ShouldReturnHighlights: false,
    ShouldCountFacets: false,
    SortOrder: "PublicatieDatumDesc",
    SearchTerms: [{ Term: "politierechter", Field: "AlleVelden" }],
    Contentsoorten: [{ NodeType: "Contentsoort", Identifier: "uitspraak", level: 1 }],
    Rechtsgebieden: [{ NodeType: "Rechtsgebied", Identifier: "http://psi.rechtspraak.nl/rechtsgebied#strafrecht", level: 1 }],
    Instanties: [{ NodeType: "InstantieType", Identifier: "Spirit.Npi.Ecli.Domain.Rechtbank", level: 1 }],
    DatumPublicatie: [],
    DatumUitspraak: [],
    Advanced: { PublicatieStatus: "AlleenGepubliceerd" },
    CorrelationId: "politierechter-nl-import",
    Proceduresoorten: [],
    ...extra,
  };
}

/**
 * Ontdekt kandidaat-politierechterzaken via de zoekdienst (ECLI-lijsten).
 * Stopt bij `stopAfterKnownPages` pagina's achter elkaar zonder nieuwe ECLI's
 * (incrementeel), tenzij `full` is gezet.
 */
export async function discoverViaSearch(opts: { full?: boolean; maxPages?: number; log?: Log } = {}) {
  const log = opts.log ?? console.log;
  const runId = await startRun("discover", "rechtspraak-zoekdienst");
  const pageSize = 100;
  let start = 0;
  let total = Infinity;
  let added = 0;
  let seen = 0;
  let pagesWithoutNew = 0;
  try {
    for (let page = 0; start < total && page < (opts.maxPages ?? 10_000); page++) {
      const res = await politeFetch(SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(searchBody(start, pageSize)),
        minIntervalMs: 1200,
      });
      if (!res.ok) throw new Error(`Zoekdienst HTTP ${res.status}`);
      const data = (await res.json()) as { ResultCount: number; Results: SearchResult[] };
      total = data.ResultCount;
      if (!data.Results?.length) break;
      let newOnPage = 0;
      for (const r of data.Results) {
        const ecli = r.TitelEmphasis?.trim();
        if (!ecli?.startsWith("ECLI:NL:RB")) continue;
        seen++;
        const ins = await q(
          `INSERT INTO discovered_eclis (ecli, source_code, decision_date, publication_date, procedure_hint)
           VALUES ($1,'rechtspraak-zoekdienst',$2,$3,$4) ON CONFLICT (ecli) DO NOTHING RETURNING ecli`,
          [ecli, nlDate(r.Uitspraakdatum), nlDate(r.Publicatiedatum), r.Proceduresoorten?.join(", ") ?? null],
        );
        if (ins.length) {
          added++;
          newOnPage++;
        }
      }
      log(`zoekdienst: pagina ${page + 1}, ${start + data.Results.length}/${total}, nieuw ${added}`);
      pagesWithoutNew = newOnPage ? 0 : pagesWithoutNew + 1;
      if (!opts.full && pagesWithoutNew >= 3) {
        log("zoekdienst: geen nieuwe ECLI's meer — incrementele synchronisatie klaar");
        break;
      }
      start += pageSize;
    }
    await finishRun(runId, "ok", { seen, added, total });
  } catch (e) {
    await finishRun(runId, "error", { seen, added, total }, String(e), { start });
    throw e;
  }
  return { seen, added, total };
}

/**
 * Incrementele synchronisatie via de Open Data-feed: alle strafrechtuitspraken
 * van rechtbanken die sinds `since` zijn gewijzigd/gepubliceerd.
 */
export async function discoverViaOpenData(opts: { since?: string; log?: Log } = {}) {
  const log = opts.log ?? console.log;
  const last = await q1<{ cursor: { since: string } }>(
    "SELECT cursor FROM import_runs WHERE kind='discover' AND source_code='rechtspraak-open-data' AND status='ok' ORDER BY id DESC LIMIT 1",
  );
  const since =
    opts.since ?? last?.cursor?.since ?? new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  const runId = await startRun("discover", "rechtspraak-open-data");
  const startedAt = new Date().toISOString().slice(0, 19);
  let from = 0;
  let added = 0;
  let seen = 0;
  try {
    for (;;) {
      const url =
        `${OPEN_DATA}/zoeken?type=Uitspraak&subject=http://psi.rechtspraak.nl/rechtsgebied%23strafrecht` +
        `&modified=${encodeURIComponent(since)}&max=1000&from=${from}&sort=ASC`;
      const res = await politeFetch(url, { minIntervalMs: 1000 });
      const xml = await res.text();
      const ids = [...xml.matchAll(/<id>(ECLI:NL:RB[^<]+)<\/id>/g)].map((m) => m[1]);
      const entries = (xml.match(/<entry>/g) ?? []).length;
      for (const ecli of ids) {
        seen++;
        const ins = await q(
          `INSERT INTO discovered_eclis (ecli, source_code) VALUES ($1,'rechtspraak-open-data')
           ON CONFLICT (ecli) DO NOTHING RETURNING ecli`,
          [ecli],
        );
        if (ins.length) added++;
      }
      log(`open data: ${from + entries} verwerkt, rechtbank-ECLI's ${seen}, nieuw ${added}`);
      if (entries < 1000) break;
      from += 1000;
    }
    await finishRun(runId, "ok", { seen, added, since }, undefined, { since: startedAt });
  } catch (e) {
    await finishRun(runId, "error", { seen, added, since }, String(e));
    throw e;
  }
  return { seen, added };
}

/** Haalt openstaande ECLI's op, herkent politierechtervonnissen en slaat bronteksten op. */
export async function fetchPending(opts: { limit?: number; concurrency?: number; log?: Log; refetch?: boolean } = {}) {
  const log = opts.log ?? console.log;
  const runId = await startRun("fetch", "rechtspraak-open-data");
  const rows = await q<{ ecli: string }>(
    `SELECT ecli FROM discovered_eclis
     WHERE ${opts.refetch ? "fetch_status IN ('fetched','pending','error')" : "fetch_status IN ('pending','error') AND attempts < 5"}
     ORDER BY (CASE WHEN procedure_hint ~ '(enkelvoudig|Mondelinge|Proces-verbaal|Eerste en enige)' OR procedure_hint IS NULL OR procedure_hint = 'Op tegenspraak' THEN 0
                    WHEN procedure_hint ~ '(Raadkamer|Wraking|Verschoning|Beschikking|Rekest)' THEN 2 ELSE 1 END),
              publication_date DESC NULLS LAST, ecli LIMIT $1`,
    [opts.limit ?? 100_000],
  );
  const stats = { total: rows.length, politierechter: 0, skipped: 0, errors: 0, updated: 0, unchanged: 0 };
  let done = 0;
  await mapPool(rows, opts.concurrency ?? 3, async ({ ecli }) => {
    try {
      const r = await storeEcli(ecli);
      if (r === "skipped") stats.skipped++;
      else {
        stats.politierechter++;
        if (r === "updated") stats.updated++;
        if (r === "unchanged") stats.unchanged++;
      }
    } catch (e) {
      stats.errors++;
      await q(
        "UPDATE discovered_eclis SET fetch_status='error', attempts=attempts+1, last_fetch_at=now(), error=$2 WHERE ecli=$1",
        [ecli, String(e).slice(0, 500)],
      );
    }
    done++;
    if (done % 50 === 0) log(`fetch: ${done}/${rows.length} — politierechter ${stats.politierechter}, overgeslagen ${stats.skipped}, fouten ${stats.errors}`);
  });
  await finishRun(runId, stats.errors ? "partial" : "ok", stats);
  log(`fetch klaar: ${JSON.stringify(stats)}`);
  return stats;
}

export async function storeEcli(ecli: string): Promise<"new" | "updated" | "unchanged" | "skipped"> {
  const res = await politeFetch(`${OPEN_DATA}/content?id=${encodeURIComponent(ecli)}`, { minIntervalMs: 300 });
  if (res.status === 404) {
    await q("UPDATE discovered_eclis SET fetch_status='skipped', last_fetch_at=now(), error='niet gevonden (404)' WHERE ecli=$1", [ecli]);
    return "skipped";
  }
  if (!res.ok) throw new Error(`Open Data HTTP ${res.status}`);
  const xml = await res.text();
  const p = parseRechtspraakXml(xml);
  if (!p.ecli) throw new Error("Geen ECLI in document");
  const det = detectPolitierechter(p);
  const isStraf = p.subjects.some((s) => /strafrecht/i.test(s));
  if (!det.is || !isStraf || !p.hasDecisionText) {
    await q(
      "UPDATE discovered_eclis SET fetch_status='skipped', attempts=attempts+1, last_fetch_at=now(), error=$2 WHERE ecli=$1",
      [ecli, !p.hasDecisionText ? "geen uitspraaktekst" : !isStraf ? "geen strafrecht" : "geen politierechtervonnis"],
    );
    return "skipped";
  }
  const court = COURT_BY_CODE.get(p.courtCode);
  if (!court) {
    await q("UPDATE discovered_eclis SET fetch_status='skipped', error=$2 WHERE ecli=$1", [ecli, `onbekende instantie ${p.courtCode}`]);
    return "skipped";
  }
  const result = await tx(async (c) => {
    const existing = await c.query<{ content_hash: string; version: number; full_text: string; source_modified: string }>(
      "SELECT content_hash, version, full_text, source_modified FROM documents WHERE ecli=$1 FOR UPDATE",
      [ecli],
    );
    const prev = existing.rows[0];
    if (prev && prev.content_hash === p.contentHash) return "unchanged" as const;
    if (prev) {
      // versiebeheer: bewaar vorige brontekst
      await c.query(
        "INSERT INTO document_versions (ecli, version, content_hash, source_modified, full_text) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
        [ecli, prev.version, prev.content_hash, prev.source_modified, prev.full_text],
      );
    }
    await c.query(
      `INSERT INTO documents (ecli, source_code, court_code, decision_date, publication_date, source_modified, zaaknummer, procedure,
         subjects, title, inhoudsindicatie, full_text, sections, deeplink, content_hash, version, is_politierechter, politierechter_evidence, search)
       VALUES ($1,'rechtspraak-open-data',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,1,true,$15,
         setweight(to_tsvector('dutch', coalesce($10,'')), 'A') || setweight(to_tsvector('dutch', $11), 'B'))
       ON CONFLICT (ecli) DO UPDATE SET decision_date=EXCLUDED.decision_date, publication_date=EXCLUDED.publication_date,
         source_modified=EXCLUDED.source_modified, zaaknummer=EXCLUDED.zaaknummer, procedure=EXCLUDED.procedure,
         subjects=EXCLUDED.subjects, title=EXCLUDED.title, inhoudsindicatie=EXCLUDED.inhoudsindicatie, full_text=EXCLUDED.full_text,
         sections=EXCLUDED.sections, content_hash=EXCLUDED.content_hash, version=documents.version+1, fetched_at=now(),
         politierechter_evidence=EXCLUDED.politierechter_evidence, search=EXCLUDED.search`,
      [ecli, p.courtCode, p.decisionDate, p.publicationDate, p.modified, p.zaaknummer, p.procedure, p.subjects, p.title,
        p.inhoudsindicatie, p.fullText, JSON.stringify(p.sections), p.deeplink, p.contentHash, det.evidence],
    );
    await c.query(
      "UPDATE discovered_eclis SET fetch_status='fetched', attempts=attempts+1, last_fetch_at=now(), error=NULL, decision_date=COALESCE(decision_date,$2) WHERE ecli=$1",
      [ecli, p.decisionDate],
    );
    return prev ? ("updated" as const) : ("new" as const);
  });
  if (result === "unchanged") {
    await q("UPDATE discovered_eclis SET fetch_status='fetched', last_fetch_at=now() WHERE ecli=$1", [ecli]);
  }
  return result;
}
