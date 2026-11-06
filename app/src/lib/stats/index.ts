// Statistieken voor het dashboard. Alle cijfers worden live uit de databank berekend
// op basis van dezelfde filters als de zoekmachine. Er worden nooit fictieve cijfers gebruikt.

import { q } from "../db";
import { buildWhere, FROM, type Filters } from "../filters";

export const SEVERITY_SQL = `CASE WHEN p.gev_onvw_dagen > 0 THEN 'onvw' WHEN p.taakstraf_uren > 0 THEN 'taak'
  WHEN p.gev_vw_dagen > 0 THEN 'vw' WHEN p.geldboete_euro > 0 THEN 'boete'
  WHEN p.outcome = 'veroordeling' THEN 'overig' WHEN p.outcome = 'schuldig_zonder_straf' THEN '9a' ELSE 'geen' END`;

export const SEVERITY_LABELS: Record<string, string> = {
  onvw: "Onvoorwaardelijke gevangenisstraf",
  taak: "Taakstraf",
  vw: "Voorwaardelijke gevangenisstraf",
  boete: "Geldboete",
  overig: "Overige sanctie",
  "9a": "Schuldig zonder straf",
  geen: "Geen straf (vrijspraak e.d.)",
};

export type Summary = { n: number; min: number | null; p10: number | null; p25: number | null; median: number | null; p75: number | null; p90: number | null; max: number | null; mean: number | null };

const summarySql = (col: string) => `count(${col})::int AS n, min(${col})::float AS min,
  percentile_cont(0.1) WITHIN GROUP (ORDER BY ${col})::float AS p10, percentile_cont(0.25) WITHIN GROUP (ORDER BY ${col})::float AS p25,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY ${col})::float AS median, percentile_cont(0.75) WITHIN GROUP (ORDER BY ${col})::float AS p75,
  percentile_cont(0.9) WITHIN GROUP (ORDER BY ${col})::float AS p90, max(${col})::float AS max, avg(${col})::float AS mean`;

