"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForms() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [name, setName] = useState(""), [err, setErr] = useState("");
  const router = useRouter();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    const r = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, name }) });
    const d = await r.json();
    if (!r.ok) return setErr(d.error ?? "Mislukt");
    router.refresh();
  };
  return (
    <form onSubmit={submit} className="card card-pad mt-6 space-y-3">
      <div className="flex gap-2">{(["login", "register"] as const).map((m) => <button type="button" key={m} className={mode === m ? "chip-on" : "chip"} onClick={() => setMode(m)}>{m === "login" ? "Inloggen" : "Account aanmaken"}</button>)}</div>
      {mode === "register" && <input className="input" placeholder="Naam (optioneel)" value={name} onChange={(e) => setName(e.target.value)} />}
      <input className="input" type="email" required placeholder="E-mailadres" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <input className="input" type="password" required placeholder="Wachtwoord (min. 10 tekens)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
      {err && <p className="text-sm text-red-700">{err}</p>}
      <button className="btn-primary w-full">{mode === "login" ? "Inloggen" : "Account aanmaken"}</button>
    </form>
  );
}
export function LogoutButton() {
  const router = useRouter();
  return <button className="btn-ghost" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.refresh(); }}>Uitloggen</button>;
}
export function DeleteButton({ url, body }: { url: string; body: object }) {
  const router = useRouter();
  return <button className="text-xs text-red-700 hover:underline" onClick={async () => { await fetch(url, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); router.refresh(); }}>verwijderen</button>;
}
