import { q } from "../db";
import { buildWhere, FROM, type Filters } from "../filters";

export type CaseRow = {
  ecli: string;
  court_code: string;
  court_name: string;
  current_code: string;
  decision_date: string | null;
  publication_date: string | null;
  inhoudsindicatie: string | null;
  primary_category: string | null;
  categories: string[];
  articles: string[];
  outcome: string;
  acquittal: string | null;
  recidive: string;
  letsel: string;
  bekentenis: string;
  wapen: boolean;
  hulpverlener: boolean;
  multi_offense: boolean;
  sentence_summary: string | null;
  eis_summary: string | null;
  taakstraf_uren: number | null;
  gev_onvw_dagen: number | null;
  gev_vw_dagen: number | null;
  geldboete_euro: number | null;
  extraction_quality: number;
  review_status: string;
  snippet?: string | null;
  rank?: number;
};

export const SORTS: Record<string, string> = {
  datum: "d.decision_date DESC NULLS LAST, d.ecli DESC",
  datum_oud: "d.decision_date ASC NULLS LAST, d.ecli",
  relevantie: "rank DESC NULLS LAST, d.decision_date DESC NULLS LAST",
  taakstraf: "p.taakstraf_uren DESC NULLS LAST, d.decision_date DESC",
  gevangenisstraf: "p.gev_onvw_dagen DESC NULLS LAST, d.decision_date DESC",
  boete: "p.geldboete_euro DESC NULLS LAST, d.decision_date DESC",
};

const COLS = `d.ecli, d.court_code, c.name AS court_name, c.current_code, to_char(d.decision_date,'YYYY-MM-DD') AS decision_date,
  to_char(d.publication_date,'YYYY-MM-DD') AS publication_date, d.inhoudsindicatie, p.primary_category, p.categories, p.articles, p.outcome, p.acquittal,
  p.recidive, p.letsel, p.bekentenis, p.wapen, p.hulpverlener, p.multi_offense, p.sentence_summary, p.eis_summary,
  p.taakstraf_uren::float AS taakstraf_uren, p.gev_onvw_dagen::float AS gev_onvw_dagen, p.gev_vw_dagen::float AS gev_vw_dagen,
  p.geldboete_euro::float AS geldboete_euro, p.extraction_quality, p.review_status`;

export async function searchCases(f: Filters, opts: { page?: number; pageSize?: number; sort?: string } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const size = Math.min(200, opts.pageSize ?? 25);
  const { where, params, tsQuery } = buildWhere(f);
  const sort = SORTS[opts.sort ?? (tsQuery ? "relevantie" : "datum")] ?? SORTS.datum;
  const rankCol = tsQuery ? `, ts_rank_cd(d.search, websearch_to_tsquery('dutch', ${tsQuery})) AS rank,
    ts_headline('dutch', coalesce(d.inhoudsindicatie,'') || ' ' || left(d.full_text, 20000), websearch_to_tsquery('dutch', ${tsQuery}),
      'MaxFragments=2, MaxWords=28, MinWords=12, StartSel=<mark>, StopSel=</mark>') AS snippet` : ", NULL::float AS rank";
  const rows = await q<CaseRow>(
    `SELECT ${COLS} ${rankCol} FROM ${FROM} WHERE ${where} ORDER BY ${sort} LIMIT ${size} OFFSET ${(page - 1) * size}`,
    params,
  );
  const [{ n }] = await q<{ n: number }>(`SELECT count(*)::int AS n FROM ${FROM} WHERE ${where}`, params);
  return { rows, total: n, page, pageSize: size };
}

export async function recentCases(limit = 8) {
  return q<CaseRow>(
    `SELECT ${COLS} FROM ${FROM} WHERE d.is_politierechter ORDER BY d.publication_date DESC NULLS LAST, d.decision_date DESC LIMIT $1`,
    [limit],
  );
}

export async function categoryCounts() {
  return q<{ code: string; label: string; group_code: string; group_label: string; n: number; n_single: number }>(
    `SELECT oc.code, oc.label, oc.group_code, oc.group_label,
       count(p.ecli)::int AS n, count(p.ecli) FILTER (WHERE cardinality(p.categories)=1)::int AS n_single
     FROM offense_categories oc LEFT JOIN case_profiles p ON oc.code = ANY(p.categories)
     GROUP BY oc.code, oc.label, oc.group_code, oc.group_label, oc.sort_order ORDER BY oc.sort_order`,
  );
}

export async function datasetMeta() {
  const [m] = await q<{ total: number; first: string; last: string; updated: string; courts: number; verified: number; convictions: number }>(
    `SELECT count(*)::int AS total, to_char(min(d.decision_date),'YYYY-MM-DD') AS first, to_char(max(d.decision_date),'YYYY-MM-DD') AS last,
       to_char(max(d.fetched_at),'YYYY-MM-DD HH24:MI') AS updated, count(DISTINCT c.current_code)::int AS courts,
       count(*) FILTER (WHERE p.review_status IN ('geverifieerd','gecorrigeerd'))::int AS verified,
       count(*) FILTER (WHERE p.outcome='veroordeling')::int AS convictions
     FROM ${FROM} WHERE d.is_politierechter`,
  );
  return m;
}
