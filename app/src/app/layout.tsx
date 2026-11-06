import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { MobileNav } from "@/components/MobileNav";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://politierechter.nl"),
  openGraph: { siteName: "Politierechter.nl", locale: "nl_NL", type: "website" },
  title: { default: "Politierechter.nl — Wat straft de politierechter?", template: "%s · Politierechter.nl" },
  description: "Doorzoek Nederlandse politierechterzaken. Vergelijk opgelegde straffen en ontdek welke omstandigheden het oordeel beïnvloeden.",
};
export const viewport: Viewport = { themeColor: "#14263D", width: "device-width", initialScale: 1 };

const NAV = [
  { href: "/zoeken", label: "Zoeken" },
  { href: "/delicten", label: "Strafbare feiten" },
  { href: "/statistieken", label: "Statistieken" },
  { href: "/vergelijker", label: "Strafvergelijker" },
  { href: "/uitspraken", label: "Recente uitspraken" },
  { href: "/ai-analyse", label: "AI-casusanalyse" },
  { href: "/over", label: "Over de databank" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let user = null;
  try { user = await currentUser(); } catch { /* database niet bereikbaar */ }
  return (
    <html lang="nl">
      <body className="min-h-screen font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Naar inhoud</a>
        <header className="sticky top-0 z-40 border-b border-white/10 bg-navy text-white">
          <div className="container-x flex h-16 items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Politierechter.nl — home">
              <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden><path d="M16 3 4 9v2h24V9L16 3Z" fill="#C3A46B"/><path d="M7 13h3v10H7zM14.5 13h3v10h-3zM22 13h3v10h-3zM4 25h24v3H4z" fill="#fff"/></svg>
              <span className="font-serif text-[17px] font-semibold tracking-wide">POLITIERECHTER<span className="text-gold">.NL</span></span>
            </Link>
            <nav className="hidden xl:flex items-center gap-0.5 text-[13px]" aria-label="Hoofdnavigatie">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-2 py-1.5 text-white/80 hover:bg-white/10 hover:text-white">{n.label}</Link>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              {user ? (
                <Link href="/account" className="hidden sm:inline-flex rounded-md border border-white/20 px-3 py-1.5 text-[13px] text-white/90 hover:bg-white/10">
                  {user.role === "admin" ? "Beheer & onderzoek" : "Mijn onderzoek"}
                </Link>
              ) : (
                <Link href="/account" className="hidden sm:inline-flex rounded-md border border-white/20 px-3 py-1.5 text-[13px] text-white/90 hover:bg-white/10">Inloggen</Link>
              )}
              <MobileNav items={[...NAV, { href: "/account", label: user ? "Mijn onderzoek" : "Inloggen" }]} />
            </div>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="mt-20 border-t border-[var(--line)] bg-white">
          <div className="container-x grid gap-8 py-10 text-sm text-[var(--ink-2)] md:grid-cols-3">
            <div>
              <div className="font-serif text-base font-semibold text-navy">POLITIERECHTER<span className="text-gold">.NL</span></div>
              <p className="mt-2 max-w-sm">Onafhankelijk onderzoeksplatform voor gepubliceerde politierechteruitspraken. Geen juridisch advies.</p>
            </div>
            <div>
              <div className="label mb-2">Bron</div>
              <p>Alle uitspraken komen uit <a className="underline" href="https://data.rechtspraak.nl" rel="noopener">Open Data van de Rechtspraak</a>. Iedere uitspraak verwijst naar de oorspronkelijke publicatie (ECLI).</p>
            </div>
            <div>
              <div className="label mb-2">Belangrijk</div>
              <p>Niet alle politierechterzaken worden gepubliceerd. De gepubliceerde uitspraken vormen <strong>geen representatieve steekproef</strong> van alle behandelde zaken. <Link className="underline" href="/over">Lees de verantwoording</Link>.</p>
            </div>
          </div>
          <div className="container-x flex flex-wrap gap-4 border-t border-[var(--line)] py-4 text-xs text-[var(--ink-3)]">
            <Link href="/voorwaarden" className="hover:underline">Disclaimer &amp; voorwaarden</Link>
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <Link href="/over" className="hover:underline">Verantwoording</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
