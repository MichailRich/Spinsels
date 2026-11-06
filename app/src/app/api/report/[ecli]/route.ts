import PDFDocument from "pdfkit";
import { loadCase } from "@/lib/case/load";
import { ruleBasedWhy } from "@/lib/case/why";
import { offenseLabel } from "@/lib/reference/offenses";
import { articleLabel } from "@/lib/reference/articles";
import { CIRCUMSTANCES } from "@/lib/extract/circumstances";
import { findSimilar } from "@/lib/search/similar";
import { RECIDIVE_LABEL, LETSEL_LABEL, BEKENTENIS_LABEL, OUTCOME_LABEL, REVIEW_LABEL } from "@/lib/labels";

export async function GET(_: Request, { params }: { params: Promise<{ ecli: string }> }) {
  const ecli = decodeURIComponent((await params).ecli).toUpperCase();
  const c = await loadCase(ecli);
  if (!c) return new Response("Niet gevonden", { status: 404 });
  const { doc: d, profile: p } = c;
  const similar = p?.categories.length ? await findSimilar({ categories: p.categories, recidive: p.recidive, letsel: p.letsel, bekentenis: p.bekentenis, multi: p.multi_offense }, { excludeEcli: ecli, limit: 6 }) : [];

  const pdf = new PDFDocument({ size: "A4", margins: { top: 60, bottom: 60, left: 56, right: 56 }, info: { Title: `Juridisch rapport ${ecli}`, Author: "Politierechter.nl" } });
  const chunks: Buffer[] = [];
  pdf.on("data", (b: Buffer) => chunks.push(b));
  const done = new Promise<Buffer>((r) => pdf.on("end", () => r(Buffer.concat(chunks))));
  const NAVY = "#14263D", GOLD = "#A9884E", GREY = "#4a5a70";
  const h = (t: string) => { pdf.moveDown(0.8).font("Helvetica-Bold").fontSize(12.5).fillColor(NAVY).text(t).moveDown(0.25).font("Helvetica").fontSize(10).fillColor("#000"); };
  const kv = (k: string, v: string) => { pdf.font("Helvetica-Bold").fontSize(9.5).fillColor(GREY).text(`${k}: `, { continued: true }).font("Helvetica").fillColor("#000").text(v); };
  const quote = (t: string) => { pdf.font("Times-Italic").fontSize(10).fillColor("#333").text(`“${t.length > 700 ? t.slice(0, 700) + "…" : t}”`, { indent: 12 }).font("Helvetica").fillColor("#000").moveDown(0.3); };

  pdf.rect(0, 0, pdf.page.width, 46).fill(NAVY);
  pdf.fillColor("#fff").font("Helvetica-Bold").fontSize(12).text("POLITIERECHTER", 56, 17, { continued: true }).fillColor("#C3A46B").text(".NL");
  pdf.moveDown(2).fillColor(GOLD).font("Helvetica").fontSize(10).text(ecli, 56);
  pdf.fillColor(NAVY).font("Helvetica-Bold").fontSize(18).text(p?.categories.length ? p.categories.map(offenseLabel).join(" · ") : "Politierechtervonnis");
  pdf.font("Helvetica").fontSize(10).fillColor(GREY).text(`${d.court_name} · uitspraak ${d.decision_date ?? "–"} · gepubliceerd ${d.publication_date ?? "–"}`);
  pdf.fillColor("#000").moveDown(0.6);
  kv("Bron", d.deeplink);
  kv("Status gegevens", `${REVIEW_LABEL[p?.review_status ?? "auto"]} (${p?.extractor ?? "–"})`);

  h("Opgelegde straf");
  pdf.text(p?.outcome === "veroordeling" ? p.sentence_summary ?? "–" : OUTCOME_LABEL[p?.outcome ?? "onbekend"]);
  h("Eis officier van justitie");
  pdf.text(p?.eis_summary ?? "Niet vermeld in de gepubliceerde uitspraak.");
  h("Strafbare feiten en wetsartikelen");
  for (const o of c.offenses.filter((x) => x.role === "kwalificatie")) pdf.text(`• ${offenseLabel(o.category_code)} — ${o.qualification}`);
  if (p?.articles.length) pdf.moveDown(0.3).text(`Toegepaste artikelen: ${p.articles.map(articleLabel).join(", ")}`);
  h("Kenmerken");
  kv("Justitiële documentatie", RECIDIVE_LABEL[p?.recidive ?? "onbekend"]);
  kv("Letsel", LETSEL_LABEL[p?.letsel ?? "onbekend"]);
  kv("Proceshouding", BEKENTENIS_LABEL[p?.bekentenis ?? "onbekend"]);
  h("Waarom deze straf?");
  for (const w of ruleBasedWhy(c)) pdf.text(`• ${w}`, { paragraphGap: 2 });
  const weighed = c.circumstances.filter((x) => x.status === "meegewogen");
  if (weighed.length) {
    h("Meegewogen omstandigheden (met bronpassage)");
    for (const x of weighed) {
      pdf.font("Helvetica-Bold").text(`${CIRCUMSTANCES[x.code as keyof typeof CIRCUMSTANCES]?.label ?? x.code} (${x.polarity})`).font("Helvetica");
      quote(x.evidence);
    }
  }
  if (p?.motivation) { h("Strafmotivering (oorspronkelijke tekst)"); quote(p.motivation.slice(0, 2500)); }
  if (similar.length) {
    h("Vergelijkbare gepubliceerde uitspraken");
    for (const s of similar) pdf.text(`• ${s.ecli} (${s.court_name}, ${s.decision_date}) — ${s.outcome === "veroordeling" ? s.sentence_summary : OUTCOME_LABEL[s.outcome]} — vergelijkbaarheid ${s.score}%`);
  }
  h("Verantwoording");
  pdf.fontSize(8.5).fillColor(GREY).text("Dit rapport is automatisch samengesteld uit de gepubliceerde uitspraak (Open Data van de Rechtspraak). Strafgegevens en omstandigheden zijn regelgebaseerd geëxtraheerd met bronpassage en kunnen fouten bevatten; raadpleeg altijd de oorspronkelijke uitspraak. Niet alle politierechterzaken worden gepubliceerd; vergelijkingen hebben daardoor beperkte zeggingskracht. Dit rapport is geen juridisch advies.");
  pdf.text(`Gegenereerd op ${new Date().toLocaleString("nl-NL")} via Politierechter.nl.`);
  pdf.end();
  const buf = await done;
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="rapport-${ecli.replace(/:/g, "-")}.pdf"` } });
}
