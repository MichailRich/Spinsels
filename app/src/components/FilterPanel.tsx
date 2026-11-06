"use client";
import type { Filters } from "@/lib/filters";
import type { FilterOptions } from "@/lib/options";
import { RECIDIVE_LABEL, RECIDIVE_ORDER, LETSEL_LABEL, LETSEL_ORDER } from "@/lib/labels";
import { useState } from "react";

type Props = { filters: Filters; onChange: (f: Filters) => void; options: FilterOptions; hideCategory?: boolean };

export function FilterPanel({ filters: f, onChange, options, hideCategory }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...f, ...patch });
  const toggle = (key: "cat" | "court" | "recidive" | "letsel" | "verzwarend" | "verminderend" | "outcome", v: string) => {
    const cur = (f[key] as string[] | undefined) ?? [];
    set({ [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } as Partial<Filters>);
  };
  const groups = [...new Set(options.categories.map((c) => c.groupLabel))];
  const active = countActive(f);
  return (
    <div className="space-y-5 text-sm">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-navy">Filters {active > 0 && <span className="ml-1 rounded-full bg-gold-100 px-2 py-0.5 text-xs text-gold-600">{active}</span>}</div>
        {active > 0 && <button className="text-xs text-[var(--ink-3)] underline hover:text-navy" onClick={() => onChange({})}>Alles wissen</button>}
      </div>

      <Field label="Vrije tekst (volledige uitspraak)">
        <DebouncedInput value={f.q ?? ""} onChange={(v) => set({ q: v || undefined })} placeholder="bv. caféruzie, kopstoot, Albert Heijn" />
      </Field>

      {!hideCategory && (
        <Field label="Strafbaar feit">
          <select className="input" value="" onChange={(e) => e.target.value && toggle("cat", e.target.value)} aria-label="Strafbaar feit toevoegen">
            <option value="">+ delict toevoegen…</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {options.categories.filter((c) => c.groupLabel === g).map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </optgroup>
            ))}
          </select>
          {!!f.cat?.length && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {f.cat.map((c) => (
                <button key={c} className="chip-on" onClick={() => toggle("cat", c)}>{options.categories.find((x) => x.code === c)?.label ?? c} ✕</button>
              ))}
            </div>
          )}
        </Field>
      )}
      <Check label="Alleen zaken met uitsluitend dit delict" hint="Voorkomt dat een gezamenlijke straf voor meerdere feiten aan één delict wordt toegeschreven." checked={!!f.enkelvoudig} onChange={(v) => set({ enkelvoudig: v || undefined })} />

      <Field label="Rechtbank">
        <div className="flex flex-wrap gap-1.5">
          {options.courts.map((c) => (
            <button key={c.code} className={f.court?.includes(c.code) ? "chip-on" : "chip"} onClick={() => toggle("court", c.code)}>{c.name.replace("Rechtbank ", "")}</button>
          ))}
        </div>
      </Field>

      <Field label="Jaar uitspraak">
        <div className="flex items-center gap-2">
          <input className="input" inputMode="numeric" placeholder="van" value={f.yearFrom ?? ""} onChange={(e) => set({ yearFrom: e.target.value ? Number(e.target.value) : undefined })} aria-label="Jaar vanaf" />
          <span className="text-[var(--ink-3)]">–</span>
          <input className="input" inputMode="numeric" placeholder="tot" value={f.yearTo ?? ""} onChange={(e) => set({ yearTo: e.target.value ? Number(e.target.value) : undefined })} aria-label="Jaar tot en met" />
        </div>
      </Field>

      <Field label="Strafsoort en -hoogte">
        <select className="input" value={f.kind ?? ""} onChange={(e) => set({ kind: e.target.value || undefined, min: undefined, max: undefined })}>
          <option value="">Alle strafsoorten</option>
          <option value="taakstraf">Taakstraf (uren)</option>
          <option value="gevangenisstraf_onvw">Onvoorwaardelijke gevangenisstraf (dagen)</option>
          <option value="gevangenisstraf_vw">Voorwaardelijke gevangenisstraf (dagen)</option>
          <option value="geldboete">Geldboete (euro)</option>
          <option value="ontzegging">Ontzegging rijbevoegdheid (maanden)</option>
        </select>
        {f.kind && (
          <div className="mt-2 flex items-center gap-2">
            <input className="input" inputMode="numeric" placeholder="min" value={f.min ?? ""} onChange={(e) => set({ min: e.target.value ? Number(e.target.value) : undefined })} aria-label="Minimum" />
            <span className="text-[var(--ink-3)]">–</span>
            <input className="input" inputMode="numeric" placeholder="max" value={f.max ?? ""} onChange={(e) => set({ max: e.target.value ? Number(e.target.value) : undefined })} aria-label="Maximum" />
          </div>
        )}
      </Field>

      <Field label="Justitiële documentatie (zoals vermeld)">
        <div className="space-y-1">
          {RECIDIVE_ORDER.map((r) => (
            <Check key={r} label={RECIDIVE_LABEL[r]} checked={!!f.recidive?.includes(r)} onChange={() => toggle("recidive", r)} />
          ))}
        </div>
      </Field>

      <Field label="Letsel (geweldsdelicten)">
        <div className="space-y-1">
          {LETSEL_ORDER.map((r) => <Check key={r} label={LETSEL_LABEL[r]} checked={!!f.letsel?.includes(r)} onChange={() => toggle("letsel", r)} />)}
        </div>
      </Field>

      <Field label="Proceshouding">
        <select className="input" value={f.bekentenis ?? ""} onChange={(e) => set({ bekentenis: e.target.value || undefined })}>
          <option value="">Alle</option>
          <option value="bekend">Bekend</option>
          <option value="gedeeltelijk">Gedeeltelijk bekend</option>
          <option value="ontkend">Ontkend / zwijgrecht</option>
          <option value="onbekend">Niet vermeld</option>
        </select>
      </Field>

      <Field label="Kenmerken">
        <div className="space-y-1">
          <Check label="Wapen gebruikt of getoond" checked={!!f.wapen} onChange={(v) => set({ wapen: v || undefined })} />
          <Check label="Tegen hulpverlener / ambtenaar" checked={!!f.hulpverlener} onChange={(v) => set({ hulpverlener: v || undefined })} />
          <Check label="Huiselijke kring" checked={!!f.huiselijk} onChange={(v) => set({ huiselijk: v || undefined })} />
          <Check label="Met voorwaardelijk strafdeel" checked={f.voorwaardelijk === true} onChange={(v) => set({ voorwaardelijk: v || undefined })} />
        </div>
      </Field>

      <Field label="Uitkomst">
        <div className="space-y-1">
          {[["veroordeling", "Veroordeling"], ["vrijspraak", "Vrijspraak"], ["gedeeltelijke_vrijspraak", "Gedeeltelijke vrijspraak"], ["schuldig_zonder_straf", "Schuldig zonder straf"], ["ontslag_van_alle_rechtsvervolging", "Ontslag van alle rechtsvervolging"]].map(([k, l]) => (
            <Check key={k} label={l} checked={!!f.outcome?.includes(k)} onChange={() => toggle("outcome", k)} />
          ))}
        </div>
      </Field>

      <Collapsible label="Strafverzwarend meegewogen">
        {options.verzwarend.map((c) => <Check key={c.code} label={c.label} checked={!!f.verzwarend?.includes(c.code)} onChange={() => toggle("verzwarend", c.code)} />)}
      </Collapsible>
      <Collapsible label="Strafverminderend meegewogen">
        {options.verminderend.map((c) => <Check key={c.code} label={c.label} checked={!!f.verminderend?.includes(c.code)} onChange={() => toggle("verminderend", c.code)} />)}
      </Collapsible>
      <Check label="Alleen door redactie geverifieerde uitspraken" checked={!!f.verified} onChange={(v) => set({ verified: v || undefined })} />
    </div>
  );
}

export function countActive(f: Filters) {
  return Object.entries(f).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)).length;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      {children}
    </div>
  );
}
function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-[13px] text-[var(--ink-2)] hover:text-navy" title={hint}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--line)] accent-[#14263D]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}{hint && <span className="block text-[11px] text-[var(--ink-3)]">{hint}</span>}</span>
    </label>
  );
}
function Collapsible({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="label mb-1.5 flex w-full items-center justify-between" onClick={() => setOpen(!open)} aria-expanded={open}>
        {label}<span>{open ? "−" : "+"}</span>
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  );
}
function DebouncedInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState(value);
  const [t, setT] = useState<ReturnType<typeof setTimeout> | null>(null);
  return (
    <input className="input" value={v} placeholder={placeholder} onChange={(e) => {
      setV(e.target.value);
      if (t) clearTimeout(t);
      setT(setTimeout(() => onChange(e.target.value), 400));
    }} />
  );
}
