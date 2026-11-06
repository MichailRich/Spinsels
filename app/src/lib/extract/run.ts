// Voert de extractie uit en schrijft de resultaten (gescheiden van de brontekst) weg.
// Handmatig geverifieerde/gecorrigeerde gegevens worden NOOIT overschreven.

import { q, tx } from "../db";
import { extractDocument, EXTRACTOR } from "./index";

export async function extractOne(ecli: string): Promise<void> {
  const [d] = await q<{ ecli: string; full_text: string; sections: never; inhoudsindicatie: string | null }>(
    "SELECT ecli, full_text, sections, inhoudsindicatie FROM documents WHERE ecli=$1",
    [ecli],
  );
  if (!d) return;
  const x = extractDocument({ ecli: d.ecli, fullText: d.full_text, sections: d.sections, inhoudsindicatie: d.inhoudsindicatie });
  const p = x.profile;
  await tx(async (c) => {
    const locked = await c.query<{ review_status: string }>("SELECT review_status FROM case_profiles WHERE ecli=$1", [ecli]);
    const profileLocked = locked.rows[0] && locked.rows[0].review_status !== "auto";

    await c.query("DELETE FROM case_offenses WHERE ecli=$1 AND review_status='auto'", [ecli]);
    await c.query("DELETE FROM sentence_components WHERE ecli=$1 AND review_status='auto'", [ecli]);
    await c.query("DELETE FROM circumstances WHERE ecli=$1 AND review_status='auto'", [ecli]);
    const manual = await c.query<{ t: string }>(
      `SELECT 'off' t FROM case_offenses WHERE ecli=$1 UNION ALL SELECT 'sen' FROM sentence_components WHERE ecli=$1 UNION ALL SELECT 'cir' FROM circumstances WHERE ecli=$1`,
      [ecli],
    );
    const has = (t: string) => manual.rows.some((r) => r.t === t);

    if (!has("off")) {
      for (const o of x.offenses) {
        await c.query(
          `INSERT INTO case_offenses (ecli, feit_nr, role, category_code, qualification, articles, evidence, evidence_start, evidence_end, extractor, confidence)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [ecli, o.feitNr, o.role, o.category, o.qualification, o.articles, o.evidence, o.evidenceStart >= 0 ? o.evidenceStart : null, o.evidenceEnd >= 0 ? o.evidenceEnd : null, EXTRACTOR, o.confidence],
        );
      }
    }
    if (!has("sen")) {
      for (const [origin, list] of [["opgelegd", x.imposed], ["eis_om", x.demanded]] as const) {
        for (const s of list) {
          await c.query(
            `INSERT INTO sentence_components (ecli, origin, kind, amount, unit, conditional, probation_months, substitute_days, description, evidence, evidence_start, evidence_end, extractor, confidence)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [ecli, origin, s.kind, s.amount, s.unit, s.conditional, s.probationMonths, s.substituteDays, s.description, s.evidence, s.evidenceStart >= 0 ? s.evidenceStart : null, s.evidenceEnd >= 0 ? s.evidenceEnd : null, EXTRACTOR, s.confidence],
          );
        }
      }
    }
    if (!has("cir")) {
      for (const k of x.circumstances) {
        await c.query(
          `INSERT INTO circumstances (ecli, code, polarity, status, evidence, evidence_start, evidence_end, extractor, confidence)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [ecli, k.code, k.polarity, k.status, k.evidence, k.evidenceStart, k.evidenceEnd, EXTRACTOR, k.confidence],
        );
      }
    }
    if (!profileLocked) {
      await c.query(
        `INSERT INTO case_profiles (ecli, primary_category, categories, articles, offense_count, multi_offense, acquittal, outcome, recidive, letsel, bekentenis,
           wapen, hulpverlener, huiselijk, alcohol_ugl, taakstraf_uren, gev_onvw_dagen, gev_vw_dagen, geldboete_euro, ontzegging_maanden,
           eis_taakstraf_uren, eis_gev_onvw_dagen, eis_gev_vw_dagen, eis_geldboete_euro, eis_ontzegging_maanden, sentence_summary, eis_summary,
           motivation, motivation_start, facts_summary, extraction_quality, extractor, extracted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32, now())
         ON CONFLICT (ecli) DO UPDATE SET primary_category=$2, categories=$3, articles=$4, offense_count=$5, multi_offense=$6, acquittal=$7, outcome=$8,
           recidive=$9, letsel=$10, bekentenis=$11, wapen=$12, hulpverlener=$13, huiselijk=$14, alcohol_ugl=$15, taakstraf_uren=$16, gev_onvw_dagen=$17,
           gev_vw_dagen=$18, geldboete_euro=$19, ontzegging_maanden=$20, eis_taakstraf_uren=$21, eis_gev_onvw_dagen=$22, eis_gev_vw_dagen=$23,
           eis_geldboete_euro=$24, eis_ontzegging_maanden=$25, sentence_summary=$26, eis_summary=$27, motivation=$28, motivation_start=$29,
           facts_summary=$30, extraction_quality=$31, extractor=$32, extracted_at=now()`,
        [ecli, p.primaryCategory, p.categories, p.articles, p.offenseCount, p.multiOffense, p.acquittal, p.outcome, p.recidive, p.letsel, p.bekentenis,
          p.wapen, p.hulpverlener, p.huiselijk, p.alcoholUgl, p.taakstrafUren, p.gevOnvwDagen, p.gevVwDagen, p.geldboeteEuro, p.ontzeggingMaanden,
          p.eisTaakstrafUren, p.eisGevOnvwDagen, p.eisGevVwDagen, p.eisGeldboeteEuro, p.eisOntzeggingMaanden, p.sentenceSummary, p.eisSummary,
          p.motivation, p.motivationStart, p.factsSummary, p.quality, EXTRACTOR],
      );
    }
  });
}

export async function extractAll(opts: { onlyMissing?: boolean; log?: (m: string) => void } = {}) {
  const log = opts.log ?? console.log;
  const rows = await q<{ ecli: string }>(
    opts.onlyMissing
      ? "SELECT d.ecli FROM documents d LEFT JOIN case_profiles p USING (ecli) WHERE p.ecli IS NULL OR p.extracted_at < d.fetched_at"
      : "SELECT ecli FROM documents",
  );
  const run = await q<{ id: string }>("INSERT INTO import_runs(kind) VALUES ('extract') RETURNING id");
  let n = 0;
  let errors = 0;
  for (const r of rows) {
    try {
      await extractOne(r.ecli);
    } catch (e) {
      errors++;
      log(`extractie mislukt voor ${r.ecli}: ${(e as Error).message}`);
    }
    if (++n % 200 === 0) log(`extractie: ${n}/${rows.length}`);
  }
  await q("UPDATE import_runs SET finished_at=now(), status=$2, stats=$3 WHERE id=$1", [run[0].id, errors ? "partial" : "ok", JSON.stringify({ total: rows.length, errors })]);
  log(`extractie klaar: ${rows.length} documenten, ${errors} fouten`);
}
