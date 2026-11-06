# Controlelijst voor de juridische steekproef

Doel: vaststellen of de automatisch afgeleide gegevens betrouwbaar genoeg zijn om te publiceren. Reken op 4 à 6 uur werk voor een strafrechtjurist (bijvoorbeeld een advocaat-stagiair of rechtenstudent met strafrecht als specialisatie).

## Werkwijze
1. De jurist krijgt een beheerdersaccount (`npm run db:seed` met `ADMIN_EMAIL` en `ADMIN_PASSWORD`).
2. Ga in de beheeromgeving (`/beheer`) naar **Controlewachtrij**. Neem 25 uitspraken uit "Laagste kwaliteit" en 50 uit "Nieuwste uitspraken". Controleer ook minimaal 5 uitspraken per veelvoorkomend delict: mishandeling, bedreiging, winkeldiefstal, rijden onder invloed, openlijke geweldpleging en Opiumwet.
3. Leg per uitspraak het automatische resultaat naast de vonnistekst rechts op het scherm. Klik op **Alles geverifieerd** als het klopt; corrigeer het anders.

## Per uitspraak controleren
| Onderdeel | Klopt als… |
|---|---|
| Uitkomst | veroordeling / vrijspraak / ontslag / schuldig zonder straf / OM niet-ontvankelijk juist is |
| Opgelegde straf | elke component (soort, hoogte, voorwaardelijk deel, proeftijd) overeenkomt met het dictum |
| Eis OM | de vordering van de officier van justitie juist is en niet is verward met de opgelegde straf |
| Delict | de juridische kwalificatie overeenkomt met de categorie |
| Meerdere feiten | is aangevinkt als er meer dan één feit bewezen is verklaard |
| Documentatie | blanco / geen relevante / eerder / recidive alleen bij uitdrukkelijke vermelding |
| Letsel | categorie overeenkomt met de vastgestelde feiten |
| Omstandigheden | "meegewogen" alleen als de politierechter het in de strafmotivering zelf noemt |

## Beslisregel
- Is ≥ 95% van de opgelegde straffen en uitkomsten juist? Dan kunnen de statistieken met de huidige disclaimer online.
- Is het lager? Noteer de typische fouten en geef ze door, dan wordt de extractor aangepast.
- Draai na correcties `npm run evaluate` en noteer het resultaat.
