# Wat u nog zelf moet doen (alleen dit)

Alles wat technisch kon, is geregeld. Deze stappen vragen uw naam, account of betaling. Daarom kan Claude ze niet voor u doen.

## 1. Domeinnaam vastleggen (5 minuten, ±€10 per jaar)
1. Ga naar **transip.nl** en zoek `politierechter.nl`.
2. Is de naam vrij? Kopen. Is hij bezet? Kies een alternatief, bijvoorbeeld `watstraftdepolitierechter.nl`, en laat het weten.

## 2. Site online zetten (10 minuten, ±€20 per maand)
1. Maak een account aan op **render.com** (inloggen met GitHub kan).
2. Klik op **New → Blueprint** en kies de repository **Spinsels**.
3. Render vraagt drie waarden:
   - `ADMIN_EMAIL`: uw e-mailadres
   - `ADMIN_PASSWORD`: een sterk wachtwoord
   - `ANTHROPIC_API_KEY`: mag leeg blijven, of vul een sleutel van console.anthropic.com in voor de AI-functies
4. Klik op **Apply**. Na ongeveer 10 minuten staat de site online met alle 1.185 uitspraken, en nieuwe uitspraken komen er automatisch bij.
5. Koppel daarna in Render bij **Settings → Custom domain** uw domeinnaam.

## 3. Juridische controle (één keer)
Laat een strafrechtjurist de controlelijst in `app/docs/controle-door-jurist.md` doorlopen (4 à 6 uur). Laat dezelfde jurist ook de conceptteksten op `/privacy` en `/voorwaarden` nalezen en vul daar uw naam en contactgegevens in.

## 4. Brief aan de Raad voor de rechtspraak (optioneel, sterk aanbevolen)
De brief is al geschreven: `app/docs/brief-raad-voor-de-rechtspraak.md`. Vul uw naam en adres in en verstuur hem.

---
Kom ergens niet uit? Stuur een schermafbeelding naar Claude, dan krijgt u de volgende stap.
