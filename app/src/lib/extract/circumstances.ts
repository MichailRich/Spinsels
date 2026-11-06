// Herkenning van strafverzwarende en strafverminderende omstandigheden.
//
// Status:
//   'meegewogen' — staat in de strafmotivering van de politierechter zelf
//   'genoemd'    — komt elders in de uitspraak voor (bv. in de eis of het pleidooi)
// Omstandigheden waarover niets in de uitspraak staat, worden NIET vastgelegd
// (zij blijven 'onbekend'). Er wordt nooit iets afgeleid uit het ontbreken van informatie.

import { negatedBefore, type Sentence, type Span, inSpans } from "./text";

export type CircumstanceCode =
  | "recidive" | "ernstig_letsel" | "wapengebruik" | "meerdere_slachtoffers" | "geweld_hulpverleners"
  | "kwetsbaar_slachtoffer" | "groepsgeweld" | "ernstige_gevolgen" | "herhaald_gedrag" | "huiselijk_geweld"
  | "blanco_strafblad" | "geen_relevante_documentatie" | "bekentenis" | "berouw" | "excuses" | "positieve_ontwikkeling"
  | "behandeling" | "verminderd_toerekeningsvatbaar" | "redelijke_termijn" | "persoonlijke_omstandigheden"
  | "herstel" | "jeugdige_leeftijd" | "tijdsverloop" | "ontkenning" | "proceshouding_negatief";

export const CIRCUMSTANCES: Record<CircumstanceCode, { label: string; polarity: "verzwarend" | "verminderend" | "neutraal"; help: string }> = {
  recidive: { label: "Recidive / relevante eerdere veroordelingen", polarity: "verzwarend", help: "De uitspraak vermeldt uitdrukkelijk eerdere (relevante) veroordelingen." },
  ernstig_letsel: { label: "Ernstig letsel", polarity: "verzwarend", help: "Fracturen, zwaar lichamelijk letsel, ziekenhuisopname of blijvende gevolgen." },
  wapengebruik: { label: "Wapengebruik", polarity: "verzwarend", help: "Een wapen of voorwerp is gebruikt of getoond." },
  meerdere_slachtoffers: { label: "Meerdere slachtoffers", polarity: "verzwarend", help: "Het feit trof meer dan één slachtoffer." },
  geweld_hulpverleners: { label: "Geweld/bedreiging tegen hulpverleners of ambtenaren", polarity: "verzwarend", help: "Slachtoffer was politie, boa, ambulance- of ander publiek personeel." },
  kwetsbaar_slachtoffer: { label: "Kwetsbaar slachtoffer", polarity: "verzwarend", help: "Minderjarige, oudere of anderszins kwetsbare persoon." },
  groepsgeweld: { label: "Groepsgeweld", polarity: "verzwarend", help: "Gepleegd in vereniging of als groep." },
  ernstige_gevolgen: { label: "Ernstige gevolgen", polarity: "verzwarend", help: "Psychische of materiële gevolgen die de rechter uitdrukkelijk zwaar acht." },
  herhaald_gedrag: { label: "Langdurig of herhaald gedrag", polarity: "verzwarend", help: "Meermalen gepleegd of over een langere periode." },
  huiselijk_geweld: { label: "Huiselijke kring", polarity: "verzwarend", help: "Gepleegd tegen (ex-)partner, kind of huisgenoot." },
  blanco_strafblad: { label: "Blanco strafblad", polarity: "verminderend", help: "Uitdrukkelijk vermeld dat verdachte niet eerder is veroordeeld." },
  geen_relevante_documentatie: { label: "Geen relevante eerdere veroordelingen", polarity: "verminderend", help: "Wel eerder veroordeeld, maar niet voor soortgelijke feiten (uitdrukkelijk vermeld)." },
  bekentenis: { label: "Bekentenis", polarity: "verminderend", help: "Verdachte heeft het feit bekend." },
  berouw: { label: "Berouw / spijt", polarity: "verminderend", help: "Verdachte toont spijt, berouw of schuldinzicht." },
  excuses: { label: "Excuses", polarity: "verminderend", help: "Verdachte heeft excuses aangeboden." },
  positieve_ontwikkeling: { label: "Positieve persoonlijke ontwikkeling", polarity: "verminderend", help: "Werk, opleiding, stabiele situatie of afgerond traject." },
  behandeling: { label: "Behandeling / hulpverlening", polarity: "verminderend", help: "Verdachte volgt of aanvaardt behandeling of begeleiding." },
  verminderd_toerekeningsvatbaar: { label: "Verminderde toerekeningsvatbaarheid", polarity: "verminderend", help: "Feit kan in verminderde mate worden toegerekend." },
  redelijke_termijn: { label: "Overschrijding redelijke termijn", polarity: "verminderend", help: "De redelijke termijn (art. 6 EVRM) is overschreden." },
  persoonlijke_omstandigheden: { label: "Bijzondere persoonlijke omstandigheden", polarity: "verminderend", help: "De rechter weegt de persoonlijke situatie van verdachte mee." },
  herstel: { label: "Herstelgerichte inspanningen", polarity: "verminderend", help: "Schade vergoed, herstelbemiddeling of mediation." },
  jeugdige_leeftijd: { label: "Jeugdige leeftijd", polarity: "verminderend", help: "De jonge leeftijd van verdachte is meegewogen." },
  tijdsverloop: { label: "Tijdsverloop sinds het feit", polarity: "verminderend", help: "Het feit is geruime tijd geleden gepleegd." },
  ontkenning: { label: "Ontkenning", polarity: "neutraal", help: "Verdachte ontkent het feit (geen strafverzwarende factor op zich)." },
  proceshouding_negatief: { label: "Geen verantwoordelijkheid genomen", polarity: "verzwarend", help: "De rechter rekent het verdachte aan dat hij geen verantwoordelijkheid neemt." },
};

