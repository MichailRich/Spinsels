// Wetsartikelen die in de classificatie worden gebruikt. Koppelingen naar
// wetten.overheid.nl gebruiken de Juriconnect-notatie (jci1.3) met een
// peildatum ('g='), zodat steeds de wetsversie die gold op de uitspraakdatum
// (of pleegdatum) kan worden geopend.

export type LegalArticle = {
  code: string;
  law: string;
  bwbId: string;
  article: string;
  title: string;
  history: { from: string; note: string }[];
};

const LAWS: Record<string, { name: string; bwb: string }> = {
  Sr: { name: "Wetboek van Strafrecht", bwb: "BWBR0001854" },
  WVW: { name: "Wegenverkeerswet 1994", bwb: "BWBR0006622" },
  OW: { name: "Opiumwet", bwb: "BWBR0001941" },
  WWM: { name: "Wet wapens en munitie", bwb: "BWBR0008804" },
  Sv: { name: "Wetboek van Strafvordering", bwb: "BWBR0001903" },
};

const a = (code: string, title: string, history: LegalArticle["history"] = []): LegalArticle => {
  const [law, article] = code.split(":");
  return { code, law: LAWS[law].name, bwbId: LAWS[law].bwb, article, title, history };
};

export const ARTICLES: LegalArticle[] = [
  a("Sr:45", "Poging"),
  a("Sr:138", "Huisvredebreuk"),
  a("Sr:138ab", "Computervredebreuk"),
  a("Sr:141", "Openlijke geweldpleging"),
  a("Sr:180", "Wederspannigheid"),
  a("Sr:184", "Niet voldoen aan bevel of vordering"),
  a("Sr:225", "Valsheid in geschrift"),
  a("Sr:227a", "Niet tijdig verstrekken van gegevens (uitkering)"),
  a("Sr:227b", "Niet nakomen van verplichting gegevens te verstrekken (uitkering)"),
  a("Sr:231", "Reisdocumenten/identiteitsbewijzen"),
  a("Sr:239", "Schennis van de eerbaarheid"),
  a("Sr:240", "Aanstootgevende afbeeldingen"),
  a("Sr:240b", "Kinderpornografie / seksuele afbeeldingen van minderjarigen"),
  a("Sr:246", "Feitelijke aanranding van de eerbaarheid (tot 1 juli 2024)", [
    { from: "2024-07-01", note: "Wet seksuele misdrijven: zedendelicten opnieuw ingedeeld (o.a. nieuwe titel XIV)." },
  ]),
  a("Sr:266", "Eenvoudige belediging"),
  a("Sr:267", "Belediging van ambtenaar (strafverzwaring)"),
  a("Sr:285", "Bedreiging"),
  a("Sr:285b", "Belaging"),
  a("Sr:285d", "Doxing", [{ from: "2024-01-01", note: "Strafbaarstelling doxing in werking getreden." }]),
  a("Sr:300", "Mishandeling"),
  a("Sr:302", "Zware mishandeling"),
  a("Sr:304", "Strafverzwaring mishandeling (o.a. partner, kind, ambtenaar)"),
  a("Sr:310", "Diefstal"),
  a("Sr:311", "Gekwalificeerde diefstal"),
  a("Sr:321", "Verduistering"),
  a("Sr:322", "Verduistering door schuld"),
  a("Sr:323", "Verduistering in dienstbetrekking/beroep"),
  a("Sr:326", "Oplichting"),
  a("Sr:326a", "Flessentrekkerij"),
  a("Sr:350", "Vernieling"),
  a("Sr:350a", "Vernieling van gegevens (computer)"),
  a("Sr:416", "Opzetheling"),
  a("Sr:417bis", "Schuldheling"),
  a("Sr:420bis", "Witwassen"),
  a("Sr:420bis.1", "Eenvoudig witwassen"),
  a("Sr:420quater", "Schuldwitwassen"),
  a("Sr:429ter", "Seksuele intimidatie", [{ from: "2024-07-01", note: "Ingevoerd bij de Wet seksuele misdrijven." }]),
  a("WVW:5", "Gevaar of hinder op de weg"),
  a("WVW:5a", "Zeer gevaarlijk rijgedrag"),
  a("WVW:6", "Verkeersongeval met zwaar lichamelijk letsel of dood"),
  a("WVW:7", "Verlaten plaats ongeval"),
  a("WVW:8", "Rijden onder invloed", [
    { from: "2017-07-01", note: "Grenswaarden voor drugs in het verkeer (art. 8 lid 5) van kracht." },
  ]),
  a("WVW:9", "Rijden met ongeldig verklaard rijbewijs / tijdens ontzegging"),
  a("WVW:107", "Rijden zonder geldig rijbewijs"),
  a("WVW:163", "Medewerking adem- en bloedonderzoek"),
  a("OW:2", "Verboden handelingen lijst I (harddrugs)"),
  a("OW:3", "Verboden handelingen lijst II (softdrugs)"),
  a("OW:10", "Strafbepaling lijst I"),
  a("OW:10a", "Voorbereidingshandelingen"),
  a("OW:11", "Strafbepaling lijst II"),
  a("WWM:13", "Verbod voorhanden hebben wapen categorie I"),
  a("WWM:26", "Verbod voorhanden hebben wapen/munitie"),
  a("WWM:27", "Verbod dragen wapen categorie IV"),
  a("WWM:55", "Strafbepaling Wet wapens en munitie"),
];

export const ARTICLE_BY_CODE = new Map(ARTICLES.map((x) => [x.code, x]));

export function articleUrl(code: string, onDate?: string | null): string | null {
  const art = ARTICLE_BY_CODE.get(code);
  const [law, num] = code.split(":");
  const bwb = art?.bwbId ?? LAWS[law]?.bwb;
  if (!bwb) return null;
  const artNum = num.replace(/\.\d+$/, "");
  const g = onDate ? `&g=${onDate.slice(0, 10)}` : "";
  return `https://wetten.overheid.nl/jci1.3:c:${bwb}&artikel=${encodeURIComponent(artNum)}${g}`;
}

export function articleLabel(code: string): string {
  const [law, num] = code.split(":");
  const short = law === "WVW" ? "WVW 1994" : law === "OW" ? "Opiumwet" : law;
  return `art. ${num} ${short}`;
}

export { LAWS };
