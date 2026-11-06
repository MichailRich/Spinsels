// Rechtbanken (ECLI-instantiecodes). Historische codes (vóór de herziening van de
// gerechtelijke kaart per 1 januari 2013) worden gekoppeld aan de huidige rechtbank.

export type Court = {
  code: string;
  name: string;
  currentCode: string;
  seat: string;
  lat: number;
  lon: number;
  historical: boolean;
  note?: string;
};

const current: Court[] = [
  { code: "RBAMS", name: "Rechtbank Amsterdam", currentCode: "RBAMS", seat: "Amsterdam", lat: 52.3412, lon: 4.8558, historical: false },
  { code: "RBDHA", name: "Rechtbank Den Haag", currentCode: "RBDHA", seat: "Den Haag", lat: 52.0786, lon: 4.3123, historical: false },
  { code: "RBROT", name: "Rechtbank Rotterdam", currentCode: "RBROT", seat: "Rotterdam", lat: 51.9225, lon: 4.4792, historical: false },
  { code: "RBMNE", name: "Rechtbank Midden-Nederland", currentCode: "RBMNE", seat: "Utrecht", lat: 52.0907, lon: 5.1214, historical: false },
  { code: "RBNHO", name: "Rechtbank Noord-Holland", currentCode: "RBNHO", seat: "Haarlem", lat: 52.3874, lon: 4.6462, historical: false },
  { code: "RBNNE", name: "Rechtbank Noord-Nederland", currentCode: "RBNNE", seat: "Groningen", lat: 53.2194, lon: 6.5665, historical: false },
  { code: "RBOBR", name: "Rechtbank Oost-Brabant", currentCode: "RBOBR", seat: "'s-Hertogenbosch", lat: 51.6978, lon: 5.3037, historical: false },
  { code: "RBZWB", name: "Rechtbank Zeeland-West-Brabant", currentCode: "RBZWB", seat: "Breda", lat: 51.5719, lon: 4.7683, historical: false },
  { code: "RBLIM", name: "Rechtbank Limburg", currentCode: "RBLIM", seat: "Maastricht", lat: 50.8514, lon: 5.691, historical: false },
  { code: "RBGEL", name: "Rechtbank Gelderland", currentCode: "RBGEL", seat: "Arnhem", lat: 51.9851, lon: 5.8987, historical: false },
  { code: "RBOVE", name: "Rechtbank Overijssel", currentCode: "RBOVE", seat: "Zwolle", lat: 52.5168, lon: 6.083, historical: false },
];

const hist = (code: string, name: string, currentCode: string, seat: string, lat: number, lon: number, note?: string): Court => ({
  code, name, currentCode, seat, lat, lon, historical: true, note,
});

const historical: Court[] = [
  hist("RBALK", "Rechtbank Alkmaar", "RBNHO", "Alkmaar", 52.6324, 4.7534),
  hist("RBHAA", "Rechtbank Haarlem", "RBNHO", "Haarlem", 52.3874, 4.6462),
  hist("RBARN", "Rechtbank Arnhem", "RBGEL", "Arnhem", 51.9851, 5.8987),
  hist("RBZUT", "Rechtbank Zutphen", "RBGEL", "Zutphen", 52.1386, 6.2014),
  hist("RBASS", "Rechtbank Assen", "RBNNE", "Assen", 52.9925, 6.5649),
  hist("RBGRO", "Rechtbank Groningen", "RBNNE", "Groningen", 53.2194, 6.5665),
  hist("RBLEE", "Rechtbank Leeuwarden", "RBNNE", "Leeuwarden", 53.2012, 5.7999),
  hist("RBBRE", "Rechtbank Breda", "RBZWB", "Breda", 51.5719, 4.7683),
  hist("RBMID", "Rechtbank Middelburg", "RBZWB", "Middelburg", 51.4988, 3.6136),
  hist("RBDOR", "Rechtbank Dordrecht", "RBROT", "Dordrecht", 51.8133, 4.6901),
  hist("RBMAA", "Rechtbank Maastricht", "RBLIM", "Maastricht", 50.8514, 5.691),
  hist("RBROE", "Rechtbank Roermond", "RBLIM", "Roermond", 51.1942, 5.9872),
  hist("RBSGR", "Rechtbank 's-Gravenhage", "RBDHA", "Den Haag", 52.0786, 4.3123),
  hist("RBSHE", "Rechtbank 's-Hertogenbosch", "RBOBR", "'s-Hertogenbosch", 51.6978, 5.3037),
  hist("RBUTR", "Rechtbank Utrecht", "RBMNE", "Utrecht", 52.0907, 5.1214),
  hist("RBZLY", "Rechtbank Zwolle-Lelystad", "RBOVE", "Zwolle", 52.5168, 6.083, "Lelystad ging per 2013 naar Midden-Nederland"),
  hist("RBALM", "Rechtbank Almelo", "RBOVE", "Almelo", 52.3567, 6.6625),
  hist("RBONE", "Rechtbank Oost-Nederland", "RBGEL", "Arnhem/Zwolle", 51.9851, 5.8987, "Bestond 2013–2014; daarna gesplitst in Gelderland en Overijssel"),
];

export const COURTS: Court[] = [...current, ...historical];
export const COURT_BY_CODE = new Map(COURTS.map((c) => [c.code, c]));
export const CURRENT_COURTS = current;

export function courtFromEcli(ecli: string): Court | undefined {
  const code = ecli.split(":")[2];
  return COURT_BY_CODE.get(code);
}
