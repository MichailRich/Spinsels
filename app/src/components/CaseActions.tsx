"use client";
import { useEffect, useState } from "react";

export function CaseActions({ ecli }: { ecli: string }) {
  const [fav, setFav] = useState<"no" | "yes" | "login">("no");
  const [inCompare, setInCompare] = useState(false);
  useEffect(() => {
    try { setInCompare((JSON.parse(localStorage.getItem("pr-compare") ?? "[]") as string[]).includes(ecli)); } catch {}
    fetch(`/api/me/favorites?ecli=${encodeURIComponent(ecli)}`).then((r) => (r.ok ? r.json() : null)).then((d) => d?.favorite && setFav("yes")).catch(() => {});
  }, [ecli]);
  const toggleFav = async () => {
    const r = await fetch("/api/me/favorites", { method: fav === "yes" ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ecli }) });
    if (r.status === 401) return setFav("login");
    if (r.ok) setFav(fav === "yes" ? "no" : "yes");
  };
  const toggleCompare = () => {
    try {
      const cur = JSON.parse(localStorage.getItem("pr-compare") ?? "[]") as string[];
      const next = cur.includes(ecli) ? cur.filter((x) => x !== ecli) : [...cur, ecli].slice(-4);
      localStorage.setItem("pr-compare", JSON.stringify(next));
      setInCompare(next.includes(ecli));
    } catch {}
  };
  return (
    <div className="flex flex-wrap gap-2">
      <a className="btn-gold" href={`/api/report/${encodeURIComponent(ecli)}`} target="_blank">PDF-rapport</a>
      {fav === "login" ? <a className="btn-ghost" href="/account">Log in om te bewaren</a> : <button className="btn-ghost" onClick={toggleFav}>{fav === "yes" ? "★ Bewaard" : "☆ Bewaren"}</button>}
      <button className="btn-ghost" onClick={toggleCompare}>{inCompare ? "✓ In vergelijking" : "+ Naast elkaar vergelijken"}</button>
      {inCompare && <a className="btn-ghost" href="/vergelijk">Open vergelijking →</a>}
    </div>
  );
}
