"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function CompareLoader() {
  const router = useRouter();
  const [v, setV] = useState("");
  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem("pr-compare") ?? "[]") as string[];
      if (list.length) router.replace(`/vergelijk?ecli=${list.join(",")}`);
    } catch {}
  }, [router]);
  return (
    <div className="card card-pad mt-6 max-w-2xl">
      <p className="text-sm text-[var(--ink-2)]">Voeg uitspraken toe via de knop “Naast elkaar vergelijken” op een uitspraakpagina, of voer hieronder maximaal vier ECLI-nummers in.</p>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); router.push(`/vergelijk?ecli=${encodeURIComponent(v.replace(/\s+/g, ","))}`); }}>
        <input className="input" value={v} onChange={(e) => setV(e.target.value)} placeholder="ECLI:NL:RBAMS:2024:1234, ECLI:NL:RBROT:2023:567" />
        <button className="btn-primary">Vergelijk</button>
      </form>
    </div>
  );
}