type Rule = { code: CircumstanceCode; re: RegExp; negatable?: boolean; exclude?: RegExp };

const RULES: Rule[] = [
  // documentatie
  { code: "geen_relevante_documentatie", re: /niet eerder[^.;]{0,40}(?:voor|ter zake van|wegens) (?:een )?(?:soortgelijk|vergelijkbaar|gelijksoortig)|geen relevante (?:justitiële )?documentatie|niet (?:eerder )?(?:voor|ter zake van) (?:een )?soortgelijke? feit(?:en)? (?:is )?veroordeeld|(?:eerder|wel) (?:is )?veroordeeld,? (?:maar|doch) niet (?:voor|ter zake van) (?:soortgelijk|vergelijkbaar)/ },
  { code: "blanco_strafblad", re: /blanco (?:strafblad|justitiële documentatie|documentatie)|geen strafblad|niet eerder (?:onherroepelijk |strafrechtelijk )*(?:is )?veroordeeld|nog nooit (?:eerder )?(?:is )?(?:veroordeeld|met (?:politie|justitie) in aanraking)|niet eerder met (?:politie|justitie) in aanraking|first offender|(?:volgt|blijkt) dat (?:de )?verdachte niet eerder/, exclude: /soortgelijk|vergelijkbaar|gelijksoortig|ter zake van een|voor een (?:dergelijk|zelfde)/ },
  { code: "recidive", re: /(?:eerder|meermalen|vaker|reeds|meerdere keren|vele malen|veelvuldig|herhaaldelijk)[^.;]{0,50}(?:onherroepelijk )?(?:is )?veroordeeld|recidive|recidiveert|recidiveerde|veelpleger|stelselmatige dader|in de proeftijd van (?:een )?eerdere?|tijdens (?:een )?(?:lopende )?proeftijd|binnen (?:de )?vijf jaar[^.;]{0,60}veroordeeld/, negatable: true, exclude: /(?:voorkom\w*|voorkoming|risico|kans|gevaar|inschatting|beperken|terugdringen|verminderen)[^.;]{0,25}recidive|recidive(?:risico|gevaar|kans)/ },
  // letsel/gevolgen
  { code: "ernstig_letsel", re: /zwaar lichamelijk letsel|fractuur|gebroken (?:neus|kaak|jukbeen|oogkas|rib|ribben|arm|been|pols|vinger|tand|tanden|enkel|sleutelbeen)|botbreuk|neusbreuk|kaakbreuk|hersenschudding|geopereerd|operatie|blijvend(?:e)? (?:letsel|schade|littekens?)|in het ziekenhuis (?:opgenomen|belandde)/, negatable: true, exclude: /poging|had kunnen|zou kunnen|kunnen leiden/ },
  { code: "ernstige_gevolgen", re: /(?:ernstige|grote|forse|aanzienlijke|nadelige) (?:psychische )?gevolgen|angst(?:gevoelens)? (?:heeft|hebben)|nog steeds last|slachtofferverklaring|spreekrecht|gevoelens van (?:angst|onveiligheid)/, negatable: true },
  // aard van het feit
  { code: "wapengebruik", re: /\b(?:mes|messen|keukenmes|zakmes|vuurwapen|pistool|revolver|steekwapen|slagwapen|knuppel|honkbalknuppel|boksbeugel|bijl|hamer|vleesmes|stroomstootwapen|taser|pepperspray|nepvuurwapen|alarmpistool)\b/, negatable: true },
  { code: "meerdere_slachtoffers", re: /meerdere slachtoffers|twee slachtoffers|drie slachtoffers|verschillende slachtoffers|\[slachtoffer 2\]|\[aangever 2\]|\[aangeefster 2\]/ },
  { code: "geweld_hulpverleners", re: /(?:politieambtena(?:a)?r|politieagent|agent(?:en)? van politie|hoofdagent|surveillant|verbalisant(?:en)?|buitengewoon opsporingsambtenaar|\bboa\b|handhaver|ambulancemedewerker|ambulancepersoneel|hulpverlener|brandweer|ambtenaar in de rechtmatige uitoefening|ziekenhuispersoneel|conducteur|hoofdconducteur|beveiliger)/ },
  { code: "kwetsbaar_slachtoffer", re: /kwetsbare?|minderjarige? (?:slachtoffer|aangever|aangeefster|jongen|meisje)|hoge leeftijd|bejaarde|weerloos|hulpeloos/, negatable: true },
  { code: "groepsgeweld", re: /in vereniging|openlijk(?:,)? in vereniging|met (?:zijn|haar) vrienden|in een groep|groepsgeweld|samen met (?:anderen|een ander)/ },
  { code: "herhaald_gedrag", re: /meermalen|meerdere keren|herhaaldelijk|stelselmatig|gedurende (?:een )?(?:langere )?periode|langdurig|structureel|veelvuldig/, negatable: true },
  { code: "huiselijk_geweld", re: /huiselijk geweld|huiselijke kring|(?:zijn|haar) (?:ex-)?(?:partner|echtgenote|echtgenoot|vriendin|vrouw|levensgezel(?:lin|le)?)|ex-partner|ex-vriendin|ex-vriend/ },
  // houding
  { code: "bekentenis", re: /(?:heeft|had) (?:het|de|deze|dit)?(?:\s*(?:ten ?laste ?gelegde|tenlastegelegde|bewezenverklaarde))?\s*(?:feit|feiten)?\s*(?:ter (?:terechtzitting|zitting)\s*)?(?:volledig |ruimhartig |grotendeels )?bekend|bekennende verklaring|verdachte bekent|heeft bekend|bekent het|zich (?:volledig )?schuldig (?:te )?(?:hebben )?gemaakt erkend|erkent (?:het|de) (?:feit|feiten)|heeft erkend/, negatable: true },
  { code: "ontkenning", re: /ontkent|heeft ontkend|ontkennende|beroept zich op (?:zijn|haar) zwijgrecht|heeft (?:zich )?op (?:zijn|haar) zwijgrecht/ },
  { code: "berouw", re: /spijt|berouw|schuldinzicht|schuldbewust|zich schaamt|schaamte|beseft (?:dat|hoe)|inzicht (?:heeft )?(?:getoond|in (?:zijn|haar) handelen)|neemt verantwoordelijkheid|verantwoordelijkheid (?:heeft )?genomen/, negatable: true },
  { code: "proceshouding_negatief", re: /geen (?:enkele )?verantwoordelijkheid (?:genomen|neemt)|geen (?:enkel )?(?:spijt|berouw|schuldinzicht)|rekent (?:het )?(?:de )?verdachte (?:zwaar )?aan dat (?:hij|zij) geen/ },
  { code: "excuses", re: /excuses|excuus|verontschuldig/, negatable: true },
  { code: "positieve_ontwikkeling", re: /positieve (?:ontwikkeling|wending|stappen)|(?:heeft|inmiddels) (?:vast )?werk|(?:een )?(?:vaste )?baan|opleiding (?:volgt|gestart|afgerond)|(?:zijn|haar) leven (?:weer )?op (?:de )?(?:rit|orde)|stabiele (?:situatie|woonsituatie|leefsituatie)|(?:is|blijft) gestopt met (?:drinken|blowen|gebruik|drugs)|abstinent/, negatable: true },
  { code: "behandeling", re: /(?:ambulante |klinische )?behandeling|hulpverlening|begeleiding|reclasseringstoezicht|onder toezicht van de reclassering|psycholoog|psychiater|verslavingszorg|therapie|traject/, negatable: true, exclude: /medische behandeling|behandeling (?:van de|ter) (?:zaak|terechtzitting)|ter zitting|inhoudelijke behandeling|behandeld op/ },
  { code: "verminderd_toerekeningsvatbaar", re: /verminderd(?:e)? (?:mate )?toerekeningsvatba|in (?:licht |sterk )?verminderde mate (?:worden )?toegerekend|verminderd toegerekend/, negatable: true },
  { code: "redelijke_termijn", re: /redelijke termijn/, exclude: /niet (?:is )?overschreden|geen sprake (?:is )?van (?:een )?overschrijding|binnen de redelijke termijn/ },
  { code: "persoonlijke_omstandigheden", re: /persoonlijke omstandigheden|(?:financiële|financieel) (?:situatie|problemen|draagkracht)|schulden|dakloos|mantelzorg|(?:zijn|haar) kinderen|thuissituatie|gezondheid(?:stoestand)?|psychische (?:problemen|klachten)|licht verstandelijke beperking|lvb/, negatable: true },
  { code: "herstel", re: /schade (?:heeft |inmiddels |volledig )*(?:vergoed|betaald|terugbetaald)|herstelbemiddeling|mediation|herstelrecht|in der minne geschikt|(?:heeft|is) (?:het )?(?:geld|bedrag) (?:terug)?betaald|schadevergoeding (?:heeft )?(?:voldaan|betaald)/, negatable: true },
  { code: "jeugdige_leeftijd", re: /jeugdige leeftijd|jonge leeftijd|(?:nog )?(?:erg |zeer )?jong (?:is|was)|adolescent/ },
  { code: "tijdsverloop", re: /tijdsverloop|geruime tijd geleden|(?:lang|enige tijd) geleden (?:is )?gepleegd|tijd die (?:inmiddels )?is verstreken/ },
];

