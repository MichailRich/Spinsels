// Kwaliteitsmeting van de strafextractie: vergelijkt de uit de vonnistekst geëxtraheerde
// straf met de straf die de Rechtspraak in de inhoudsindicatie vermeldt (onafhankelijke
// referentie, alleen beschikbaar waar de inhoudsindicatie een straf noemt).
import { q, getPool } from "../src/lib/db";
import { extractSanctions } from "../src/lib/extract/sanctions";
import { sentences } from "../src/lib/extract/text";
import { writeFileSync, mkdirSync } from "node:fs";

type Row = { ecli: string; inhoudsindicatie: string; taakstraf_uren: number | null; gev_onvw_dagen: number | null; gev_vw_dagen: number | null; geldboete_euro: number | null; from_inh: boolean };

async function main() {
  const rows = await q<Row>(`SELECT d.ecli, d.inhoudsindicatie, p.taakstraf_uren::float, p.gev_onvw_dagen::float, p.gev_vw_dagen::float, p.geldboete_euro::float,
      EXISTS (SELECT 1 FROM sentence_components s WHERE s.ecli=d.ecli AND s.origin='opgelegd' AND s.evidence_start IS NULL) AS from_inh
    FROM documents d JOIN case_profiles p USING (ecli) WHERE p.outcome='veroordeling' AND d.inhoudsindicatie IS NOT NULL`);
  const res: Record<string, { n: number; ok: number; mism: string[] }> = {};
  const add = (k: string, ok: boolean, ecli: string, detail: string) => {
    res[k] ??= { n: 0, ok: 0, mism: [] };
    res[k].n++;
    if (ok) res[k].ok++;
    else res[k].mism.push(`${ecli}: ${detail}`);
  };
  for (const r of rows) {
    if (r.from_inh) continue; // referentie zou dan gelijk zijn aan de extractie
    const sents = sentences(r.inhoudsindicatie).filter((s) => !/eis|geëist|gevorderd|officier|\bOM\b|hof|vordering/i.test(s.text));
    const ref = sents.flatMap((s) => extractSanctions(s.text, 0, { origin: "opgelegd" }));
    const sum = (kinds: string[], cond: boolean) => ref.filter((c) => kinds.includes(c.kind) && c.conditional === cond && c.amount != null).reduce((a, c) => a + Number(c.amount), 0) || null;
    const refTaak = sum(["taakstraf"], false), refOnvw = sum(["gevangenisstraf", "hechtenis"], false), refBoete = sum(["geldboete"], false);
    if (refTaak) add("taakstraf (uren)", refTaak === r.taakstraf_uren, r.ecli, `inhoudsindicatie ${refTaak}, extractie ${r.taakstraf_uren}`);
    if (refOnvw) add("onvoorwaardelijke gevangenisstraf (dagen)", refOnvw === r.gev_onvw_dagen, r.ecli, `inhoudsindicatie ${refOnvw}, extractie ${r.gev_onvw_dagen}`);
    if (refBoete) add("geldboete (euro)", refBoete === r.geldboete_euro, r.ecli, `inhoudsindicatie ${refBoete}, extractie ${r.geldboete_euro}`);
  }
  const report = Object.entries(res).map(([k, v]) => ({ component: k, vergeleken: v.n, overeenstemming: v.n ? Math.round((v.ok / v.n) * 1000) / 10 : null, voorbeelden_afwijking: v.mism.slice(0, 15) }));
  console.table(report.map(({ voorbeelden_afwijking: _, ...r }) => r));
  mkdirSync("data", { recursive: true });
  writeFileSync("data/extraction-evaluation.json", JSON.stringify({ generated: new Date().toISOString(), method: "Vergelijking extractie uit vonnistekst met straf genoemd in de inhoudsindicatie (Rechtspraak). Afwijkingen kunnen ook voortkomen uit onvolledige inhoudsindicaties.", report }, null, 1));
  await getPool().end();
}
main();
