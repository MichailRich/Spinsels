export const metadata = { title: "Gebruiksvoorwaarden en disclaimer" };

export default function Voorwaarden() {
  return (
    <div className="container-x max-w-3xl py-10 text-[var(--ink-2)]">
      <h1 className="h-display text-4xl">Gebruiksvoorwaarden en disclaimer</h1>
      <p className="mt-2 text-sm text-[var(--ink-3)]">Versie november 2026. Concept — laat deze tekst vóór publicatie juridisch controleren.</p>
      <div className="mt-8 space-y-6 text-[15px]">
        <section className="rounded-xl border-l-4 border-gold bg-white p-5 shadow-card">
          <h2 className="font-serif text-xl text-navy">Geen juridisch advies</h2>
          <p className="mt-2">Politierechter.nl is een onderzoeksinstrument. De informatie, statistieken, vergelijkingen en strafindicaties op deze website zijn <b>geen juridisch advies</b> en geen voorspelling van de uitkomst van een strafzaak. Iedere zaak wordt door de rechter beoordeeld op basis van alle omstandigheden. Raadpleeg voor uw eigen situatie altijd een advocaat.</p>
        </section>
        <section>
          <h2 className="font-serif text-xl text-navy">Beperkingen van de gegevens</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>De databank bevat alleen <b>gepubliceerde</b> uitspraken. Het overgrote deel van de politierechterzaken wordt niet gepubliceerd; de gegevens vormen geen representatieve steekproef.</li>
            <li>Straffen, omstandigheden en classificaties zijn <b>automatisch</b> uit de uitspraaktekst afgeleid en kunnen fouten bevatten. Uitspraken die door de redactie zijn gecontroleerd, zijn als zodanig gemarkeerd.</li>
            <li>AI-analyses zijn interpretaties en zijn als zodanig gemarkeerd.</li>
            <li>De oorspronkelijke uitspraak op Rechtspraak.nl is altijd leidend.</li>
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-xl text-navy">Aansprakelijkheid</h2>
          <p className="mt-2">Wij spannen ons in voor juiste en actuele informatie, maar aanvaarden geen aansprakelijkheid voor schade die voortvloeit uit het gebruik van, of het vertrouwen op, de informatie op deze website, behoudens opzet of bewuste roekeloosheid.</p>
        </section>
        <section>
          <h2 className="font-serif text-xl text-navy">Gebruik</h2>
          <p className="mt-2">Het is niet toegestaan de website geautomatiseerd te bevragen op een wijze die de dienst belast, of te proberen personen uit uitspraken te herleiden. Wij kunnen accounts bij misbruik blokkeren.</p>
        </section>
        <section>
          <h2 className="font-serif text-xl text-navy">Bron en hergebruik</h2>
          <p className="mt-2">Uitspraken zijn afkomstig van Open Data van de Rechtspraak. Op rechterlijke uitspraken rust geen auteursrecht (art. 11 Auteurswet). De statistieken, analyses en vormgeving van deze website zijn auteursrechtelijk beschermd; overname met bronvermelding (‘Politierechter.nl’) is toegestaan voor niet-commercieel gebruik.</p>
        </section>
        <section>
          <h2 className="font-serif text-xl text-navy">Toepasselijk recht</h2>
          <p className="mt-2">Op deze voorwaarden is Nederlands recht van toepassing.</p>
        </section>
      </div>
    </div>
  );
}
