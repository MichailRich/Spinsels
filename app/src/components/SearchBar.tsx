"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const EXAMPLES = [
  "Wat is de straf voor mishandeling zonder strafblad?",
  "Welke straf wordt opgelegd voor een tweede winkeldiefstal?",
  "Hoe zwaar straft de politierechter rijden onder invloed?",
  "Wat is de invloed van recidive bij bedreiging?",
  "Welke straffen zijn opgelegd bij geweld tegen politieagenten?",
  "Welke zaken zijn er waarin 120 uur taakstraf werd opgelegd?",
];

export function SearchBar({ large = false, initial = "" }: { large?: boolean; initial?: string }) {
  const [v, setV] = useState(initial);
  const router = useRouter();
  const go = (text: string) => {
    if (!text.trim()) return;
    router.push(`/zoeken?nl=${encodeURIComponent(text.trim())}`);
  };
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); go(v); }} role="search" className={`flex items-center gap-2 rounded-2xl bg-white p-2 shadow-card ring-1 ring-[var(--line)] focus-within:ring-2 focus-within:ring-gold ${large ? "sm:p-2.5" : ""}`}>
        <svg className="ml-2 shrink-0 text-[var(--ink-3)]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          aria-label="Zoek in politierechteruitspraken"
          placeholder="Stel een vraag of zoek op delict, omstandigheid of ECLI…"
          className={`min-w-0 flex-1 bg-transparent px-1 text-navy placeholder:text-[var(--ink-3)] focus:outline-none ${large ? "py-3 text-base sm:text-lg" : "py-2 text-sm"}`}
        />
        <button className={`btn-primary shrink-0 ${large ? "px-5 py-3" : ""}`}>Zoeken</button>
      </form>
      {large && (
        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => go(e)} className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-left text-[12.5px] text-white/85 hover:border-gold hover:text-white">{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}
