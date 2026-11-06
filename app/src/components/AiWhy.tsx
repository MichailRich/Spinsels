"use client";
import { useState } from "react";
import type { WhyOutput } from "@/lib/ai/claude";

export function AiWhy({ ecli, enabled }: { ecli: string; enabled: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [data, setData] = useState<{ output: WhyOutput; model: string; created_at: string } | null>(null);
  const [err, setErr] = useState("");
  if (!enabled) return <p className="text-xs text-[var(--ink-3)]">AI-samenvatting is op deze installatie niet geactiveerd; de samenvatting hierboven is regelgebaseerd en volledig herleidbaar.</p>;
  const run = async () => {
    setState("loading");
    const r = await fetch(`/api/ai/why?ecli=${encodeURIComponent(ecli)}`, { method: "POST" });
    const d = await r.json();
    if (!r.ok) { setErr(d.error ?? "Mislukt"); setState("error"); return; }
    setData(d); setState("done");
  };
  if (state === "idle") return <button className="btn-ghost" onClick={run}>✦ Laat AI de strafmotivering uitleggen</button>;
  if (state === "loading") return <p className="text-sm text-[var(--ink-3)]">AI analyseert de strafmotivering…</p>;
  if (state === "error") return <p className="text-sm text-red-700">{err}</p>;
  return (
    <div className="rounded-lg border border-gold-200 bg-gold-50/50 p-4 fade-in">
      <div className="mb-2 flex flex-wrap items-center gap-2"><span className="badge-ai">AI-interpretatie</span><span className="text-[11px] text-[var(--ink-3)]">{data!.model} · {data!.created_at} · citaten automatisch gecontroleerd tegen de brontekst</span></div>
      <p className="text-sm text-navy">{data!.output.samenvatting}</p>
      <ul className="mt-3 space-y-2">
        {data!.output.factoren.map((f, i) => (
          <li key={i} className="text-sm">
            <span className={`badge mr-1 ${f.richting === "verzwarend" ? "bg-red-50 text-red-700" : f.richting === "verminderend" ? "bg-emerald-50 text-emerald-700" : "bg-mist text-navy"}`}>{f.richting}</span>
            {f.omschrijving}
            <blockquote className="passage mt-1">“{f.citaat}”</blockquote>
          </li>
        ))}
      </ul>
      {data!.output.ontbrekende_informatie.length > 0 && <p className="mt-3 text-xs text-[var(--ink-3)]">Niet in de uitspraak vermeld: {data!.output.ontbrekende_informatie.join("; ")}.</p>}
    </div>
  );
}
