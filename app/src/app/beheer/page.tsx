import Link from "next/link";
import { redirect } from "next/navigation";
import { q } from "@/lib/db";
import { adminOrNull } from "@/lib/admin";
import { offenseLabel } from "@/lib/reference/offenses";
import { JobButtons, SourceToggle } from "./BeheerClient";
import { fmtNum } from "@/lib/labels";

export const metadata = { title: "Beheer" };
export const dynamic = "force-dynamic";

export default async function Beheer({ searchParams }: { searchParams: Promise<{ queue?: string }> }) {
  if (!(await adminOrNull())) redirect("/account");
  const queue = (await searchParams).queue ?? "kwaliteit";
  const [runs, jobs, disc, quality, review, auditLog, sources, cats] = await Promise.all([
    q<{ id: number; kind: string; source_code: string | null; started_at: string; finished_at: string | null; status: string; stats: object; error: string | null }>("SELECT id, kind, source_code, to_char(started_at,'YYYY-MM-DD HH24:MI') AS started_at, to_char(finished_at,'HH24:MI') AS finished_at, status, stats, error FROM import_runs ORDER BY id DESC LIMIT 15"),
    q<{ status: string; type: string; n: number }>("SELECT status, type, count(*)::int AS n FROM jobs GROUP BY 1,2 ORDER BY 1,2"),
    q<{ fetch_status: string; error: string | null; n: number }>("SELECT fetch_status, coalesce(error,'') AS error, count(*)::int AS n FROM discovered_eclis GROUP BY 1,2 ORDER BY 3 DESC LIMIT 10"),
    q<{ k: string; n: number }>(`SELECT 'totaal' k, count(*)::int n FROM case_profiles
      UNION ALL SELECT 'zonder delict', count(*)::int FROM case_profiles WHERE primary_category IS NULL
      UNION ALL SELECT 'uitkomst onbekend', count(*)::int FROM case_profiles WHERE outcome='onbekend'
      UNION ALL SELECT 'veroordeling zonder hoofdstraf', count(*)::int FROM case_profiles WHERE outcome='veroordeling' AND coalesce(taakstraf_uren,0)+coalesce(gev_onvw_dagen,0)+coalesce(gev_vw_dagen,0)+coalesce(geldboete_euro,0)=0
      UNION ALL SELECT 'straf alleen uit inhoudsindicatie', count(DISTINCT ecli)::int FROM sentence_components WHERE origin='opgelegd' AND evidence_start IS NULL AND extractor <> 'handmatig'
      UNION ALL SELECT 'kwaliteit < 70%', count(*)::int FROM case_profiles WHERE extraction_quality < 0.7
      UNION ALL SELECT 'geverifieerd', count(*)::int FROM case_profiles WHERE review_status='geverifieerd'
      UNION ALL SELECT 'gecorrigeerd', count(*)::int FROM case_profiles WHERE review_status='gecorrigeerd'`),
    q<{ ecli: string; primary_category: string | null; outcome: string; sentence_summary: string | null; extraction_quality: number; review_status: string }>(
      queue === "nieuw"
        ? "SELECT p.ecli, p.primary_category, p.outcome, p.sentence_summary, p.extraction_quality, p.review_status FROM case_profiles p JOIN documents d USING (ecli) WHERE p.review_status='auto' ORDER BY d.fetched_at DESC LIMIT 40"
        : "SELECT ecli, primary_category, outcome, sentence_summary, extraction_quality, review_status FROM case_profiles WHERE review_status='auto' ORDER BY extraction_quality, ecli DESC LIMIT 40"),
    q<{ at: string; email: string | null; action: string; entity: string; entity_id: string; reason: string | null }>("SELECT to_char(a.at,'YYYY-MM-DD HH24:MI') AS at, u.email, a.action, a.entity, a.entity_id, a.reason FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 20"),
    q<{ code: string; name: string; enabled: boolean; rate_limit_ms: number }>("SELECT code, name, enabled, rate_limit_ms FROM sources ORDER BY code"),
    q<{ cat: string | null; n: number; avgq: number }>("SELECT primary_category AS cat, count(*)::int AS n, round(avg(extraction_quality)::numeric,2)::float AS avgq FROM case_profiles GROUP BY 1 ORDER BY 2 DESC LIMIT 12"),
  ]);
  return (
    <div className="container-x py-8">
      <div className="label">Beheeromgeving</div>
      <h1 className="h-display mt-1 text-3xl">Beheer & datakwaliteit</h1>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card card-pad xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-serif text-xl text-navy">Importprocessen</h2><JobButtons /></div>
          <div className="mt-3 overflow-x-auto"><table className="table-x">
            <thead><tr><th>#</th><th>Proces</th><th>Bron</th><th>Start</th><th>Einde</th><th>Status</th><th>Statistiek</th></tr></thead>
            <tbody>{runs.map((r) => <tr key={r.id}><td>{r.id}</td><td>{r.kind}</td><td className="text-xs">{r.source_code}</td><td className="text-xs">{r.started_at}</td><td className="text-xs">{r.finished_at ?? "loopt"}</td><td><span className={r.status === "ok" ? "badge-stat" : r.status === "running" ? "badge-fact" : "badge bg-red-50 text-red-700"}>{r.status}</span></td><td className="font-mono text-[10.5px]">{JSON.stringify(r.stats)}{r.error && <div className="text-red-700">{r.error.slice(0, 160)}</div>}</td></tr>)}</tbody>
          </table></div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div><div className="label mb-1">Ontdekte ECLI’s</div><ul className="text-xs">{disc.map((d, i) => <li key={i}>{d.fetch_status} {d.error && `— ${d.error}`}: <b>{fmtNum(d.n)}</b></li>)}</ul></div>
            <div><div className="label mb-1">Wachtrij (jobs)</div>{jobs.length ? <ul className="text-xs">{jobs.map((j, i) => <li key={i}>{j.type} · {j.status}: <b>{j.n}</b></li>)}</ul> : <p className="text-xs text-[var(--ink-3)]">Leeg</p>}</div>
          </div>
        </section>
        <section className="card card-pad">
          <h2 className="font-serif text-xl text-navy">Datakwaliteit</h2>
          <ul className="mt-3 space-y-1.5 text-sm">{quality.map((x) => <li key={x.k} className="flex justify-between"><span className="text-[var(--ink-2)]">{x.k}</span><b className="tabular-nums text-navy">{fmtNum(x.n)}</b></li>)}</ul>
          <div className="label mb-1 mt-4">Gem. extractiekwaliteit per delict</div>
          <ul className="space-y-1 text-xs">{cats.map((c) => <li key={c.cat ?? "x"} className="flex justify-between"><span>{offenseLabel(c.cat)}</span><span>{c.n} · {Math.round(c.avgq * 100)}%</span></li>)}</ul>
        </section>
        <section className="card card-pad xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-xl text-navy">Controlewachtrij</h2>
            <div className="flex gap-2 text-sm"><Link className={queue === "kwaliteit" ? "chip-on" : "chip"} href="/beheer?queue=kwaliteit">Laagste kwaliteit</Link><Link className={queue === "nieuw" ? "chip-on" : "chip"} href="/beheer?queue=nieuw">Nieuwste uitspraken</Link></div>
          </div>
          <table className="table-x mt-3"><thead><tr><th>ECLI</th><th>Delict</th><th>Uitkomst / straf</th><th>Kwaliteit</th><th></th></tr></thead>
            <tbody>{review.map((r) => <tr key={r.ecli}><td className="font-mono text-xs">{r.ecli}</td><td className="text-xs">{offenseLabel(r.primary_category)}</td><td className="text-xs">{r.outcome}: {r.sentence_summary}</td><td>{Math.round(r.extraction_quality * 100)}%</td><td><Link className="text-sm text-gold-600 underline" href={`/beheer/uitspraak/${encodeURIComponent(r.ecli)}`}>controleren</Link></td></tr>)}</tbody>
          </table>
        </section>
        <section className="card card-pad">
          <h2 className="font-serif text-xl text-navy">Bronnen</h2>
          <ul className="mt-3 space-y-2 text-sm">{sources.map((s) => <li key={s.code} className="flex items-center justify-between gap-2"><span>{s.name}<span className="block text-[11px] text-[var(--ink-3)]">≥ {s.rate_limit_ms} ms tussen verzoeken</span></span><SourceToggle code={s.code} enabled={s.enabled} /></li>)}</ul>
          <h2 className="mt-6 font-serif text-xl text-navy">Auditlog</h2>
          <ul className="mt-2 space-y-1.5 text-xs">{auditLog.map((a, i) => <li key={i}><span className="text-[var(--ink-3)]">{a.at}</span> {a.email ?? "systeem"} — {a.action} {a.entity} <span className="font-mono">{a.entity_id}</span>{a.reason && <> — “{a.reason}”</>}</li>)}</ul>
        </section>
      </div>
    </div>
  );
}
