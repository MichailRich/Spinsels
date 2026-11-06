import { q, q1 } from "../db";

export type DocRow = {
  ecli: string; court_code: string; court_name: string; current_code: string; decision_date: string | null; publication_date: string | null;
  zaaknummer: string | null; procedure: string | null; inhoudsindicatie: string | null; full_text: string; sections: { title: string; start: number; end: number; level: number }[];
  deeplink: string; version: number; fetched_at: string; politierechter_evidence: string | null; source_modified: string | null;
};
export type ProfileRow = Record<string, unknown> & {
  primary_category: string | null; categories: string[]; articles: string[]; outcome: string; acquittal: string | null; recidive: string; letsel: string;
  bekentenis: string; wapen: boolean; hulpverlener: boolean; huiselijk: boolean; multi_offense: boolean; offense_count: number; sentence_summary: string | null;
  eis_summary: string | null; motivation: string | null; motivation_start: number | null; facts_summary: string | null; extraction_quality: number;
  review_status: string; extractor: string; alcohol_ugl: number | null;
};
export type OffenseRow = { id: number; feit_nr: string | null; role: string; category_code: string | null; qualification: string; articles: string[]; evidence: string; evidence_start: number | null; evidence_end: number | null; confidence: number; review_status: string; extractor: string };
export type ComponentRow = { id: number; origin: string; kind: string; amount: number | null; unit: string | null; conditional: boolean; probation_months: number | null; substitute_days: number | null; description: string; evidence: string; evidence_start: number | null; evidence_end: number | null; confidence: number; review_status: string; extractor: string };
export type CircRow = { id: number; code: string; polarity: string; status: string; evidence: string; evidence_start: number | null; evidence_end: number | null; confidence: number; review_status: string };

export async function loadCase(ecli: string) {
  const doc = await q1<DocRow>(
    `SELECT d.ecli, d.court_code, c.name AS court_name, c.current_code, to_char(d.decision_date,'YYYY-MM-DD') AS decision_date,
       to_char(d.publication_date,'YYYY-MM-DD') AS publication_date, d.zaaknummer, d.procedure, d.inhoudsindicatie, d.full_text, d.sections,
       d.deeplink, d.version, to_char(d.fetched_at,'YYYY-MM-DD HH24:MI') AS fetched_at, d.politierechter_evidence, to_char(d.source_modified,'YYYY-MM-DD') AS source_modified
     FROM documents d JOIN courts c ON c.code=d.court_code WHERE d.ecli=$1`, [ecli]);
  if (!doc) return null;
  const [profile, offenses, components, circumstances] = await Promise.all([
    q1<ProfileRow>("SELECT * FROM case_profiles WHERE ecli=$1", [ecli]),
    q<OffenseRow>("SELECT * FROM case_offenses WHERE ecli=$1 AND review_status <> 'afgewezen' ORDER BY role, id", [ecli]),
    q<ComponentRow>("SELECT id, origin, kind, amount::float, unit, conditional, probation_months::float, substitute_days::float, description, evidence, evidence_start, evidence_end, confidence, review_status, extractor FROM sentence_components WHERE ecli=$1 AND review_status <> 'afgewezen' ORDER BY origin, id", [ecli]),
    q<CircRow>("SELECT * FROM circumstances WHERE ecli=$1 AND review_status <> 'afgewezen' ORDER BY status, polarity, code", [ecli]),
  ]);
  return { doc, profile, offenses, components, circumstances };
}
export type LoadedCase = NonNullable<Awaited<ReturnType<typeof loadCase>>>;