export async function computeStats(f: Filters) {
  const { where, params } = buildWhere(f);
  const base = `WITH base AS (SELECT d.decision_date, c.current_code, p.* FROM ${FROM} WHERE ${where})`;
  const B = (sql: string) => q(`${base} ${sql}`, params);

  const [meta] = await B(`SELECT count(*)::int AS n,
      count(*) FILTER (WHERE outcome IN ('veroordeling','schuldig_zonder_straf'))::int AS convictions,
      count(*) FILTER (WHERE outcome='vrijspraak')::int AS acquittals,
      count(*) FILTER (WHERE multi_offense)::int AS multi,
      to_char(min(decision_date),'YYYY-MM-DD') AS first, to_char(max(decision_date),'YYYY-MM-DD') AS last,
      (SELECT to_char(max(fetched_at),'YYYY-MM-DD HH24:MI') FROM documents) AS updated FROM base`);

  // Grafiek 1 — strafsoorten (componenten per zaak, en volledige combinaties)
  const [types] = await B(`SELECT
      count(*) FILTER (WHERE outcome IN ('veroordeling','schuldig_zonder_straf'))::int AS convicted,
      count(*) FILTER (WHERE geldboete_euro > 0)::int AS geldboete,
      count(*) FILTER (WHERE taakstraf_uren > 0)::int AS taakstraf,
      count(*) FILTER (WHERE gev_vw_dagen > 0)::int AS vw,
      count(*) FILTER (WHERE gev_onvw_dagen > 0)::int AS onvw,
      count(*) FILTER (WHERE outcome='veroordeling' AND coalesce(geldboete_euro,0)=0 AND coalesce(taakstraf_uren,0)=0 AND coalesce(gev_vw_dagen,0)=0 AND coalesce(gev_onvw_dagen,0)=0)::int AS overig
    FROM base`);
  const combos = await B(`SELECT concat_ws(' + ',
        CASE WHEN gev_onvw_dagen > 0 THEN 'onvoorwaardelijke gevangenisstraf' END,
        CASE WHEN taakstraf_uren > 0 THEN 'taakstraf' END,
        CASE WHEN gev_vw_dagen > 0 THEN 'voorwaardelijke gevangenisstraf' END,
        CASE WHEN geldboete_euro > 0 THEN 'geldboete' END,
        CASE WHEN ontzegging_maanden > 0 THEN 'ontzegging' END) AS combo, count(*)::int AS n
      FROM base WHERE outcome='veroordeling' GROUP BY 1 ORDER BY 2 DESC LIMIT 12`);

  // Grafiek 2 — strafhoogte
  const dist = async (col: string) => {
    const [s] = await B(`SELECT ${summarySql(col)} FROM base WHERE ${col} > 0`);
    const values = await B(`SELECT ${col}::float AS v, ecli FROM base WHERE ${col} > 0 ORDER BY ${col}`);
    return { summary: s as Summary, values: values as { v: number; ecli: string }[] };
  };
  const distributions = {
    taakstraf: await dist("taakstraf_uren"),
    gevangenis: await dist("gev_onvw_dagen"),
    voorwaardelijk: await dist("gev_vw_dagen"),
    geldboete: await dist("geldboete_euro"),
    ontzegging: await dist("ontzegging_maanden"),
  };

  // Grafiek 3/4 — groepsvergelijking
  const groupCompare = (col: string, whereExtra = "TRUE") =>
    B(`SELECT ${col} AS key, count(*)::int AS n,
        count(*) FILTER (WHERE outcome IN ('veroordeling','schuldig_zonder_straf'))::int AS convicted,
        count(*) FILTER (WHERE gev_onvw_dagen > 0)::int AS onvw, count(*) FILTER (WHERE taakstraf_uren > 0)::int AS taak,
        count(*) FILTER (WHERE geldboete_euro > 0)::int AS boete, count(*) FILTER (WHERE gev_vw_dagen > 0)::int AS vw,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY taakstraf_uren) FILTER (WHERE taakstraf_uren > 0)::float AS med_taak,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY gev_onvw_dagen) FILTER (WHERE gev_onvw_dagen > 0)::float AS med_onvw,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY geldboete_euro) FILTER (WHERE geldboete_euro > 0)::float AS med_boete,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY taakstraf_uren) FILTER (WHERE taakstraf_uren > 0)::float AS p25_taak,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY taakstraf_uren) FILTER (WHERE taakstraf_uren > 0)::float AS p75_taak
      FROM base WHERE ${whereExtra} GROUP BY 1`);
  const recidive = await groupCompare("recidive");
  const letsel = await groupCompare("letsel", "letsel <> 'nvt'");

  // Grafiek 5 — eis OM vs. opgelegde straf (alleen vergelijkbare componenten)
  const eisPairs = async (eisCol: string, col: string) => {
    const pairs = (await B(`SELECT ecli, ${eisCol}::float AS eis, coalesce(${col},0)::float AS straf FROM base
       WHERE ${eisCol} > 0 AND outcome IN ('veroordeling','schuldig_zonder_straf') ORDER BY ${eisCol}`)) as { ecli: string; eis: number; straf: number }[];
    const both = pairs.filter((p) => p.straf > 0);
    return {
      pairs,
      compared: both.length,
      lower: both.filter((p) => p.straf < p.eis).length,
      equal: both.filter((p) => p.straf === p.eis).length,
      higher: both.filter((p) => p.straf > p.eis).length,
      notImposed: pairs.length - both.length,
      medianRatio: median(both.map((p) => p.straf / p.eis)),
    };
  };
  const eis = {
    taakstraf: await eisPairs("eis_taakstraf_uren", "taakstraf_uren"),
    gevangenis: await eisPairs("eis_gev_onvw_dagen", "gev_onvw_dagen"),
    voorwaardelijk: await eisPairs("eis_gev_vw_dagen", "gev_vw_dagen"),
    geldboete: await eisPairs("eis_geldboete_euro", "geldboete_euro"),
    ontzegging: await eisPairs("eis_ontzegging_maanden", "ontzegging_maanden"),
  };
  const [eisMeta] = await B(`SELECT count(*) FILTER (WHERE eis_summary IS NOT NULL)::int AS with_eis FROM base`);

  // Grafiek 6 — rechtbanken
  const courts = await B(`SELECT current_code AS code, count(*)::int AS n,
      count(*) FILTER (WHERE gev_onvw_dagen > 0)::int AS onvw, count(*) FILTER (WHERE taakstraf_uren > 0)::int AS taak,
      count(*) FILTER (WHERE geldboete_euro > 0)::int AS boete, count(*) FILTER (WHERE gev_vw_dagen > 0)::int AS vw,
      count(*) FILTER (WHERE outcome='vrijspraak')::int AS vrijspraak,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY taakstraf_uren) FILTER (WHERE taakstraf_uren > 0)::float AS med_taak,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY gev_onvw_dagen) FILTER (WHERE gev_onvw_dagen > 0)::float AS med_onvw
    FROM base GROUP BY 1 ORDER BY 2 DESC`);
  const courtCats = await B(`SELECT current_code AS code, cat, count(*)::int AS n FROM base, unnest(categories) AS cat GROUP BY 1,2 ORDER BY 1, 3 DESC`);
  const courtYears = await B(`SELECT current_code AS code, extract(year FROM decision_date)::int AS year, count(*)::int AS n FROM base WHERE decision_date IS NOT NULL GROUP BY 1,2 ORDER BY 1,2`);

  // Grafiek 7 — ontwikkeling door de jaren
  const years = await B(`SELECT extract(year FROM decision_date)::int AS year, count(*)::int AS n,
      count(*) FILTER (WHERE outcome IN ('veroordeling','schuldig_zonder_straf'))::int AS convicted,
      count(*) FILTER (WHERE gev_onvw_dagen > 0)::int AS onvw, count(*) FILTER (WHERE taakstraf_uren > 0)::int AS taak,
      count(*) FILTER (WHERE geldboete_euro > 0)::int AS boete,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY taakstraf_uren) FILTER (WHERE taakstraf_uren > 0)::float AS med_taak,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY gev_onvw_dagen) FILTER (WHERE gev_onvw_dagen > 0)::float AS med_onvw,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY geldboete_euro) FILTER (WHERE geldboete_euro > 0)::float AS med_boete
    FROM base WHERE decision_date IS NOT NULL GROUP BY 1 ORDER BY 1`);

  // Grafiek 8/9 — omstandigheden (alleen uitdrukkelijk meegewogen)
  const heat = await B(`SELECT ci.code, ${SEVERITY_SQL.replace(/p\./g, "b.")} AS sev, count(DISTINCT b.ecli)::int AS n
    FROM base b JOIN circumstances ci ON ci.ecli = b.ecli AND ci.status='meegewogen' AND ci.review_status <> 'afgewezen'
    GROUP BY 1,2`);
  const sevTotals = await B(`SELECT ${SEVERITY_SQL.replace(/p\./g, "base.")} AS sev, count(*)::int AS n FROM base GROUP BY 1`);
  const circ = await B(`SELECT ci.code, ci.polarity, count(DISTINCT b.ecli)::int AS n,
      count(DISTINCT b.ecli) FILTER (WHERE b.gev_onvw_dagen > 0)::int AS onvw,
      count(DISTINCT b.ecli) FILTER (WHERE b.taakstraf_uren > 0)::int AS taak,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY b.taakstraf_uren) FILTER (WHERE b.taakstraf_uren > 0)::float AS med_taak
    FROM base b JOIN circumstances ci ON ci.ecli = b.ecli AND ci.status='meegewogen' AND ci.review_status <> 'afgewezen'
    GROUP BY 1,2 ORDER BY 3 DESC`);
  const [overall] = await B(`SELECT count(*)::int AS n, count(*) FILTER (WHERE gev_onvw_dagen > 0)::int AS onvw, count(*) FILTER (WHERE taakstraf_uren > 0)::int AS taak,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY taakstraf_uren) FILTER (WHERE taakstraf_uren > 0)::float AS med_taak FROM base`);

  // Grafiek 10 — spreiding per uitspraak
  const scatter = await B(`SELECT ecli, to_char(decision_date,'YYYY-MM-DD') AS date, taakstraf_uren::float AS taak, gev_onvw_dagen::float AS onvw,
      gev_vw_dagen::float AS vw, geldboete_euro::float AS boete, recidive, primary_category AS cat, current_code AS court
    FROM base WHERE decision_date IS NOT NULL AND (taakstraf_uren > 0 OR gev_onvw_dagen > 0 OR geldboete_euro > 0 OR gev_vw_dagen > 0)`);

  return { meta, types: { ...types, combos }, distributions, recidive, letsel, eis: { ...eis, withEis: eisMeta.with_eis }, courts, courtCats, courtYears, years, heat, sevTotals, circ, overall, scatter };
}

export type Stats = Awaited<ReturnType<typeof computeStats>>;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
