import Link from "next/link";
import { loadCase } from "@/lib/case/load";
import { offenseLabel } from "@/lib/reference/offenses";
import { CIRCUMSTANCES } from "@/lib/extract/circumstances";
import { RECIDIVE_LABEL, LETSEL_LABEL, BEKENTENIS_LABEL, OUTCOME_LABEL, fmtDate } from "@/lib/labels";
import { CompareLoader } from "./CompareLoader";

export const metadata = { title: "Uitspraken naast elkaar" };

export default async function Page({ searchParams }: { searchParams: Promise<{ ecli?: string }> }) {
  const eclis = ((await searchParams).ecli ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 4);
  if (!eclis.length) return <div className="container-x py-8"><h1 className="h-display text-3xl">Uitspraken naast elkaar vergelijken</h1><CompareLoader /></div>;
  const cases = (await Promise.all(eclis.map(loadCase))).filter((c): c is NonNullable<typeof c> => !!c);
  const rows: [string, (c: (typeof cases)[number]) => React.ReactNode][] = [
    ["Rechtbank", (c) => c.doc.court_name], ["Uitspraakdatum", (c) => fmtDate(c.doc.decision_date)],
    ["Strafbare feiten", (c) => c.profile?.categories.map(offenseLabel).join(", ") || "–"],
    ["Uitkomst", (c) => OUTCOME_LABEL[c.profile?.outcome ?? "onbekend"]],
    ["Opgelegde straf", (c) => <b className="text-navy">{c.profile?.sentence_summary}</b>], ["Eis OM", (c) => c.profile?.eis_summary ?? "niet vermeld"],
    ["Documentatie", (c) => RECIDIVE_LABEL[c.profile?.recidive ?? "onbekend"]], ["Letsel", (c) => LETSEL_LABEL[c.profile?.letsel ?? "onbekend"]],
    ["Proceshouding", (c) => BEKENTENIS_LABEL[c.profile?.bekentenis ?? "onbekend"]],
    ["Verzwarend meegewogen", (c) => [...new Set(c.circumstances.filter((x) => x.status === "meegewogen" && x.polarity === "verzwarend").map((x) => CIRCUMSTANCES[x.code as keyof typeof CIRCUMSTANCES]?.label))].join(", ") || "–"],
    ["Verminderend meegewogen", (c) => [...new Set(c.circumstances.filter((x) => x.status === "meegewogen" && x.polarity === "verminderend").map((x) => CIRCUMSTANCES[x.code as keyof typeof CIRCUMSTANCES]?.label))].join(", ") || "–"],
    ["Inhoudsindicatie", (c) => <span className="text-xs">{c.doc.inhoudsindicatie ?? "–"}</span>],
    ["Strafmotivering", (c) => <div className="passage max-h-64 overflow-y-auto text-xs">{c.profile?.motivation?.slice(0, 2000) ?? "–"}</div>],
  ];
  return (
    <div className="container-x py-8">
      <h1 className="h-display text-3xl">Uitspraken naast elkaar</h1>
      <div className="card mt-6 overflow-x-auto">
        <table className="table-x min-w-[720px]">
          <thead><tr><th className="w-40"></th>{cases.map((c) => <th key={c.doc.ecli}><Link className="font-mono normal-case text-navy underline" href={`/uitspraak/${encodeURIComponent(c.doc.ecli)}`}>{c.doc.ecli}</Link></th>)}</tr></thead>
          <tbody>{rows.map(([l, fn]) => <tr key={l}><td className="label !normal-case">{l}</td>{cases.map((c) => <td key={c.doc.ecli} className="text-sm">{fn(c)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
