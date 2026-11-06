# Politierechter.nl

**Wat straft de politierechter?** — een onderzoeksplatform voor gepubliceerde Nederlandse politierechteruitspraken: juridische zoekmachine, strafdatabank, interactief strafdashboard, strafvergelijker en (optionele) AI-analyse.

> Werktitel. Controleer de beschikbaarheid van de domeinnaam `politierechter.nl` bij SIDN vóór ingebruikname (vanuit de ontwikkelomgeving kon dit niet worden geverifieerd).

Alle cijfers komen uit echte, gepubliceerde uitspraken (Open Data van de Rechtspraak). Er worden nergens fictieve gegevens gebruikt. **Niet alle politierechterzaken worden gepubliceerd; de databank is geen representatieve steekproef.**

---

## Fase 1 — Bronnenonderzoek (uitgevoerd)

| Bron | Bevinding | Gebruik |
|---|---|---|
| **Open Data van de Rechtspraak** (`data.rechtspraak.nl`) | REST/XML-API: `/uitspraken/zoeken` (filters o.a. `subject`, `creator`, `date`, `modified`, `type`) en `/uitspraken/content?id=ECLI`. ±502.000 strafrechtuitspraken. **Geen filter op procedure (politierechter)** en geen vrije-tekstfilter. Rechterlijke uitspraken zijn niet auteursrechtelijk beschermd (art. 11 Auteurswet); hergebruik volgens Open Data-voorwaarden. | **Primaire bron** voor alle bronteksten. |
| **Zoekdienst uitspraken.rechtspraak.nl** (`/api/zoek`) | Ondersteunt vrije tekst + facetten (instantietype, rechtsgebied, procedure). Strafrecht + rechtbank + "politierechter": ±8.700 kandidaten. `robots.txt` sluit alleen `/api/pdfdownload` uit. | **Alleen voor het ontdekken van ECLI-nummers**; inhoud altijd via Open Data. Rate limit ≥ 1,2 s. |
| Procedure-metadata | "Eerste aanleg – enkelvoudig" is onbetrouwbaar (veel politierechtervonnissen staan als "meervoudig" of "op tegenspraak"). | Herkenning op basis van de **kop van het vonnis** ("Vonnis van de politierechter"), met bewaarde bewijspassage. Wraking/raadkamer/beschikkingen worden uitgesloten. |
| **LOVS-oriëntatiepunten** (Rechtspraak, versie juli 2026) | Officiële PDF, publiek toegankelijk. | Fragmenten **letterlijk** overgenomen met pdf-paginanummer (`scripts/build-lovs.py` → `data/lovs.json`); geen overgetypte getallen. |
| Legal Intelligence / Navigator / InView | Commercieel; hergebruik contractueel niet toegestaan zonder licentie. | Niet gebruikt. Mogelijke licentie voor annotaties. |
| Juridische tijdschriften | Auteursrechtelijk beschermd. | Alleen als verwijzing. |
| Niet-gepubliceerde uitspraken | Niet via Open Data. Route: onderzoeksverzoek bij de Raad voor de rechtspraak. | **Niet opgenomen**; geen aannames over beschikbaarheid. |
| CBS/WODC (*Criminaliteit en rechtshandhaving*) | Geaggregeerd; nuttig als representativiteitscontext. | Aanbevolen vervolgstap. |

**Resultaat import (november 2026):** 8.661 kandidaat-ECLI's onderzocht → ±1.190 politierechtervonnissen (1999–2026), uit alle 11 huidige rechtbanken (incl. historische rechtbanken vóór 2013).

## Fase 2 — Architectuur

```
Rechtspraak Open Data ─┐                    ┌─> documents (onveranderde brontekst + secties + versies)
Zoekdienst (ECLI's) ───┼─> importpipeline ──┤
                       │   (wachtrij, rate  └─> extractor rules-v1 ─> case_offenses / sentence_components /
                       │    limit, retries,                         circumstances / case_profiles  (+ bronpassage & offsets)
                       │    dedup op ECLI)                                   │
                       │                                                     ├─> zoekmachine (PostgreSQL FTS 'dutch' + filters)
                       │                                                     ├─> statistiek (/api/stats, live SQL)
                       │                                                     ├─> strafvergelijker (transparante score)
                       │                                                     └─> AI-laag (Claude, RAG, citaatverificatie) → ai_analyses
beheer ──> correcties (review_status) + audit_log; handmatige correcties worden nooit overschreven
```

- **Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · PostgreSQL 16 (+ optioneel pgvector) · Apache ECharts · pdfkit · ExcelJS · `@anthropic-ai/sdk`.
- **Wachtrij:** PostgreSQL-jobs met `FOR UPDATE SKIP LOCKED` (`scripts/worker.ts`), herstartbaar, exponentiële backoff, periodieke synchronisatie (standaard elke 6 uur).
- **Datamodel:** `db/migrations/001_init.sql` — bronnen, rechtbanken, delictcategorieën, wetsartikelen, documenten + versies, strafcomponenten, omstandigheden, profielen, AI-analyses, verificatiestatus, importgeschiedenis, gebruikers, favorieten, zoekopdrachten, meldingen, auditlog.
- **Bron vs. afgeleid:** brontekst in `documents`; alles wat is afgeleid staat in aparte tabellen met `extractor`, `confidence`, `evidence`, `evidence_start/end` en `review_status`.

