import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { adminOrNull } from "@/lib/admin";
import { loadCase } from "@/lib/case/load";
import { filterOptions } from "@/lib/options";
import { ReviewEditor } from "./ReviewEditor";
import { HighlightedText } from "@/components/HighlightedText";

export const dynamic = "force-dynamic";

export default async function Review({ params }: { params: Promise<{ ecli: string }> }) {
  if (!(await adminOrNull())) redirect("/account");
  const ecli = decodeURIComponent((await params).ecli);
  const c = await loadCase(ecli);
  if (!c || !c.profile) notFound();
  const marks = [...c.components, ...c.circumstances].filter((x) => x.evidence_start != null).map((x) => ({ start: x.evidence_start!, end: x.evidence_end!, label: "bron" }));
  return (
    <div className="container-x py-8">
      <Link href="/beheer" className="text-xs text-[var(--ink-3)] hover:underline">← Beheer</Link>
      <h1 className="h-display mt-2 text-2xl">Controle: <span className="font-mono text-xl">{ecli}</span></h1>
      <p className="text-sm text-[var(--ink-3)]">{c.doc.court_name} · <a className="underline" href={c.doc.deeplink} target="_blank" rel="noopener">Rechtspraak.nl ↗</a> · <Link className="underline" href={`/uitspraak/${encodeURIComponent(ecli)}`}>publieke pagina</Link></p>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ReviewEditor ecli={ecli} profile={JSON.parse(JSON.stringify(c.profile))} components={c.components} circumstances={c.circumstances} options={filterOptions()} />
        <div className="card card-pad max-h-[85vh] overflow-y-auto"><HighlightedText text={c.doc.full_text} marks={marks} /></div>
      </div>
    </div>
  );
}
