import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { CaseList } from "@/components/CaseList";
import { categoryCounts, datasetMeta, recentCases } from "@/lib/search/query";
import { fmtNum, fmtDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [meta, cats, recent] = await Promise.all([datasetMeta(), categoryCounts(), recentCases(6)]);
  const popular = cats.filter((c) => c.code !== "overig" && c.n > 0).sort((a, b) => b.n - a.n).slice(0, 12);
  return (
    <>
      <section className="relative overflow-hidden bg-navy pb-16 pt-14 text-white sm:pb-20 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #C3A46B 0, transparent 40%), radial-gradient(circle at 80% 0%, #fff 0, transparent 35%)" }} />
        <div className="container-x relative">
          <div className="label !text-gold">Politierechter.nl</div>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-tight sm:text-6xl">Wat straft de politierechter?</h1>
          <p className="mt-4 max-w-2xl text-base text-white/75 sm:text-lg">Doorzoek Nederlandse politierechterzaken. Vergelijk opgelegde straffen en ontdek welke omstandigheden het oordeel beïnvloeden.</p>
          <div className="mt-8 max-w-3xl"><SearchBar large /></div>
          <dl className="mt-10 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat k="Gepubliceerde politierechteruitspraken" v={fmtNum(meta.total)} />
            <Stat k="Waarvan veroordelingen" v={fmtNum(meta.convictions)} />
            <Stat k="Periode" v={meta.first ? `${meta.first.slice(0, 4)}–${meta.last.slice(0, 4)}` : "–"} />
            <Stat k="Laatst bijgewerkt" v={meta.updated ? fmtDate(meta.updated) : "–"} />
          </dl>
        </div>
      </section>

      <div className="container-x relative z-10 -mt-8 grid gap-6 lg:grid-cols-3">
        <Link href="/statistieken" className="card card-pad group transition hover:-translate-y-0.5">
          <div className="label">Strafstatistieken</div>
          <div className="mt-2 font-serif text-xl text-navy">Tien interactieve grafieken</div>
          <p className="mt-1 text-sm text-[var(--ink-2)]">Strafverdeling, strafhoogte, eis OM tegenover uitspraak, recidive, letsel en verschillen tussen rechtbanken.</p>
          <span className="mt-3 inline-block text-sm font-medium text-gold-600 group-hover:underline">Naar het dashboard →</span>
        </Link>
        <Link href="/vergelijker" className="card card-pad group transition hover:-translate-y-0.5">
          <div className="label">Vergelijk mijn zaak</div>
          <div className="mt-2 font-serif text-xl text-navy">Strafvergelijker</div>
          <p className="mt-1 text-sm text-[var(--ink-2)]">Beschrijf een casus en vind vergelijkbare politierechteruitspraken — met transparante vergelijkbaarheidsscore.</p>
          <span className="mt-3 inline-block text-sm font-medium text-gold-600 group-hover:underline">Casus vergelijken →</span>
        </Link>
        <div className="card card-pad border-l-4 border-l-gold">
          <div className="label">Lees dit eerst</div>
          <p className="mt-2 text-sm text-[var(--ink-2)]">Niet alle politierechterzaken worden gepubliceerd. De beschikbare uitspraken zijn <strong>geen representatieve steekproef</strong>: rechtbanken publiceren vooral zaken die juridisch of maatschappelijk interessant zijn. Statistieken beschrijven daarom uitsluitend de gepubliceerde uitspraken.</p>
          <Link href="/over" className="mt-3 inline-block text-sm font-medium text-gold-600 hover:underline">Verantwoording & methode →</Link>
        </div>
      </div>

      <section className="container-x mt-14 grid gap-10 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h2 className="h-display text-2xl">Populaire strafbare feiten</h2>
          <p className="mt-1 text-sm text-[var(--ink-3)]">Aantal gepubliceerde uitspraken per delict.</p>
          <ul className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-white">
            {popular.map((c) => (
              <li key={c.code}>
                <Link href={`/delicten/${c.code}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-mist">
                  <span><span className="text-navy">{c.label}</span> <span className="ml-1 text-xs text-[var(--ink-3)]">{c.group_label}</span></span>
                  <span className="tabular-nums text-[var(--ink-2)]">{fmtNum(c.n)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/delicten" className="mt-3 inline-block text-sm font-medium text-gold-600 hover:underline">Alle strafbare feiten →</Link>
        </div>
        <div className="lg:col-span-3">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="h-display text-2xl">Recente uitspraken</h2>
              <p className="mt-1 text-sm text-[var(--ink-3)]">Meest recent gepubliceerd op Rechtspraak.nl.</p>
            </div>
            <Link href="/uitspraken" className="text-sm font-medium text-gold-600 hover:underline">Alle →</Link>
          </div>
          <div className="card card-pad mt-4"><CaseList rows={recent} /></div>
        </div>
      </section>
    </>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-white/50">{k}</dt>
      <dd className="mt-1 font-serif text-2xl text-white tabular-nums">{v}</dd>
    </div>
  );
}
