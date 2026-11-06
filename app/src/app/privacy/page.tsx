export const metadata = { title: "Privacyverklaring" };

export default function Privacy() {
  return (
    <div className="container-x max-w-3xl py-10 text-[var(--ink-2)]">
      <h1 className="h-display text-4xl">Privacyverklaring</h1>
      <p className="mt-2 text-sm text-[var(--ink-3)]">Versie november 2026. Concept — laat deze tekst vóór publicatie juridisch controleren en vul de gegevens van de verwerkingsverantwoordelijke in.</p>
      <div className="prose-legal mt-8 space-y-6 text-[15px]">
        <section>
          <h2 className="font-serif text-xl text-navy">1. Wie is verantwoordelijk?</h2>
          <p>Politierechter.nl wordt aangeboden door [naam, rechtsvorm, adres, KvK-nummer, e-mailadres]. Deze partij is verwerkingsverantwoordelijke in de zin van de Algemene verordening gegevensbescherming (AVG).</p>
        </section>
        <section>
          <h2 className="font-serif text-xl text-navy">2. Uitspraken in de databank</h2>
          <p>De databank bevat uitsluitend uitspraken die de Rechtspraak zelf heeft gepubliceerd via Open Data van de Rechtspraak. De Rechtspraak anonimiseert deze uitspraken vóór publicatie. Wij verrijken uitspraken niet met persoonsgegevens en doen geen pogingen om personen te herleiden. Treft u in een uitspraak toch herleidbare gegevens aan, meld dit dan aan ons; wij verwijderen de uitspraak dan direct en informeren de Rechtspraak.</p>
        </section>
        <section>
          <h2 className="font-serif text-xl text-navy">3. Welke gegevens verwerken wij van gebruikers?</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>Zonder account:</b> geen persoonsgegevens, behalve technisch noodzakelijke serverlogs (IP-adres, tijdstip, opgevraagde pagina) die maximaal 14 dagen worden bewaard voor beveiliging en misbruikbestrijding.</li>
            <li><b>Met account:</b> e-mailadres, (optioneel) naam, een versleuteld (gehasht) wachtwoord, uw bewaarde uitspraken, zoekopdrachten, vergelijkingen en meldingen.</li>
            <li><b>Strafvergelijker en AI-casusanalyse:</b> de tekst die u invoert wordt alleen verwerkt om de vergelijking uit te voeren en wordt niet opgeslagen, tenzij u de vergelijking zelf bewaart. Voer geen namen of andere herleidbare gegevens in.</li>
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-xl text-navy">4. Grondslag en doel</h2>
          <p>Accountgegevens verwerken wij om de overeenkomst met u uit te voeren (art. 6 lid 1 sub b AVG). Serverlogs verwerken wij op grond van ons gerechtvaardigd belang bij een veilige dienst (art. 6 lid 1 sub f AVG).</p>
        </section>
        <section>
          <h2 className="font-serif text-xl text-navy">5. AI-verwerking</h2>
          <p>Als de AI-functies zijn ingeschakeld, wordt de door u ingevoerde casustekst samen met fragmenten uit gepubliceerde uitspraken verzonden naar Anthropic (verwerker) om een analyse te maken. Met deze verwerker is een verwerkersovereenkomst gesloten. De tekst wordt niet gebruikt om AI-modellen te trainen.</p>
        </section>
        <section>
          <h2 className="font-serif text-xl text-navy">6. Bewaartermijnen</h2>
          <p>Accountgegevens bewaren wij zolang uw account bestaat. Na verwijdering van uw account worden uw gegevens binnen 30 dagen verwijderd.</p>
        </section>
        <section>
          <h2 className="font-serif text-xl text-navy">7. Uw rechten</h2>
          <p>U heeft het recht op inzage, rectificatie, verwijdering, beperking, overdraagbaarheid en bezwaar. Stuur uw verzoek naar [e-mailadres]. U kunt ook een klacht indienen bij de Autoriteit Persoonsgegevens.</p>
        </section>
        <section>
          <h2 className="font-serif text-xl text-navy">8. Cookies</h2>
          <p>Wij plaatsen alleen een functionele sessiecookie wanneer u inlogt, en lokale opslag in uw browser voor de functie ‘naast elkaar vergelijken’. Er worden geen tracking- of advertentiecookies gebruikt.</p>
        </section>
      </div>
    </div>
  );
}