### Extractie (`src/lib/extract`)
- Sectieherkenning (tenlastelegging, bewezenverklaring, kwalificatie, strafmotivering, beslissing, eis).
- Strafcomponenten: taakstraf, gevangenisstraf/hechtenis (voorwaardelijk/onvoorwaardelijk, "waarvan", "bepaalt dat een gedeelte, groot …"), proeftijd, vervangende hechtenis, geldboete, ontzegging, schadevergoedingsmaatregel, bijzondere voorwaarden, art. 9a Sr, overige maatregelen. Tenuitvoerlegging van eerdere straffen wordt apart gehouden.
- Eis OM apart van de opgelegde straf; vergelijking alleen per gelijksoortige component.
- Delictclassificatie op juridische kwalificatie + wetsartikelen; bij vrijspraak op de tenlastelegging; terugval op de inhoudsindicatie (lagere betrouwbaarheid).
- Omstandigheden met status **meegewogen** (in strafmotivering) / **genoemd** (elders); 'blanco strafblad' alleen bij uitdrukkelijke vermelding.
- **Gemeten nauwkeurigheid** (`npm run evaluate`, vergelijking met de inhoudsindicatie): taakstraf ±88%, onvoorwaardelijke gevangenisstraf ±68%, geldboete ±62% (deels referentiefouten). Zie `data/extraction-evaluation.json`.

## Fase 3–6 — Functionaliteit

| Pagina | Functie |
|---|---|
| `/` | Hoofdtitel, natuurlijke-taalzoekbalk, populaire delicten, recente uitspraken |
| `/zoeken` | Vraag in gewone taal → transparante interpretatie → 20+ filters, direct bijgewerkt; tabel, sortering, Excel-export, zoekopdracht bewaren |
| `/delicten/[code]` | Per delict bovenaan: strafverdeling, eis OM vs. straf, invloed omstandigheden; LOVS-fragment; daaronder de uitspraken |
| `/statistieken` | 10 interactieve grafieken (strafsoorten, strafhoogte met histogram/boxplot, recidive, letsel, eis OM vs. straf, kaart rechtbanken, jaren, heatmap verzwarend, verminderend, spreiding); doorklikbaar, zoombaar, tabelweergave, PNG/PDF-export, n/selectie/periode/peildatum |
| `/uitspraak/[ecli]` | Kern, "Waarom deze straf?" (regelgebaseerd + optioneel AI), omstandigheden met passages, kwalificatie + wetsartikelen (versie op uitspraakdatum), volledige tekst met markeringen, vergelijkbare zaken, PDF-rapport |
| `/vergelijker` | "Vergelijk mijn zaak": kenmerken herkennen (bewerkbaar), ontbrekende gegevens, statistische observatie, LOVS, tabel met transparante score |
| `/ai-analyse` | RAG-analyse met Claude; alleen aangeleverde uitspraken mogen worden genoemd |
| `/vergelijk` | Tot 4 uitspraken naast elkaar |
| `/account` | Favorieten, zoekopdrachten + meldingen, bewaarde vergelijkingen |
| `/beheer` | Importmonitor, wachtrij, datakwaliteit, controlewachtrij, correcties, bronbeheer, auditlog |

## Installatie

```bash
cd app
cp .env.example .env            # vul DATABASE_URL en ADMIN_EMAIL/ADMIN_PASSWORD in
docker compose -f ../docker-compose.yml up -d db   # of eigen PostgreSQL 16
npm install
npm run db:migrate              # schema + referentiegegevens
npm run db:seed                 # beheerder + meegeleverde dataset (data/seed) + extractie
npm run dev                     # http://localhost:3000
npm run worker                  # achtergrondimport (elke 6 uur nieuwe uitspraken)
```

Volledige herimport vanaf de bron (±1 uur door bewuste rate limiting):
```bash
NODE_USE_ENV_PROXY=1 npm run import:all -- --full   # NODE_USE_ENV_PROXY alleen achter een proxy
```

Optioneel: `ANTHROPIC_API_KEY` activeert de AI-functies (model `claude-opus-5-5`, gestructureerde output, server-side fallback bij weigering). Zonder sleutel werkt alles regelgebaseerd.

Tests: `npm test` (extractie-unittests) · `npm run evaluate` (kwaliteitsmeting) · `npm run typecheck`.

## Fase 7 — Productie: status en openstaande punten

Gedaan: productie-build, unittests, E2E-rooktest (zoeken → filters, vergelijker, delictpagina, inloggen, beheer/verificatie, mobiele weergave), security headers, geparametriseerde SQL, gehashte wachtwoorden (scrypt), httpOnly-sessies, rate limiting op login/AI.

Openstaand / aanbevolen:
1. **Juridische steekproefcontrole** door strafrechtjuristen van de extracties (beheeromgeving is daarvoor ingericht); daarna `verified`-filter als standaard voor publicaties.
2. Bulktoestemming/afspraak met de Raad voor de rechtspraak over het gebruik van de zoekdienst voor ECLI-ontdekking.
3. E-mailverzending voor meldingen (nu in-app).
4. pgvector-embeddings (schema aanwezig, `VOYAGE_API_KEY`) voor semantisch zoeken.
5. Domeinnaam- en merkcontrole; privacyverklaring en gebruiksvoorwaarden.
6. Rate limiting via gedeelde opslag bij meerdere instanties.
