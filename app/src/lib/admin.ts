import { q, q1 } from "./db";
import { currentUser } from "./auth";
import { summarize, type Component } from "./extract/sanctions";

export async function adminOrNull() {
  const u = await currentUser();
  return u?.role === "admin" ? u : null;
}

/** Herberekent strafkolommen in het profiel uit (gecorrigeerde) strafcomponenten. */
export async function recomputeProfile(ecli: string) {
  const comps = await q<{ origin: string; kind: string; amount: number | null; conditional: boolean; description: string; evidence: string; unit: string | null; probation_months: number | null; substitute_days: number | null }>(
    "SELECT origin, kind, amount::float, conditional, description, evidence, unit, probation_months::float, substitute_days::float FROM sentence_components WHERE ecli=$1 AND review_status <> 'afgewezen'",
    [ecli],
  );
  const sum = (origin: string, kinds: string[], cond: boolean) => {
    const xs = comps.filter((c) => c.origin === origin && kinds.includes(c.kind) && c.conditional === cond && c.amount != null);
    return xs.length ? xs.reduce((a, c) => a + Number(c.amount), 0) : null;
  };
  const toC = (c: (typeof comps)[number]) => ({ ...c, probationMonths: c.probation_months, substituteDays: c.substitute_days, evidenceStart: 0, evidenceEnd: 0, confidence: 1 }) as unknown as Component;
  const imposed = comps.filter((c) => c.origin === "opgelegd" && !["tul_eerder", "vordering_benadeelde"].includes(c.kind)).map(toC);
  const eis = comps.filter((c) => c.origin === "eis_om").map(toC);
  await q(
    `UPDATE case_profiles SET taakstraf_uren=$2, gev_onvw_dagen=$3, gev_vw_dagen=$4, geldboete_euro=$5, ontzegging_maanden=$6,
       eis_taakstraf_uren=$7, eis_gev_onvw_dagen=$8, eis_gev_vw_dagen=$9, eis_geldboete_euro=$10, eis_ontzegging_maanden=$11,
       sentence_summary=COALESCE(NULLIF($12,''), sentence_summary), eis_summary=NULLIF($13,''), review_status='gecorrigeerd' WHERE ecli=$1`,
    [ecli, sum("opgelegd", ["taakstraf"], false), sum("opgelegd", ["gevangenisstraf", "hechtenis"], false), sum("opgelegd", ["gevangenisstraf", "hechtenis"], true),
      sum("opgelegd", ["geldboete"], false), sum("opgelegd", ["ontzegging"], false), sum("eis_om", ["taakstraf"], false), sum("eis_om", ["gevangenisstraf", "hechtenis"], false),
      sum("eis_om", ["gevangenisstraf", "hechtenis"], true), sum("eis_om", ["geldboete"], false), sum("eis_om", ["ontzegging"], false), summarize(imposed), summarize(eis)],
  );
}

export async function enqueue(type: string, payload: object = {}, uniqueKey?: string) {
  return q1(
    `INSERT INTO jobs (type, payload, unique_key) VALUES ($1,$2,$3)
     ON CONFLICT (unique_key) DO UPDATE SET status = CASE WHEN jobs.status IN ('done','failed') THEN 'queued' ELSE jobs.status END, run_after=now(), attempts=0
     RETURNING id`,
    [type, JSON.stringify(payload), uniqueKey ?? null],
  );
}
