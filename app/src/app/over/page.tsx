import { q } from "@/lib/db";
import { datasetMeta } from "@/lib/search/query";
import { fmtNum, fmtDate } from "@/lib/labels";
import { lovsGeneral } from "@/lib/reference/lovs";
import evaluation from "../../../data/extraction-evaluation.json";

export const metadata = { title: "Over de databank" };
export const dynamic = "force-dynamic";

export default async function Over() {
  const [meta, sources, runs, quality, disc] = await Promise.all([
    datasetMeta(),
    q<{ code: string; name: string; url: string; access_method: string; license: string; terms_note: string }>("SELECT * FROM sources ORDER BY code"),
    q<{ kind: string; source_code: string | null; finished_at: string; status: string; stats: Record<string, unknown> }>("SELECT kind, source_code, to_char(finished_at,'YYYY-MM-DD HH24:MI') AS finished_at, status, stats FROM import_runs WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 6"),
    q<{ k: string; n: number }>(`SELECT 'met_straf' AS k, count(*)::int AS n FROM case_profiles WHERE outcome='veroordeling'
       UNION ALL SELECT 'met_eis', count(*)::int FROM case_profiles WHERE eis_summary IS NOT NULL
       UNION ALL SELECT 'met_motivering', count(*)::int FROM case_profiles WHERE motivation IS NOT NULL
       UNION ALL SELECT 'geclassificeerd', count(*)::int FROM case_profiles WHERE primary_category IS NOT NULL
       UNION ALL SELECT 'geverifieerd', count(*)::int FROM case_profiles WHERE review_status <> 'auto'`),
    q<{ fetch_status: string; n: number }>("SELECT fetch_status, count(*)::int AS n FROM discovered_eclis GROUP BY 1"),
  ]);
  const Q = Object.fromEntries(quality.map((r) => [r.k, r.n]));
  const D = Object.fromEntries(disc.map((r) => [r.fetch_status, r.n]));
  const lovs = lovsGeneral();
  return (
    <div className="container-x max-w-4xl py-10">
      <div className="label">Verantwoording</div>
      <h1 className="h-display mt-1 text-4xl">Over de databank</h1>
      <p className="mt-3 text-lg text-[var(--ink-2)]">Politierechter.nl bevat uitsluitend <strong>gepubliceerde</strong> vonnissen van de politierechter (enkelvoudige strafkamer van de rechtbank), afkomstig uit Open Data van de Rechtspraak.</p>

      <div className="mt-6 rounded-xl border-l-4 border-gold bg-white p-5 shadow-card">
        <h2 className="font-serif text-xl text-navy">Belangrijkste beperking: geen representatieve steekproef</h2>
        <p className="mt-2 text-[var(--ink-2)]">Politierechters behandelen jaarlijks een zeer groot aantal zaken, maar slechts een klein deel daarvan wordt gepubliceerd. Rechtbanken publiceren vooral uitspraken die juridisch of maatschappelijk interessant zijn, zoals ongebruikelijke strafmotiveringen, vrijspraken en zaken met media-aandacht. Bovendien worden veel politierechterzaken mondeling afgedaan en daarom niet uitgeschreven. Alle cijfers op dit platform beschrijven dus de <em>gepubliceerde</em> uitspraken en zijn niet zonder meer te generaliseren naar de strafpraktijk als geheel. Verschillen tussen rechtbanken kunnen het gevolg zijn van verschillen in publicatiebeleid.</p>
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        {[["Politierechteruitspraken", fmtNum(meta.total)], ["Periode", meta.first ? `${fmtDate(meta.first)} – ${fmtDate(meta.last)}` : "–"], ["Laatst bijgewerkt", meta.updated ?? "–"],
          ["Met herkende straf", fmtNum(Q.met_straf)], ["Met herkende eis OM", fmtNum(Q.met_eis)], ["Door redactie geverifieerd", fmtNum(Q.geverifieerd)]].map(([k, v]) => (
          <div key={k} className="card p-4"><div className="label">{k}</div><div className="mt-1 font-serif text-xl text-navy">{v}</div></div>
        ))}
      </section>

      <section className="mt-12 space-y-4 text-[var(--ink-2)]">
        <h2 className="h-display text-2xl">Bronnen en hergebruik</h2>
        {sources.map((s) => (
          <div key={s.code} className="card card-pad">
            <div className="font-medium text-navy">{s.name} — <a className="underline" href={s.url} rel="noopener">{s.url}</a></div>
            <div className="mt-1 text-sm"><b>Toegang:</b> {s.access_method}</div>
            <div className="mt-1 text-sm"><b>Licentie:</b> {s.license}</div>
            <div className="mt-1 text-sm"><b>Gebruik:</b> {s.terms_note}</div>
          </div>
        ))}
        <h3 className="pt-4 font-serif text-xl text-navy">Onderzochte aanvullende bronnen</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          <li><b>Legal Intelligence, Navigator, InView</b> (commerciële databanken): bevatten vooral dezelfde Rechtspraak-publicaties plus annotaties. Hergebruik is contractueel niet toegestaan zonder licentie; niet gebruikt. Een licentie kan worden onderzocht voor annotaties en literatuur.</li>
          <li><b>Juridische tijdschriften</b> (o.a. NJ, NbSr): auteursrechtelijk beschermd; alleen bruikbaar als verwijzing, niet als bron voor de databank.</li>
          <li><b>Niet-gepubliceerde uitspraken</b>: niet openbaar via Open Data. Mogelijke route: een onderzoeksverzoek aan de Raad voor de rechtspraak (wetenschappelijk onderzoek, geanonimiseerde of geaggregeerde gegevens). Dit platform doet geen aannames over de beschikbaarheid hiervan; er zijn geen niet-gepubliceerde uitspraken opgenomen.</li>
          <li><b>Geaggregeerde strafstatistieken</b> (CBS/WODC, <i>Criminaliteit en rechtshandhaving</i>): geschikt als context voor representativiteit, niet op uitspraakniveau. Nog niet geïntegreerd.</li>
          <li><b>LOVS-oriëntatiepunten</b>: officieel document van de Rechtspraak (versie {lovs.version}); fragmenten worden letterlijk getoond met paginaverwijzing en link naar <a className="underline" href={lovs.url}>het originele document</a>.</li>
        </ul>
      </section>

      <section className="mt-12 space-y-3 text-[var(--ink-2)]">
        <h2 className="h-display text-2xl">Hoe de databank wordt opgebouwd</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li><b>Ontdekken.</b> De zoekdienst van uitspraken.rechtspraak.nl levert de ECLI-nummers van strafuitspraken van rechtbanken waarin ‘politierechter’ voorkomt (de Open Data-API kan niet op procedure filteren). Daarnaast wordt de Open Data-feed incrementeel gevolgd op nieuwe en gewijzigde uitspraken. Deduplicatie gebeurt op ECLI.</li>
          <li><b>Ophalen.</b> Per ECLI wordt het volledige XML-document via de Open Data-API opgehaald (rate limited, herstartbaar, met retries). Alleen documenten waarvan de kop het vonnis aanmerkt als vonnis van de politierechter worden opgeslagen; de herkenningspassage wordt bewaard. Status: {fmtNum(D.fetched ?? 0)} opgeslagen, {fmtNum(D.skipped ?? 0)} overgeslagen (geen politierechtervonnis), {fmtNum(D.pending ?? 0)} in de wachtrij.</li>
          <li><b>Versiebeheer.</b> Wijzigt de Rechtspraak een gepubliceerde tekst, dan wordt de vorige versie bewaard en de extractie opnieuw uitgevoerd.</li>
          <li><b>Extraheren.</b> Een regelgebaseerde, juridisch gecontroleerde extractor (‘rules-v1’) herkent secties (tenlastelegging, bewezenverklaring, kwalificatie, strafmotivering, beslissing), strafcomponenten (taakstraf, gevangenisstraf met voorwaardelijk deel en proeftijd, geldboete, ontzegging, maatregelen), de eis van de officier van justitie, de juridische kwalificatie, toegepaste wetsartikelen en omstandigheden. Iedere extractie bewaart de letterlijke bronpassage en de positie in de tekst.</li>
          <li><b>Controleren.</b> Redacteuren kunnen in de beheeromgeving extracties verifiëren of corrigeren; correcties worden nooit door een nieuwe automatische run overschreven en worden in een auditlog vastgelegd.</li>
        </ol>
        <h3 className="pt-3 font-serif text-xl text-navy">Methodologische keuzes</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          <li>Gevangenisstraf wordt genormaliseerd naar dagen (week = 7, maand = 30, jaar = 365 dagen). Hechtenis wordt bij gevangenisstraf geteld.</li>
          <li>De eis van de officier van justitie en de opgelegde straf worden afzonderlijk opgeslagen en alleen per gelijksoortige component vergeleken.</li>
          <li>Bij meerdere bewezen feiten is één gezamenlijke straf opgelegd. Deze wordt niet aan één delict toegeschreven; filter op ‘uitsluitend dit delict’ voor zuivere vergelijkingen.</li>
          <li>Recidive: alleen wat de uitspraak <em>uitdrukkelijk</em> vermeldt. ‘Niet vermeld’ betekent onbekend — nooit ‘blanco strafblad’. Onderscheiden: blanco, geen relevante eerdere veroordelingen, eerdere veroordelingen (relevantie niet vermeld), relevante eerdere veroordelingen.</li>
          <li>Omstandigheden zijn ‘meegewogen’ als zij in de strafmotivering van de politierechter staan, en ‘genoemd’ als zij elders voorkomen (bijv. in de eis of het pleidooi).</li>
          <li>Verschillen tussen groepen in grafieken zijn statistische samenhangen, geen causale effecten.</li>
          <li>Tenuitvoerlegging van eerder voorwaardelijk opgelegde straffen telt niet mee als straf in de zaak.</li>
        </ul>
      </section>

      <section className="mt-12 space-y-3 text-sm text-[var(--ink-2)]">
        <h2 className="h-display text-2xl">Gemeten nauwkeurigheid van de strafextractie</h2>
        <p>{evaluation.method} Meting van {evaluation.generated.slice(0, 10)}:</p>
        <table className="table-x card"><thead><tr><th>Strafcomponent</th><th>Vergeleken uitspraken</th><th>Overeenstemming</th></tr></thead>
          <tbody>{evaluation.report.map((r) => <tr key={r.component}><td>{r.component}</td><td>{r.vergeleken}</td><td>{r.overeenstemming}%</td></tr>)}</tbody></table>
        <p className="text-xs text-[var(--ink-3)]">Een deel van de afwijkingen ligt aan de referentie zelf (inhoudsindicaties die de straf in hoger beroep of van medeverdachten noemen). De meting wordt na iedere wijziging van de extractor opnieuw uitgevoerd (<code>npm run evaluate</code>). Door de redactie geverifieerde uitspraken zijn als zodanig gemarkeerd.</p>
      </section>

      <section className="mt-12 space-y-3 text-sm text-[var(--ink-2)]">
        <h2 className="h-display text-2xl">AI en betrouwbaarheid</h2>
        <p>Alle feitelijke gegevens op het platform komen uit de regelgebaseerde extractie en zijn herleidbaar tot een passage. Waar AI (Claude) wordt ingezet — de uitleg ‘Waarom deze straf?’ en de AI-casusanalyse — krijgt het model uitsluitend bronpassages en uitspraken uit deze databank aangereikt. Citaten worden automatisch tegen de brontekst gecontroleerd; niet-terug te vinden citaten en verwijzingen naar niet-aangeleverde ECLI-nummers worden verwijderd. AI-output is altijd gemarkeerd als <em>interpretatie</em> en wordt nooit als vaststaand feit in de databank opgenomen.</p>
      </section>

      <section className="mt-12 space-y-3 text-sm text-[var(--ink-2)]">
        <h2 className="h-display text-2xl">Privacy (AVG)</h2>
        <p>De Rechtspraak anonimiseert uitspraken vóór publicatie. Dit platform verwerkt geen aanvullende persoonsgegevens van procespartijen, verrijkt uitspraken niet met persoonsgegevens en probeert geen personen te herleiden. Teksten die gebruikers in de strafvergelijker invoeren worden alleen opgeslagen als de gebruiker een vergelijking bewaart. Accounts bevatten uitsluitend e-mailadres, (optioneel) naam en een gehasht wachtwoord.</p>
      </section>

      <section className="mt-12">
        <h2 className="h-display text-2xl">Recente importprocessen</h2>
        <table className="table-x mt-3 card">
          <thead><tr><th>Proces</th><th>Bron</th><th>Afgerond</th><th>Status</th><th>Resultaat</th></tr></thead>
          <tbody>{runs.map((r, i) => <tr key={i}><td>{r.kind}</td><td>{r.source_code ?? "–"}</td><td>{r.finished_at}</td><td>{r.status}</td><td className="font-mono text-[11px]">{JSON.stringify(r.stats)}</td></tr>)}</tbody>
        </table>
      </section>

      <p className="mt-12 text-xs text-[var(--ink-3)]">Politierechter.nl is een onafhankelijk onderzoeksinstrument en geeft geen juridisch advies. Raadpleeg voor uw eigen zaak een advocaat. De beschikbaarheid van de domeinnaam politierechter.nl dient vóór ingebruikname te worden gecontroleerd bij SIDN.</p>
    </div>
  );
}