// Zinnen waarin de rechter zelf weegt (in de strafmotivering)
const WEIGH_RE = /rekening|houdt|gehouden|weegt|gewogen|in aanmerking|acht|let|gelet|betrekt|neemt|rekent|aangerekend|strafverzwarend|strafverminderend|in het voordeel|in het nadeel|ten gunste|ten nadele|matigen|gematigd|verlaagt|lager|hoger|passend|geboden/;

export type FoundCircumstance = {
  code: CircumstanceCode;
  polarity: "verzwarend" | "verminderend" | "neutraal";
  status: "meegewogen" | "genoemd";
  evidence: string;
  evidenceStart: number;
  evidenceEnd: number;
  confidence: number;
};

export function findCircumstances(
  sents: Sentence[],
  motivation: Span[],
  opts: { excludeSpans?: Span[]; isViolent: boolean; isTraffic: boolean },
): FoundCircumstance[] {
  const out: FoundCircumstance[] = [];
  for (const s of sents) {
    if (inSpans(s.start, opts.excludeSpans)) continue;
    const lower = s.text.toLowerCase();
    for (const r of RULES) {
      const m = r.re.exec(lower);
      if (!m) continue;
      if (r.exclude && r.exclude.test(lower)) continue;
      if (r.negatable && negatedBefore(lower, m.index)) continue;
      // context-beperkingen
      if ((r.code === "ernstig_letsel" || r.code === "wapengebruik" || r.code === "groepsgeweld") && !opts.isViolent) continue;
      if (r.code === "geweld_hulpverleners" && !/(?:mishandel|bedreig|geweld|geschopt|geslagen|gespuugd|spuug|beledig|verzet|wederspannig|duw|trap)/.test(lower)) continue;
      if (r.code === "behandeling" && opts.isTraffic && /rijvaardigheid/.test(lower)) continue;
      const inMotivation = inSpans(s.start, motivation);
      const status = inMotivation && (WEIGH_RE.test(lower) || r.code === "recidive" || r.code === "blanco_strafblad" || r.code === "geen_relevante_documentatie") ? "meegewogen" : "genoemd";
      out.push({
        code: r.code,
        polarity: CIRCUMSTANCES[r.code].polarity,
        status,
        evidence: s.text.length > 600 ? s.text.slice(0, 600) + "…" : s.text,
        evidenceStart: s.start,
        evidenceEnd: s.end,
        confidence: status === "meegewogen" ? 0.75 : 0.55,
      });
    }
  }
  // per code: houd max. 3 bewijszinnen, meegewogen eerst
  const by = new Map<string, FoundCircumstance[]>();
  for (const c of out) by.set(c.code, [...(by.get(c.code) ?? []), c]);
  const result: FoundCircumstance[] = [];
  for (const [, list] of by) {
    list.sort((a, b) => (a.status === b.status ? a.evidenceStart - b.evidenceStart : a.status === "meegewogen" ? -1 : 1));
    result.push(...list.slice(0, 3));
  }
  return result;
}
