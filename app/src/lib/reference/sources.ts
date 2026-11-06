export const SOURCES = [
  {
    code: "rechtspraak-open-data",
    name: "Open Data van de Rechtspraak",
    url: "https://data.rechtspraak.nl",
    access_method: "REST/XML-API (zoeken + content per ECLI)",
    license:
      "Openbare gepubliceerde uitspraken. Op rechterlijke uitspraken rust geen auteursrecht (art. 11 Auteurswet). Hergebruik volgens de voorwaarden van Open Data van de Rechtspraak, met bronvermelding.",
    terms_note:
      "Primaire bron voor alle bronteksten. Uitspraken zijn door de Rechtspraak geanonimiseerd. Rate limit aangehouden: ≥300 ms tussen verzoeken, maximaal 3 gelijktijdige verbindingen.",
    rate_limit_ms: 300,
  },
  {
    code: "rechtspraak-zoekdienst",
    name: "Zoekdienst uitspraken.rechtspraak.nl",
    url: "https://uitspraken.rechtspraak.nl",
    access_method: "Zoekopdracht (uitsluitend voor het ontdekken van ECLI-nummers)",
    license: "Uitsluitend metadata (ECLI, datums) wordt gebruikt; de inhoud komt via Open Data.",
    terms_note:
      "Gebruikt omdat de Open Data-API niet op procedure (politierechter) kan filteren. robots.txt staat /api/zoek toe; verzoeken worden beperkt tot ≤1 per 1,2 s. Bulktoestemming wordt aangevraagd bij de Raad voor de rechtspraak.",
    rate_limit_ms: 1200,
  },
];
