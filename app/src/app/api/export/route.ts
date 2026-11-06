import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { parseFilters, describeFilters } from "@/lib/filters";
import { searchCases } from "@/lib/search/query";
import { offenseLabel } from "@/lib/reference/offenses";
import { RECIDIVE_LABEL, LETSEL_LABEL, BEKENTENIS_LABEL, OUTCOME_LABEL } from "@/lib/labels";
import { COURT_BY_CODE } from "@/lib/reference/courts";

export async function GET(req: NextRequest) {
  const f = parseFilters(req.nextUrl.searchParams);
  const { rows, total } = await searchCases(f, { pageSize: 200, page: 1, sort: req.nextUrl.searchParams.get("sort") ?? "datum" });
  // grotere exports in pagina's van 200 (max 5.000 rijen)
  const all = [...rows];
  for (let p = 2; all.length < Math.min(total, 5000); p++) {
    const r = await searchCases(f, { pageSize: 200, page: p });
    if (!r.rows.length) break;
    all.push(...r.rows);
  }
  const wb = new ExcelJS.Workbook();
  wb.creator = "Politierechter.nl";
  const ws = wb.addWorksheet("Uitspraken");
  ws.columns = [
    { header: "ECLI", key: "ecli", width: 26 }, { header: "Rechtbank", key: "court", width: 26 }, { header: "Uitspraakdatum", key: "date", width: 14 },
    { header: "Strafbare feiten", key: "cats", width: 34 }, { header: "Meerdere feiten", key: "multi", width: 10 }, { header: "Uitkomst", key: "outcome", width: 18 },
    { header: "Opgelegde straf", key: "straf", width: 50 }, { header: "Eis OM", key: "eis", width: 40 },
    { header: "Taakstraf (uur)", key: "taak", width: 12 }, { header: "Onvoorw. gev. (dagen)", key: "onvw", width: 14 }, { header: "Voorw. gev. (dagen)", key: "vw", width: 14 }, { header: "Geldboete (€)", key: "boete", width: 12 },
    { header: "Documentatie", key: "rec", width: 30 }, { header: "Letsel", key: "letsel", width: 22 }, { header: "Proceshouding", key: "bek", width: 18 },
    { header: "Verificatie", key: "rev", width: 14 }, { header: "Link", key: "url", width: 50 },
  ];
  for (const r of all) {
    ws.addRow({ ecli: r.ecli, court: r.court_name, date: r.decision_date, cats: r.categories.map(offenseLabel).join(", "), multi: r.multi_offense ? "ja" : "nee",
      outcome: OUTCOME_LABEL[r.outcome] ?? r.outcome, straf: r.sentence_summary, eis: r.eis_summary, taak: r.taakstraf_uren, onvw: r.gev_onvw_dagen, vw: r.gev_vw_dagen, boete: r.geldboete_euro,
      rec: RECIDIVE_LABEL[r.recidive], letsel: LETSEL_LABEL[r.letsel], bek: BEKENTENIS_LABEL[r.bekentenis], rev: r.review_status, url: `https://uitspraken.rechtspraak.nl/details?id=${r.ecli}` });
  }
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14263D" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const info = wb.addWorksheet("Verantwoording");
  info.addRows([
    ["Politierechter.nl — export"], [`Gegenereerd: ${new Date().toLocaleString("nl-NL")}`], [`Aantal rijen: ${all.length} van ${total}`],
    [`Selectie: ${describeFilters(f, { cat: offenseLabel, court: (c) => COURT_BY_CODE.get(c)?.name ?? c }).join("; ") || "geen filters"}`],
    ["Bron: Open Data van de Rechtspraak (data.rechtspraak.nl). Straffen en omstandigheden zijn automatisch geëxtraheerd en kunnen fouten bevatten; controleer de oorspronkelijke uitspraak."],
    ["Niet alle politierechterzaken worden gepubliceerd; de gegevens vormen geen representatieve steekproef."],
    ["Gevangenisstraf genormaliseerd naar dagen (week = 7, maand = 30, jaar = 365)."],
  ]);
  info.getColumn(1).width = 120;
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="politierechter-export-${new Date().toISOString().slice(0, 10)}.xlsx"` },
  });
}
