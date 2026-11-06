"use client";
import Link from "next/link";
import { useState } from "react";

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="xl:hidden">
      <button aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-md p-2 hover:bg-white/10">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={open ? "M6 6l12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16"} /></svg>
      </button>
      {open && (
        <div className="absolute inset-x-0 top-16 border-b border-white/10 bg-navy px-4 pb-4 shadow-lg">
          {items.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 text-white/90 hover:bg-white/10">{n.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
