"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function JobButtons() {
  const [msg, setMsg] = useState("");
  const run = async (type: string) => {
    const r = await fetch("/api/admin/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }) });
    setMsg((await r.json()).message ?? "Mislukt");
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {[["discover", "Nieuwe uitspraken zoeken"], ["fetch", "Ophalen"], ["extract", "Extractie (nieuw)"], ["extract_all", "Alles opnieuw extraheren"], ["alerts", "Meldingen versturen"]].map(([t, l]) => <button key={t} className="btn-ghost !px-2.5 !py-1 text-xs" onClick={() => run(t)}>{l}</button>)}
      {msg && <span className="text-xs text-[var(--ink-3)]">{msg}</span>}
    </div>
  );
}
export function SourceToggle({ code, enabled }: { code: string; enabled: boolean }) {
  const router = useRouter();
  return <button className={enabled ? "chip-on" : "chip"} onClick={async () => { await fetch("/api/admin/source", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, enabled: !enabled }) }); router.refresh(); }}>{enabled ? "actief" : "uit"}</button>;
}
