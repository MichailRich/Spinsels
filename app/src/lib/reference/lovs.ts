// LOVS-oriëntatiepunten: letterlijke fragmenten uit het officiële document (zie scripts/build-lovs.py).
import lovs from "../../../data/lovs.json";

type Section = { heading: string; page: number; text: string };
const SECTIONS = lovs.sections as Record<string, Section>;
const ALIAS: Record<string, string> = {
  huiselijk_geweld: "mishandeling", geweld_hulpverleners: "mishandeling", mishandeling_zwaar_letsel: "mishandeling", diefstal: "winkeldiefstal",
};

export function lovsFor(category: string) {
  const key = SECTIONS[category] ? category : ALIAS[category];
  const s = key ? SECTIONS[key] : undefined;
  if (!s) return null;
  return {
    ...s,
    url: lovs.url,
    version: lovs.version,
    source: lovs.source,
    note: `${lovs.source}, versie ${lovs.version}, pdf-pagina ${s.page}. Fragment hieronder letterlijk overgenomen.${ALIAS[category] ? " (Dichtstbijzijnde oriëntatiepunt voor dit delict.)" : ""}`,
  };
}
export function lovsGeneral() {
  return { recidive: SECTIONS._recidive, omstandigheden: SECTIONS._omstandigheden, url: lovs.url, version: lovs.version };
}
