export const RECIDIVE_LABEL: Record<string, string> = {
  blanco: "Blanco strafblad (vermeld)",
  geen_relevante: "Geen relevante eerdere veroordelingen",
  eerder: "Eerdere veroordelingen (relevantie niet vermeld)",
  relevant: "Relevante eerdere veroordeling / recidive",
  onbekend: "Niet vermeld in uitspraak",
};
export const RECIDIVE_ORDER = ["blanco", "geen_relevante", "eerder", "relevant", "onbekend"];
export const LETSEL_LABEL: Record<string, string> = {
  geen: "Geen letsel (vermeld)",
  licht: "Licht letsel",
  ernstig: "Ernstig letsel",
  onbekend: "Letsel niet vastgesteld/vermeld",
  nvt: "Niet van toepassing",
};
export const LETSEL_ORDER = ["geen", "licht", "ernstig", "onbekend"];
export const BEKENTENIS_LABEL: Record<string, string> = { bekend: "Bekend", gedeeltelijk: "Gedeeltelijk bekend", ontkend: "Ontkend / zwijgrecht", onbekend: "Niet vermeld" };
export const OUTCOME_LABEL: Record<string, string> = {
  veroordeling: "Veroordeling",
  vrijspraak: "Vrijspraak",
  ontslag_van_alle_rechtsvervolging: "Ontslag van alle rechtsvervolging",
  schuldig_zonder_straf: "Schuldig zonder straf",
  niet_ontvankelijk: "OM niet-ontvankelijk",
  tul_beslissing: "Beslissing op vordering tenuitvoerlegging",
  onbekend: "Uitkomst niet automatisch vastgesteld",
};
export const REVIEW_LABEL: Record<string, string> = { auto: "Automatisch geëxtraheerd", geverifieerd: "Geverifieerd door redactie", gecorrigeerd: "Gecorrigeerd door redactie", afgewezen: "Afgewezen" };
/** gevalideerd categorisch palet (zie dataviz-validator); vaste volgorde */
export const SERIES = ["#2a78d6", "#c98500", "#6250d6", "#1baf7a", "#e34948"];
export const RECIDIVE_COLOR: Record<string, string> = { blanco: SERIES[0], geen_relevante: SERIES[3], eerder: SERIES[1], relevant: SERIES[4], onbekend: "#9aa5b4" };
export const RECIDIVE_SYMBOL: Record<string, string> = { blanco: "circle", geen_relevante: "diamond", eerder: "triangle", relevant: "rect", onbekend: "emptyCircle" };
export const fmtNum = (n: number | null | undefined, d = 0) => (n == null ? "–" : new Intl.NumberFormat("nl-NL", { maximumFractionDigits: d }).format(n));
export const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : "–");
export const fmtDays = (d: number | null | undefined) => {
  if (d == null) return "–";
  if (d >= 365 && d % 365 === 0) return `${d / 365} jaar`;
  if (d >= 30 && d % 30 === 0) return `${d / 30} mnd`;
  if (d >= 7 && d % 7 === 0) return `${d / 7} wk`;
  return `${fmtNum(d, 1)} dg`;
};
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
export const RECIDIVE_SHORT: Record<string, string> = { blanco: "Blanco", geen_relevante: "Geen relevante", eerder: "Eerder veroordeeld", relevant: "Recidive", onbekend: "Niet vermeld" };
export const LETSEL_SHORT: Record<string, string> = { geen: "Geen letsel", licht: "Licht", ernstig: "Ernstig", onbekend: "Niet vermeld", nvt: "n.v.t." };
