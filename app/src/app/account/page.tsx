import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { AuthForms, LogoutButton, DeleteButton } from "./AccountClient";
import { filtersToParams, type Filters } from "@/lib/filters";
import { offenseLabel } from "@/lib/reference/offenses";
import { fmtDate } from "@/lib/labels";

export const metadata = { title: "Mijn onderzoek" };
export const dynamic = "force-dynamic";

export default async function Account() {
  const u = await currentUser();
  if (!u) return <div className="container-x max-w-xl py-12"><h1 className="h-display text-3xl">Persoonlijke onderzoeksomgeving</h1><p className="mt-2 text-[var(--ink-2)]">Bewaar uitspraken, zoekopdrachten en vergelijkingen, en ontvang meldingen bij nieuwe relevante uitspraken.</p><AuthForms /></div>;
  const [favs, searches, comps, notes] = await Promise.all([
    q<{ ecli: string; note: string | null; categories: string[]; sentence_summary: string | null; decision_date: string }>("SELECT f.ecli, f.note, p.categories, p.sentence_summary, to_char(d.decision_date,'YYYY-MM-DD') AS decision_date FROM favorites f JOIN documents d USING (ecli) LEFT JOIN case_profiles p USING (ecli) WHERE f.user_id=$1 ORDER BY f.created_at DESC", [u.id]),
    q<{ id: number; name: string; query: Filters; alert: boolean; created_at: string }>("SELECT id, name, query, alert, to_char(created_at,'YYYY-MM-DD') AS created_at FROM saved_searches WHERE user_id=$1 ORDER BY created_at DESC", [u.id]),
    q<{ id: number; name: string; eclis: string[]; created_at: string; case_text: string | null }>("SELECT id, name, eclis, case_text, to_char(created_at,'YYYY-MM-DD') AS created_at FROM saved_comparisons WHERE user_id=$1 ORDER BY created_at DESC", [u.id]),
    q<{ id: number; message: string; ecli: string | null; read: boolean; created_at: string }>("SELECT id, message, ecli, read, to_char(created_at,'YYYY-MM-DD') AS created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30", [u.id]),
  ]);
  return (
    <div className="container-x py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="label">Persoonlijke onderzoeksomgeving</div><h1 className="h-display mt-1 text-3xl">Welkom{u.name ? `, ${u.name}` : ""}</h1><p className="text-sm text-[var(--ink-3)]">{u.email}</p></div>
        <div className="flex gap-2">{u.role === "admin" && <Link className="btn-gold" href="/beheer">Beheeromgeving</Link>}<LogoutButton /></div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="font-serif text-xl text-navy">Meldingen</h2>
          {notes.length ? <ul className="mt-3 space-y-2 text-sm">{notes.map((n) => <li key={n.id} className={n.read ? "text-[var(--ink-3)]" : "text-navy"}>{n.created_at} — {n.ecli ? <Link className="underline" href={`/uitspraak/${encodeURIComponent(n.ecli)}`}>{n.message}</Link> : n.message}</li>)}</ul> : <p className="mt-2 text-sm text-[var(--ink-3)]">Nog geen meldingen. Bewaar een zoekopdracht met ‘melding’ om op de hoogte te blijven van nieuwe uitspraken.</p>}
        </section>
        <section className="card card-pad">
          <h2 className="font-serif text-xl text-navy">Bewaarde zoekopdrachten</h2>
          {searches.length ? <ul className="mt-3 divide-y divide-[var(--line)] text-sm">{searches.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <Link className="text-navy underline" href={`/zoeken?${filtersToParams(s.query).toString()}`}>{s.name}</Link>
              <span className="flex items-center gap-2 text-xs text-[var(--ink-3)]">{s.alert && <span className="badge-stat">melding aan</span>}{s.created_at}<DeleteButton url="/api/me/searches" body={{ id: s.id }} /></span>
            </li>))}</ul> : <p className="mt-2 text-sm text-[var(--ink-3)]">Gebruik ‘Zoekopdracht bewaren’ op de zoekpagina.</p>}
        </section>
        <section className="card card-pad">
          <h2 className="font-serif text-xl text-navy">Favoriete uitspraken</h2>
          {favs.length ? <ul className="mt-3 divide-y divide-[var(--line)] text-sm">{favs.map((f) => (
            <li key={f.ecli} className="py-2"><Link className="font-mono text-xs text-navy underline" href={`/uitspraak/${encodeURIComponent(f.ecli)}`}>{f.ecli}</Link> <span className="text-xs text-[var(--ink-3)]">{fmtDate(f.decision_date)}</span><div>{f.categories?.map(offenseLabel).join(", ")} — {f.sentence_summary}</div></li>
          ))}</ul> : <p className="mt-2 text-sm text-[var(--ink-3)]">Nog geen favorieten.</p>}
          {favs.length > 1 && <Link className="mt-3 inline-block text-sm text-gold-600 underline" href={`/vergelijk?ecli=${favs.slice(0, 4).map((f) => f.ecli).join(",")}`}>Vergelijk favorieten naast elkaar →</Link>}
          {favs.length > 0 && <a className="ml-4 mt-3 inline-block text-sm text-gold-600 underline" href={`/api/export?ecli=${favs.map((f) => f.ecli).join(",")}`}>Exporteer naar Excel</a>}
        </section>
        <section className="card card-pad">
          <h2 className="font-serif text-xl text-navy">Bewaarde vergelijkingen</h2>
          {comps.length ? <ul className="mt-3 divide-y divide-[var(--line)] text-sm">{comps.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2 py-2"><div><div className="font-medium text-navy">{c.name}</div><div className="line-clamp-2 text-xs text-[var(--ink-3)]">{c.case_text}</div><Link className="text-xs text-gold-600 underline" href={`/vergelijk?ecli=${c.eclis.slice(0, 4).join(",")}`}>Top-4 naast elkaar</Link></div><DeleteButton url="/api/me/comparisons" body={{ id: c.id }} /></li>
          ))}</ul> : <p className="mt-2 text-sm text-[var(--ink-3)]">Bewaar een vergelijking vanuit de strafvergelijker.</p>}
        </section>
      </div>
    </div>
  );
}
