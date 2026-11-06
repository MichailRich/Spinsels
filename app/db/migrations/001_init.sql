-- Politierechter.nl — basisschema
-- Principe: oorspronkelijke brongegevens (documents) staan gescheiden van
-- afgeleide/geëxtraheerde gegevens (case_*, sentence_components, circumstances,
-- ai_analyses). Iedere extractie verwijst naar de bronpassage waarop zij berust.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ---------------------------------------------------------------- bronnen
CREATE TABLE IF NOT EXISTS sources (
  code          text PRIMARY KEY,
  name          text NOT NULL,
  url           text NOT NULL,
  access_method text NOT NULL,
  license       text NOT NULL,
  terms_note    text NOT NULL,
  enabled       boolean NOT NULL DEFAULT true,
  rate_limit_ms integer NOT NULL DEFAULT 400,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courts (
  code          text PRIMARY KEY,            -- ECLI-instantiecode, bv. RBAMS
  name          text NOT NULL,
  current_code  text NOT NULL,               -- huidige rechtbank (na herindeling 2013)
  seat          text NOT NULL,
  lat           double precision NOT NULL,
  lon           double precision NOT NULL,
  historical    boolean NOT NULL DEFAULT false,
  note          text
);

-- ---------------------------------------------------------------- import
CREATE TABLE IF NOT EXISTS import_runs (
  id          bigserial PRIMARY KEY,
  kind        text NOT NULL,                 -- discover | fetch | extract | reindex
  source_code text REFERENCES sources(code),
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status      text NOT NULL DEFAULT 'running', -- running | ok | error | partial
  stats       jsonb NOT NULL DEFAULT '{}'::jsonb,
  cursor      jsonb,                         -- voor herstartbare processen
  error       text
);

CREATE TABLE IF NOT EXISTS jobs (
  id          bigserial PRIMARY KEY,
  type        text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  unique_key  text UNIQUE,
  status      text NOT NULL DEFAULT 'queued',  -- queued | running | done | failed
  attempts    integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  run_after   timestamptz NOT NULL DEFAULT now(),
  locked_at   timestamptz,
  last_error  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS jobs_pick_idx ON jobs (status, run_after);

-- ECLI's die via een bron zijn ontdekt (deduplicatie op ECLI)
CREATE TABLE IF NOT EXISTS discovered_eclis (
  ecli           text PRIMARY KEY,
  source_code    text NOT NULL REFERENCES sources(code),
  discovered_at  timestamptz NOT NULL DEFAULT now(),
  decision_date  date,
  publication_date date,
  procedure_hint text,
  fetch_status   text NOT NULL DEFAULT 'pending', -- pending | fetched | error | skipped
  attempts       integer NOT NULL DEFAULT 0,
  last_fetch_at  timestamptz,
  error          text
);
CREATE INDEX IF NOT EXISTS discovered_status_idx ON discovered_eclis (fetch_status);

-- ---------------------------------------------------------------- brondocumenten (onveranderde brontekst)
CREATE TABLE IF NOT EXISTS documents (
  ecli              text PRIMARY KEY,
  source_code       text NOT NULL REFERENCES sources(code),
  court_code        text NOT NULL REFERENCES courts(code),
  decision_date     date,
  publication_date  date,
  source_modified   timestamptz,
  zaaknummer        text,
  procedure         text,
  subjects          text[],
  title             text,
  inhoudsindicatie  text,
  full_text         text NOT NULL,
  sections          jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{title, start, end, level}]
  deeplink          text NOT NULL,
  content_hash      text NOT NULL,
  version           integer NOT NULL DEFAULT 1,
  fetched_at        timestamptz NOT NULL DEFAULT now(),
  is_politierechter boolean NOT NULL DEFAULT false,
  politierechter_evidence text,
  search            tsvector
);
CREATE INDEX IF NOT EXISTS documents_pr_idx ON documents (is_politierechter, decision_date);
CREATE INDEX IF NOT EXISTS documents_court_idx ON documents (court_code);
CREATE INDEX IF NOT EXISTS documents_search_idx ON documents USING gin (search);

CREATE TABLE IF NOT EXISTS document_versions (
  id            bigserial PRIMARY KEY,
  ecli          text NOT NULL REFERENCES documents(ecli) ON DELETE CASCADE,
  version       integer NOT NULL,
  content_hash  text NOT NULL,
  source_modified timestamptz,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  full_text     text NOT NULL,
  UNIQUE (ecli, version)
);

-- ---------------------------------------------------------------- juridische referentiegegevens
CREATE TABLE IF NOT EXISTS offense_categories (
  code        text PRIMARY KEY,
  group_code  text NOT NULL,
  group_label text NOT NULL,
  label       text NOT NULL,
  description text NOT NULL,
  articles    text[] NOT NULL DEFAULT '{}',
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS legal_articles (
  code        text PRIMARY KEY,              -- bv. 'Sr:300'
  law         text NOT NULL,                 -- 'Sr' | 'WVW 1994' | 'Opiumwet' | 'WWM' ...
  bwb_id      text NOT NULL,
  article     text NOT NULL,
  title       text NOT NULL,
  history     jsonb NOT NULL DEFAULT '[]'::jsonb -- [{from, note}]
);

-- ---------------------------------------------------------------- afgeleide gegevens (extractie)
-- Gemeenschappelijke kolommen: extractor (bv. 'rules-v1', 'llm:<model>'), confidence,
-- evidence (letterlijke bronpassage), evidence_start/end (offset in documents.full_text),
-- review_status: auto | geverifieerd | gecorrigeerd | afgewezen

CREATE TABLE IF NOT EXISTS case_offenses (
  id            bigserial PRIMARY KEY,
  ecli          text NOT NULL REFERENCES documents(ecli) ON DELETE CASCADE,
  feit_nr       text,
  role          text NOT NULL,               -- ten_laste_gelegd | bewezen | vrijgesproken | kwalificatie
  category_code text REFERENCES offense_categories(code),
  qualification text,
  articles      text[] NOT NULL DEFAULT '{}',
  evidence      text,
  evidence_start integer,
  evidence_end  integer,
  extractor     text NOT NULL,
  confidence    real NOT NULL DEFAULT 0.5,
  review_status text NOT NULL DEFAULT 'auto',
  reviewed_by   bigint,
  reviewed_at   timestamptz
);
CREATE INDEX IF NOT EXISTS case_offenses_ecli_idx ON case_offenses (ecli);
CREATE INDEX IF NOT EXISTS case_offenses_cat_idx ON case_offenses (category_code);

CREATE TABLE IF NOT EXISTS sentence_components (
  id              bigserial PRIMARY KEY,
  ecli            text NOT NULL REFERENCES documents(ecli) ON DELETE CASCADE,
  origin          text NOT NULL,             -- opgelegd | eis_om
  kind            text NOT NULL,             -- taakstraf | gevangenisstraf | hechtenis | geldboete | ontzegging | schadevergoedingsmaatregel | bijzondere_voorwaarden | schuldigverklaring_zonder_straf | overig
  amount          numeric,                   -- in 'unit'
  unit            text,                      -- uren | dagen | euro | maanden
  conditional     boolean NOT NULL DEFAULT false,
  probation_months numeric,
  substitute_days numeric,                   -- vervangende hechtenis
  description     text NOT NULL,
  evidence        text NOT NULL,
  evidence_start  integer,
  evidence_end    integer,
  extractor       text NOT NULL,
  confidence      real NOT NULL DEFAULT 0.5,
  review_status   text NOT NULL DEFAULT 'auto',
  reviewed_by     bigint,
  reviewed_at     timestamptz
);
CREATE INDEX IF NOT EXISTS sentence_ecli_idx ON sentence_components (ecli, origin);
CREATE INDEX IF NOT EXISTS sentence_kind_idx ON sentence_components (kind, origin);

CREATE TABLE IF NOT EXISTS circumstances (
  id            bigserial PRIMARY KEY,
  ecli          text NOT NULL REFERENCES documents(ecli) ON DELETE CASCADE,
  code          text NOT NULL,
  polarity      text NOT NULL,               -- verzwarend | verminderend | neutraal
  status        text NOT NULL,               -- meegewogen | genoemd
  evidence      text NOT NULL,
  evidence_start integer,
  evidence_end  integer,
  extractor     text NOT NULL,
  confidence    real NOT NULL DEFAULT 0.5,
  review_status text NOT NULL DEFAULT 'auto',
  reviewed_by   bigint,
  reviewed_at   timestamptz
);
CREATE INDEX IF NOT EXISTS circumstances_ecli_idx ON circumstances (ecli);
CREATE INDEX IF NOT EXISTS circumstances_code_idx ON circumstances (code, status);

-- Samenvattend profiel per uitspraak voor snelle filtering & statistiek
CREATE TABLE IF NOT EXISTS case_profiles (
  ecli               text PRIMARY KEY REFERENCES documents(ecli) ON DELETE CASCADE,
  primary_category   text REFERENCES offense_categories(code),
  categories         text[] NOT NULL DEFAULT '{}',
  articles           text[] NOT NULL DEFAULT '{}',
  offense_count      integer NOT NULL DEFAULT 0,
  multi_offense      boolean NOT NULL DEFAULT false,
  acquittal          text,                    -- geheel | gedeeltelijk | null
  outcome            text NOT NULL,           -- veroordeling | vrijspraak | ontslag_van_alle_rechtsvervolging | schuldig_zonder_straf | niet_ontvankelijk | onbekend
  recidive           text NOT NULL DEFAULT 'onbekend', -- blanco | geen_relevante | relevant | onbekend
  letsel             text NOT NULL DEFAULT 'onbekend', -- geen | licht | ernstig | onbekend | nvt
  bekentenis         text NOT NULL DEFAULT 'onbekend', -- bekend | ontkend | gedeeltelijk | onbekend
  wapen              boolean NOT NULL DEFAULT false,
  hulpverlener       boolean NOT NULL DEFAULT false,
  huiselijk          boolean NOT NULL DEFAULT false,
  alcohol_ugl        numeric,                 -- ademalcoholgehalte (µg/l), indien vermeld
  taakstraf_uren     numeric,
  gev_onvw_dagen     numeric,
  gev_vw_dagen       numeric,
  geldboete_euro     numeric,
  ontzegging_maanden numeric,
  eis_taakstraf_uren numeric,
  eis_gev_onvw_dagen numeric,
  eis_gev_vw_dagen   numeric,
  eis_geldboete_euro numeric,
  eis_ontzegging_maanden numeric,
  sentence_summary   text,
  eis_summary        text,
  motivation         text,
  motivation_start   integer,
  facts_summary      text,
  extraction_quality real NOT NULL DEFAULT 0,
  extractor          text NOT NULL,
  extracted_at       timestamptz NOT NULL DEFAULT now(),
  review_status      text NOT NULL DEFAULT 'auto'
);
CREATE INDEX IF NOT EXISTS profiles_cat_idx ON case_profiles (primary_category);
CREATE INDEX IF NOT EXISTS profiles_cats_idx ON case_profiles USING gin (categories);

-- AI-analyses (LLM) — altijd gescheiden en gemarkeerd als interpretatie
CREATE TABLE IF NOT EXISTS ai_analyses (
  id            bigserial PRIMARY KEY,
  ecli          text REFERENCES documents(ecli) ON DELETE CASCADE,
  kind          text NOT NULL,               -- waarom_deze_straf | casusanalyse | extractie
  model         text NOT NULL,
  prompt_version text NOT NULL,
  input_hash    text NOT NULL,
  output        jsonb NOT NULL,
  quotes_verified boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ecli, kind, input_hash)
);

-- ---------------------------------------------------------------- gebruikers & onderzoeksomgeving
CREATE TABLE IF NOT EXISTS users (
  id            bigserial PRIMARY KEY,
  email         text UNIQUE NOT NULL,
  name          text,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'user',  -- user | admin
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token       text PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ecli       text NOT NULL REFERENCES documents(ecli) ON DELETE CASCADE,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ecli)
);
CREATE TABLE IF NOT EXISTS saved_searches (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  query       jsonb NOT NULL,
  alert       boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saved_comparisons (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  case_text   text,
  eclis       text[] NOT NULL DEFAULT '{}',
  result      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  saved_search_id bigint REFERENCES saved_searches(id) ON DELETE CASCADE,
  ecli        text REFERENCES documents(ecli) ON DELETE CASCADE,
  message     text NOT NULL,
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- beheer
CREATE TABLE IF NOT EXISTS audit_log (
  id         bigserial PRIMARY KEY,
  user_id    bigint REFERENCES users(id),
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  text NOT NULL,
  before     jsonb,
  after      jsonb,
  reason     text,
  at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
