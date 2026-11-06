"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ComponentRow, CircRow, ProfileRow } from "@/lib/case/load";
import type { FilterOptions } from "@/lib/options";
import { RECIDIVE_LABEL, LETSEL_LABEL, BEKENTENIS_LABEL, OUTCOME_LABEL } from "@/lib/labels";
import { CIRCUMSTANCES } from "@/lib/extract/circumstances";
import { KIND_LABEL } from "@/lib/extract/sanctions";

export function ReviewEditor({ ecli, profile, components, circumstances, options }: { ecli: string; profile: ProfileRow; components: ComponentRow[]; circumstances: CircRow[]; options: FilterOptions }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const call = async (url: string, method: string, body: object) => {
    setBusy(true);
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, reason }) });
    setBusy(false);
    if (!r.ok) alert((await r.json()).error ?? "Mislukt");
    router.refresh();
  };
  const patchProfile = (patch: object) => call("/api/admin/profile", "PATCH", { ecli, patch });
  const sel = (label: string, field: string, value: string, opts: [string, string][]) => (
    <label className="block text-xs"><span className="label">{label}</span>
      <select className="input mt-1 !py-1.5 text-xs" defaultValue={value} onChange={(e) => patchProfile({ [field]: e.target.value })}>{opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    </label>
  );
  return (
    <div className={`space-y-6 ${busy ? "opacity-60" : ""}`}>
      <section className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-lg text-navy">Profiel <span className="badge-fact ml-1">{profile.review_status}</span></h2>
          <div className="flex gap-2">
            <button className="btn-primary !py-1.5" onClick={() => patchProfile({ review_status: "geverifieerd" })}>✓ Alles geverifieerd</button>
            <button className="btn-ghost !py-1.5" onClick={() => patchProfile({ review_status: "auto" })}>Terug naar automatisch</button>
          </div>
        </div>
        <input className="input mt-3" placeholder="Reden / toelichting voor auditlog (optioneel)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sel("Hoofddelict", "primary_category", profile.primary_category ?? "", [["", "—"], ...options.categories.map((c) => [c.code, c.label] as [string, string])])}
          {sel("Uitkomst", "outcome", profile.outcome, Object.entries(OUTCOME_LABEL))}
          {sel("Documentatie", "recidive", profile.recidive, Object.entries(RECIDIVE_LABEL))}
          {sel("Letsel", "letsel", profile.letsel, Object.entries(LETSEL_LABEL))}
          {sel("Proceshouding", "bekentenis", profile.bekentenis, Object.entries(BEKENTENIS_LABEL))}
          <label className="block text-xs"><span className="label">Delicten (komma-gescheiden codes)</span>
            <input className="input mt-1 !py-1.5 text-xs" defaultValue={profile.categories.join(",")} onBlur={(e) => patchProfile({ categories: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          {(["wapen", "hulpverlener", "huiselijk", "multi_offense"] as const).map((k) => <label key={k} className="flex items-center gap-1"><input type="checkbox" defaultChecked={!!profile[k]} onChange={(e) => patchProfile({ [k]: e.target.checked })} />{k}</label>)}
        </div>
      </section>

      <section className="card card-pad">
        <h2 className="font-serif text-lg text-navy">Strafcomponenten</h2>
        <table className="table-x mt-2 text-xs">
          <thead><tr><th>Herkomst</th><th>Soort</th><th>Hoogte</th><th>Eenh.</th><th>Vw.</th><th>Status</th><th></th></tr></thead>
          <tbody>{components.map((c) => (
            <tr key={c.id} title={c.evidence}>
              <td>{c.origin}</td><td>{KIND_LABEL[c.kind as keyof typeof KIND_LABEL] ?? c.kind}</td>
              <td><input className="input !w-20 !py-1 text-xs" defaultValue={c.amount ?? ""} onBlur={(e) => Number(e.target.value) !== c.amount && call("/api/admin/component", "PATCH", { id: c.id, patch: { amount: e.target.value === "" ? null : Number(e.target.value) } })} /></td>
              <td>{c.unit}</td>
              <td><input type="checkbox" defaultChecked={c.conditional} onChange={(e) => call("/api/admin/component", "PATCH", { id: c.id, patch: { conditional: e.target.checked } })} /></td>
              <td>{c.review_status}</td>
              <td className="whitespace-nowrap"><button className="text-emerald-700 underline" onClick={() => call("/api/admin/component", "PATCH", { id: c.id, patch: { review_status: "geverifieerd" } })}>ok</button> · <button className="text-red-700 underline" onClick={() => call("/api/admin/component", "PATCH", { id: c.id, patch: { review_status: "afgewezen" } })}>afwijzen</button></td>
            </tr>
          ))}</tbody>
        </table>
        <AddComponent onAdd={(b) => call("/api/admin/component", "POST", { ecli, ...b })} />
      </section>

      <section className="card card-pad">
        <h2 className="font-serif text-lg text-navy">Omstandigheden</h2>
        <ul className="mt-2 space-y-2 text-xs">{circumstances.map((c) => (
          <li key={c.id} className="rounded border border-[var(--line)] p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b>{CIRCUMSTANCES[c.code as keyof typeof CIRCUMSTANCES]?.label ?? c.code}</b>
              <span className="flex gap-2">
                <select className="input !w-auto !py-0.5 text-xs" defaultValue={c.status} onChange={(e) => call("/api/admin/circumstance", "PATCH", { id: c.id, patch: { status: e.target.value } })}><option value="meegewogen">meegewogen</option><option value="genoemd">genoemd</option></select>
                <span className="badge-fact">{c.review_status}</span>
                <button className="text-emerald-700 underline" onClick={() => call("/api/admin/circumstance", "PATCH", { id: c.id, patch: { review_status: "geverifieerd" } })}>ok</button>
                <button className="text-red-700 underline" onClick={() => call("/api/admin/circumstance", "PATCH", { id: c.id, patch: { review_status: "afgewezen" } })}>afwijzen</button>
              </span>
            </div>
            <div className="mt-1 text-[var(--ink-2)]">“{c.evidence.slice(0, 300)}”</div>
          </li>
        ))}</ul>
      </section>
    </div>
  );
}

function AddComponent({ onAdd }: { onAdd: (b: object) => void }) {
  const [b, setB] = useState({ origin: "opgelegd", kind: "taakstraf", amount: "", unit: "uren", conditional: false });
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 text-xs">
      <select className="input !w-auto !py-1 text-xs" value={b.origin} onChange={(e) => setB({ ...b, origin: e.target.value })}><option value="opgelegd">opgelegd</option><option value="eis_om">eis OM</option></select>
      <select className="input !w-auto !py-1 text-xs" value={b.kind} onChange={(e) => setB({ ...b, kind: e.target.value, unit: e.target.value === "taakstraf" ? "uren" : e.target.value === "geldboete" ? "euro" : e.target.value === "ontzegging" ? "maanden" : "dagen" })}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <input className="input !w-24 !py-1 text-xs" placeholder={`hoogte (${b.unit})`} value={b.amount} onChange={(e) => setB({ ...b, amount: e.target.value })} />
      <label className="flex items-center gap-1"><input type="checkbox" checked={b.conditional} onChange={(e) => setB({ ...b, conditional: e.target.checked })} />voorwaardelijk</label>
      <button className="btn-ghost !py-1 text-xs" onClick={() => onAdd({ ...b, amount: b.amount ? Number(b.amount) : null })}>+ component toevoegen</button>
    </div>
  );
}
