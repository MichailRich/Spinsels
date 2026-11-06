"use client";
import { useState } from "react";
import type { Filters } from "@/lib/filters";

export function SaveSearchButton({ query }: { query: Filters }) {
  const [state, setState] = useState<"idle" | "saved" | "login" | "error">("idle");
  const save = async () => {
    const name = prompt("Naam voor deze zoekopdracht:", "Mijn zoekopdracht");
    if (!name) return;
    const alert = confirm("Wilt u een melding ontvangen bij nieuwe uitspraken die aan deze zoekopdracht voldoen?");
    const r = await fetch("/api/me/searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, query, alert }) });
    setState(r.status === 401 ? "login" : r.ok ? "saved" : "error");
  };
  if (state === "login") return <a className="btn-ghost" href="/account">Log in om op te slaan</a>;
  return <button className="btn-ghost" onClick={save}>{state === "saved" ? "Opgeslagen ✓" : state === "error" ? "Opslaan mislukt" : "Zoekopdracht bewaren"}</button>;
}
