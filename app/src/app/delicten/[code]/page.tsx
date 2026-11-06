import { notFound } from "next/navigation";
import Link from "next/link";
import { OFFENSE_BY_CODE } from "@/lib/reference/offenses";
import { ARTICLE_BY_CODE, articleLabel, articleUrl } from "@/lib/reference/articles";
import { StatsDashboard } from "@/components/StatsDashboard";
import { filterOptions } from "@/lib/options";
import { parseFilters } from "@/lib/filters";
import { searchCases } from "@/lib/search/query";
import { CaseList } from "@/components/CaseList";
import { lovsFor } from "@/lib/reference/lovs";

type P = { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: P) {
  return { title: OFFENSE_BY_CODE.get((await params).code)?.label ?? "Delict" };
}

export default async function OffensePage({ params, searchParams }: P) {
  const { code } = await params;
  const o = OFFENSE_BY_CODE.get(code);
  if (!o) notFound();
  const f = parseFilters(await searchParams);
  const fixed = { cat: [code] };
  const cases = await searchCases({ ...f, ...fixed }, { pageSize: 15 });
  const lovs = lovsFor(code);
  return (
    <div className="container-x py-8">
      <nav className="text-xs text-[var(--ink-3)]"><Link href="/delicten" className="hover:underline">Strafbare feiten</Link> / {o.label}</nav>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="h-display text-3xl sm:text-4xl">{o.label}</h1>
          <p className="mt-2 text-[var(--ink-2)]">{o.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {o.articles.map((a) => <a key={a} className="chip" href={articleUrl(a) ?? "#"} target="_blank" rel="noopener" title={ARTICLE_BY_CODE.get(a)?.title}>{articleLabel(a)} — {ARTICLE_BY_CODE.get(a)?.title} ↗</a>)}
          </div>
          {o.articles.flatMap((a) => ARTICLE_BY_CODE.get(a)?.history ?? []).map((h, i) => <p key={i} className="mt-2 text-xs text-[var(--ink-3)]">Wetshistorie: per {h.from} — {h.note}</p>)}
        </div>
        <Link href={`/zoeken?cat=${code}`} className="btn-primary">Alle {cases.total} uitspraken doorzoeken</Link>
      </div>
      {lovs && (
        <div className="mt-5 rounded-lg border border-[var(--line)] bg-white p-4 text-sm text-[var(--ink-2)]">
          <details>
            <summary className="cursor-pointer"><strong className="text-navy">LOVS-oriëntatiepunt: {lovs.heading}</strong> — {lovs.note}</summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre font-mono text-[11.5px] leading-snug text-navy">{lovs.text}</pre>
            <a className="mt-2 inline-block text-gold-600 underline" href={lovs.url} target="_blank" rel="noopener">Officieel document (Rechtspraak) ↗</a>
            <p className="mt-1 text-xs text-[var(--ink-3)]">Oriëntatiepunten zijn geen tarieven; de rechter weegt alle omstandigheden van het geval.</p>
          </details>
        </div>
      )}
      <div className="mt-6">
        <StatsDashboard initial={f} options={filterOptions()} fixed={fixed} variant="offense" />
      </div>
      <section className="card card-pad mt-6">
        <div className="flex items-end justify-between">
          <h2 className="h-display text-2xl">Individuele uitspraken</h2>
          <Link href={`/zoeken?cat=${code}`} className="text-sm font-medium text-gold-600 hover:underline">Alle uitspraken met filters →</Link>
        </div>
        <div className="mt-4"><CaseList rows={cases.rows} /></div>
      </section>
    </div>
  );
}
