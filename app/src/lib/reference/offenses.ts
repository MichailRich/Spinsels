// Classificatie van strafbare feiten die door de politierechter worden behandeld.
// Iedere categorie is gekoppeld aan wetsartikelen (code 'Wet:artikel').
// Matching gebeurt op de juridische kwalificatie (wettelijke omschrijving),
// de toegepaste artikelen en — alleen als aanvulling — de bewezenverklaring.

export type OffenseCategory = {
  code: string;
  group: "geweld" | "vermogen" | "verkeer" | "drugs" | "overig";
  label: string;
  description: string;
  articles: string[];
  /** Regex op kwalificatietekst (lowercase, genormaliseerd) */
  qual?: RegExp[];
  /** Artikelen die (zonder meer) op deze categorie wijzen */
  articleHints?: RegExp[];
  /** Aanvullende context in bewezenverklaring die vereist is (verfijning) */
  refine?: RegExp;
  /** Prioriteit bij meerdere treffers: hoger = specifieker */
  priority: number;
  /** Zoektermen voor natuurlijke taal */
  synonyms: string[];
};

export const GROUPS: Record<OffenseCategory["group"], string> = {
  geweld: "Geweldsdelicten",
  vermogen: "Vermogensdelicten",
  verkeer: "Verkeersdelicten",
  drugs: "Drugsdelicten",
  overig: "Overige delicten",
};

export const OFFENSES: OffenseCategory[] = [
  // ------------------------------------------------------------- geweld
  {
    code: "mishandeling", group: "geweld", label: "Eenvoudige mishandeling",
    description: "Mishandeling zonder zwaar lichamelijk letsel (art. 300 lid 1 Sr).",
    articles: ["Sr:300"], priority: 10,
    qual: [/(?<!zware )(?<!poging tot zware )mishandeling/],
    articleHints: [/^Sr:300$/],
    synonyms: ["mishandeling", "mishandelen", "geslagen", "slaan", "klap", "vechtpartij", "schoppen", "geschopt"],
  },
  {
    code: "mishandeling_zwaar_letsel", group: "geweld", label: "Mishandeling met zwaar lichamelijk letsel",
    description: "Mishandeling, zwaar lichamelijk letsel ten gevolge hebbende (art. 300 lid 2 Sr).",
    articles: ["Sr:300"], priority: 30,
    qual: [/mishandeling,? (?:terwijl het feit )?zwaar lichamelijk letsel ten gevolge hebbende/, /mishandeling[^.;]{0,60}zwaar lichamelijk letsel ten gevolge/],
    synonyms: ["gebroken neus", "botbreuk", "fractuur", "zwaar letsel"],
  },
  {
    code: "zware_mishandeling", group: "geweld", label: "Zware mishandeling",
    description: "Opzettelijk toebrengen van zwaar lichamelijk letsel (art. 302 Sr), inclusief poging.",
    articles: ["Sr:302", "Sr:45"], priority: 40,
    qual: [/zware mishandeling/, /opzettelijk (?:een ander )?zwaar lichamelijk letsel toebrengen/],
    articleHints: [/^Sr:302$/],
    synonyms: ["zware mishandeling"],
  },
  {
    code: "bedreiging", group: "geweld", label: "Bedreiging",
    description: "Bedreiging met een misdrijf (art. 285 Sr).",
    articles: ["Sr:285"], priority: 15,
    qual: [/bedreiging met/, /bedreigen met/],
    articleHints: [/^Sr:285$/],
    synonyms: ["bedreiging", "bedreigen", "bedreigd", "dreigen", "doodsbedreiging"],
  },
  {
    code: "openlijke_geweldpleging", group: "geweld", label: "Openlijke geweldpleging",
    description: "Openlijk in vereniging geweld plegen tegen personen of goederen (art. 141 Sr).",
    articles: ["Sr:141"], priority: 35,
    qual: [/openlijk(?:,)? in vereniging geweld/, /openlijke geweldpleging/],
    articleHints: [/^Sr:141$/],
    synonyms: ["openlijke geweldpleging", "groepsgeweld", "in vereniging geweld"],
  },
  {
    code: "huiselijk_geweld", group: "geweld", label: "Huiselijk geweld",
    description: "Mishandeling van (ex-)partner, kind of huisgenoot (art. 300 jo. 304 sub 1 Sr).",
    articles: ["Sr:300", "Sr:304"], priority: 32,
    qual: [/mishandeling[^.;]{0,140}(?:levensgezel|echtgeno|partner|kind|zijn moeder|haar moeder|zijn vader|haar vader)/],
    synonyms: ["huiselijk geweld", "partnergeweld", "ex-partner", "mijn vrouw", "echtgenote", "vriendin geslagen"],
  },
  {
    code: "wederspannigheid", group: "geweld", label: "Wederspannigheid",
    description: "Met geweld verzet tegen een ambtenaar in de rechtmatige uitoefening van zijn bediening (art. 180 Sr).",
    articles: ["Sr:180"], priority: 30,
    qual: [/wederspannigheid/, /met geweld (?:of bedreiging met geweld )?verzet bieden/],
    articleHints: [/^Sr:180$/],
    synonyms: ["wederspannigheid", "verzet bij aanhouding", "verzet tegen politie"],
  },
  {
    code: "geweld_hulpverleners", group: "geweld", label: "Geweld tegen hulpverleners en ambtenaren",
    description: "Mishandeling of bedreiging van een ambtenaar/hulpverlener tijdens de rechtmatige uitoefening van zijn bediening (art. 300/285 jo. 304 sub 2 Sr).",
    articles: ["Sr:300", "Sr:304", "Sr:285"], priority: 45,
    qual: [/(?:mishandeling|bedreiging)[^.;]{0,160}ambtenaar[^.;]{0,80}(?:rechtmatige )?uitoefening van (?:zijn|haar|diens) bediening/, /(?:mishandeling|bedreiging)[^.;]{0,120}(?:hulpverlener|politieambtenaar|agent|boa|ambulance)/],
    synonyms: ["geweld tegen politie", "politieagent", "agent geslagen", "hulpverlener", "ambulancemedewerker", "boa", "handhaver", "geweld tegen hulpverleners", "politieagenten", "politie"],
  },
  // ------------------------------------------------------------- vermogen
  {
    code: "winkeldiefstal", group: "vermogen", label: "Winkeldiefstal",
    description: "Diefstal uit een winkel (art. 310 Sr); onderscheiden op basis van de bewezenverklaring.",
    articles: ["Sr:310"], priority: 25,
    qual: [/^diefstal$/, /(?<!gekwalificeerde )diefstal(?! met| door twee| waarbij)/],
    refine: /(winkel|supermarkt|albert heijn|jumbo|lidl|aldi|hema|kruidvat|action|etos|zeeman|primark|bijenkorf|mediamarkt|bouwmarkt|gamma|praxis|drogist|filiaal|warenhuis|tankstation)/,
    synonyms: ["winkeldiefstal", "winkel", "supermarkt", "gestolen uit winkel", "jatten in winkel", "tweede winkeldiefstal"],
  },
  {
    code: "diefstal", group: "vermogen", label: "Diefstal",
    description: "Eenvoudige diefstal (art. 310 Sr).",
    articles: ["Sr:310"], priority: 12,
    qual: [/(?<!gekwalificeerde )diefstal(?! met braak| door middel van braak)/],
    articleHints: [/^Sr:310$/],
    synonyms: ["diefstal", "stelen", "gestolen", "fietsdiefstal", "zakkenrollen"],
  },
  {
    code: "diefstal_braak", group: "vermogen", label: "Diefstal met braak (gekwalificeerde diefstal)",
    description: "Diefstal door middel van braak, verbreking, inklimming of valse sleutels; of in vereniging (art. 311 Sr).",
    articles: ["Sr:311"], priority: 28,
    qual: [/diefstal[^.;]{0,140}(?:braak|verbreking|inklimming|valse sleutel|valse order|vals kostuum)/, /gekwalificeerde diefstal/, /diefstal door twee of meer verenigde personen/, /inbraak/],
    articleHints: [/^Sr:311$/],
    synonyms: ["inbraak", "diefstal met braak", "ingebroken", "braak"],
  },
  {
    code: "verduistering", group: "vermogen", label: "Verduistering",
    description: "Opzettelijk wederrechtelijk toe-eigenen van een goed dat men anders dan door misdrijf onder zich heeft (art. 321–323a Sr).",
    articles: ["Sr:321", "Sr:322", "Sr:323"], priority: 20,
    qual: [/verduistering/],
    articleHints: [/^Sr:32[123]a?$/],
    synonyms: ["verduistering", "verduisterd", "huurauto niet teruggebracht"],
  },
  {
    code: "oplichting", group: "vermogen", label: "Oplichting",
    description: "Oplichting (art. 326 Sr) en flessentrekkerij (art. 326a Sr).",
    articles: ["Sr:326", "Sr:326a"], priority: 22,
    qual: [/oplichting/, /flessentrekkerij/],
    articleHints: [/^Sr:326a?$/],
    synonyms: ["oplichting", "opgelicht", "marktplaats", "phishing", "bankhelpdeskfraude", "flessentrekkerij"],
  },
  {
    code: "heling", group: "vermogen", label: "Heling",
    description: "(Schuld)heling (art. 416–417bis Sr).",
    articles: ["Sr:416", "Sr:417bis"], priority: 22,
    qual: [/heling/],
    articleHints: [/^Sr:41[67](bis)?$/],
    synonyms: ["heling", "gestolen fiets gekocht", "schuldheling", "opzetheling"],
  },
  {
    code: "vernieling", group: "vermogen", label: "Vernieling",
    description: "Opzettelijk en wederrechtelijk vernielen of beschadigen van een goed (art. 350 Sr).",
    articles: ["Sr:350"], priority: 18,
    qual: [/vernielen|vernieling|beschadigen/],
    articleHints: [/^Sr:350$/],
    synonyms: ["vernieling", "vernield", "beschadigd", "kapot gemaakt", "ruit ingegooid"],
  },
  {
    code: "fraude", group: "vermogen", label: "Fraude (uitkerings-, toeslagen- en overige fraude)",
    description: "O.a. uitkeringsfraude (art. 227a/227b Sr), witwassen in eenvoudige vorm (art. 420bis.1 Sr) en overige fraudevormen.",
    articles: ["Sr:227a", "Sr:227b", "Sr:420bis", "Sr:420bis.1", "Sr:420quater"], priority: 20,
    qual: [/(?:niet|onjuist|onvolledig)[^.;]{0,40}(?:verstrekken|nakomen)[^.;]{0,80}(?:gegevens|verplichting)/, /witwassen/, /fraude/],
    articleHints: [/^Sr:227[ab]$/, /^Sr:420(bis|quater)/],
    synonyms: ["fraude", "uitkeringsfraude", "bijstandsfraude", "witwassen", "toeslagenfraude"],
  },
  // ------------------------------------------------------------- verkeer
  {
    code: "rijden_onder_invloed_alcohol", group: "verkeer", label: "Rijden onder invloed van alcohol",
    description: "Besturen van een voertuig met een te hoog adem- of bloedalcoholgehalte (art. 8 lid 2/3 WVW 1994).",
    articles: ["WVW:8"], priority: 25,
    qual: [/artikel 8,? (?:tweede|derde) lid[^.;]{0,40}wegenverkeerswet/, /alcoholhoudende drank/, /(?:adem|bloed)alcoholgehalte/],
    synonyms: ["rijden onder invloed", "dronken rijden", "alcohol", "rijden met drank op", "ademalcohol", "rijden onder invloed van alcohol", "beschonken"],
  },
  {
    code: "rijden_onder_invloed_drugs", group: "verkeer", label: "Rijden onder invloed van drugs",
    description: "Besturen onder invloed van drugs of een combinatie met alcohol (art. 8 lid 1 en lid 5 WVW 1994).",
    articles: ["WVW:8"], priority: 26,
    qual: [/artikel 8,? (?:vijfde|eerste) lid[^.;]{0,40}wegenverkeerswet/, /(?:stof|stoffen) (?:als bedoeld in|waarvan)[^.;]{0,120}(?:rijvaardigheid|bloed)/, /onder invloed van (?:een )?(?:stof|drugs)/],
    synonyms: ["drugs achter het stuur", "rijden onder invloed van drugs", "cocaïne", "thc", "amfetamine", "rijden onder invloed van cannabis"],
  },
  {
    code: "rijden_zonder_rijbewijs", group: "verkeer", label: "Rijden zonder (geldig) rijbewijs",
    description: "Besturen zonder rijbewijs of met ongeldig verklaard rijbewijs (art. 107 en 9 lid 1 WVW 1994).",
    articles: ["WVW:107", "WVW:9"], priority: 20,
    qual: [/artikel 107[^.;]{0,40}wegenverkeerswet/, /artikel 9,? (?:eerste|vierde) lid[^.;]{0,40}wegenverkeerswet/, /zonder (?:geldig )?rijbewijs/, /ongeldig verklaard/],
    synonyms: ["zonder rijbewijs", "geen rijbewijs", "ongeldig rijbewijs", "rijbewijs ongeldig verklaard"],
  },
  {
    code: "rijden_tijdens_ontzegging", group: "verkeer", label: "Rijden tijdens rijontzegging",
    description: "Besturen terwijl de rijbevoegdheid is ontzegd (art. 9 lid 2 WVW 1994).",
    articles: ["WVW:9"], priority: 27,
    qual: [/artikel 9,? (?:tweede|derde) lid[^.;]{0,40}wegenverkeerswet/, /(?:terwijl|wetende dat)[^.;]{0,80}(?:bevoegdheid|rijbevoegdheid)[^.;]{0,40}ontzegd/],
    synonyms: ["rijden tijdens ontzegging", "ontzegging", "rijverbod", "rijontzegging overtreden"],
  },
  {
    code: "gevaarlijk_rijgedrag", group: "verkeer", label: "Gevaarlijk rijgedrag",
    description: "Gevaar of hinder veroorzaken op de weg (art. 5 WVW 1994) of zeer gevaarlijk rijgedrag (art. 5a WVW 1994).",
    articles: ["WVW:5", "WVW:5a"], priority: 18,
    qual: [/artikel 5a?,?[^.;]{0,30}wegenverkeerswet/, /gevaar op de weg/, /zeer gevaarlijk/, /verkeersgedraging/],
    synonyms: ["gevaarlijk rijden", "racen", "te hard rijden", "bumperkleven", "roekeloos rijden", "gevaarlijk rijgedrag"],
  },
  {
    code: "verlaten_plaats_ongeval", group: "verkeer", label: "Verlaten plaats ongeval",
    description: "Doorrijden na een ongeval (art. 7 WVW 1994).",
    articles: ["WVW:7"], priority: 24,
    qual: [/artikel 7,?[^.;]{0,30}wegenverkeerswet/, /plaats van het ongeval/, /doorrijden na/],
    synonyms: ["doorrijden na ongeval", "verlaten plaats ongeval", "aanrijding doorgereden", "doorgereden"],
  },
  {
    code: "verkeersongeval_letsel", group: "verkeer", label: "Verkeersongeval met letsel of dood",
    description: "Schuld aan een verkeersongeval met zwaar lichamelijk letsel of de dood (art. 6 WVW 1994).",
    articles: ["WVW:6"], priority: 32,
    qual: [/artikel 6,?[^.;]{0,30}wegenverkeerswet/, /verkeersongeval[^.;]{0,100}(?:letsel|gedood|overleden)/, /(?:aanmerkelijk )?onvoorzichtig[^.;]{0,120}(?:zwaar lichamelijk letsel|gedood)/],
    synonyms: ["verkeersongeval", "aanrijding met letsel", "dodelijk ongeval", "ongeval letsel"],
  },
  {
    code: "weigeren_blaastest", group: "verkeer", label: "Weigeren medewerking ademonderzoek",
    description: "Niet meewerken aan een adem- of bloedonderzoek (art. 163 WVW 1994).",
    articles: ["WVW:163"], priority: 26,
    qual: [/artikel 163[^.;]{0,40}wegenverkeerswet/, /(?:niet|geen) (?:gevolg geven|medewerking)[^.;]{0,60}(?:ademonderzoek|bloedonderzoek|ademanalyse)/],
    synonyms: ["blaastest geweigerd", "weigeren blaastest", "ademtest weigeren"],
  },
  // ------------------------------------------------------------- drugs
  {
    code: "bezit_softdrugs", group: "drugs", label: "Bezit van softdrugs",
    description: "Opzettelijk aanwezig hebben van een middel van lijst II (art. 3 onder C Opiumwet).",
    articles: ["OW:3", "OW:11"], priority: 20,
    qual: [/artikel 3 onder c/, /in artikel 3 onder c/],
    synonyms: ["softdrugs", "wiet", "hasj", "cannabis bezit"],
  },
  {
    code: "bezit_harddrugs", group: "drugs", label: "Bezit van harddrugs",
    description: "Opzettelijk aanwezig hebben van een middel van lijst I (art. 2 onder C Opiumwet).",
    articles: ["OW:2", "OW:10"], priority: 20,
    qual: [/artikel 2 onder c/],
    synonyms: ["harddrugs", "cocaïne bezit", "xtc", "mdma", "heroïne", "speed", "ghb", "ketamine", "lachgas"],
  },
  {
    code: "drugshandel", group: "drugs", label: "Handel in verdovende middelen",
    description: "Verkopen, afleveren, verstrekken of vervoeren van drugs (art. 2/3 onder B Opiumwet), en art. 10a Opiumwet.",
    articles: ["OW:2", "OW:3", "OW:10", "OW:10a", "OW:11"], priority: 25,
    qual: [/artikel [23] onder b[^.;]{0,80}(?:verkopen|afleveren|verstrekken|vervoeren)/, /(?:verkopen|afleveren|verstrekken|vervoeren)[^.;]{0,80}artikel [23] onder b/, /artikel 10a/],
    synonyms: ["drugshandel", "dealen", "drugs verkopen", "handel in drugs", "drugsrunner"],
  },
  {
    code: "hennepteelt", group: "drugs", label: "Hennepteelt",
    description: "Telen van hennep (art. 3 onder B Opiumwet, telen).",
    articles: ["OW:3", "OW:11"], priority: 26,
    qual: [/artikel 3 onder b[^.;]{0,80}telen/, /telen[^.;]{0,80}artikel 3 onder b/, /hennepkwekerij|hennepteelt/],
    refine: /(hennep|kwekerij|plant)/,
    synonyms: ["hennepteelt", "wietplantage", "kwekerij", "hennepkwekerij", "wiet kweken"],
  },
  {
    code: "opiumwet_overig", group: "drugs", label: "Overige Opiumwetdelicten",
    description: "Overige overtredingen van de Opiumwet.",
    articles: ["OW:2", "OW:3", "OW:10", "OW:11"], priority: 5,
    qual: [/opiumwet/],
    synonyms: ["opiumwet"],
  },
  // ------------------------------------------------------------- overig
  {
    code: "belediging", group: "overig", label: "Belediging",
    description: "Eenvoudige belediging, ook van een ambtenaar in functie (art. 266–267 Sr).",
    articles: ["Sr:266", "Sr:267"], priority: 14,
    qual: [/belediging/],
    articleHints: [/^Sr:26[67]$/],
    synonyms: ["belediging", "uitschelden", "beledigen", "agent uitgescholden"],
  },
  {
    code: "belaging", group: "overig", label: "Belaging (stalking)",
    description: "Stelselmatig opzettelijk inbreuk maken op andermans persoonlijke levenssfeer (art. 285b Sr).",
    articles: ["Sr:285b"], priority: 26,
    qual: [/belaging/, /stelselmatig[^.;]{0,60}persoonlijke levenssfeer/],
    articleHints: [/^Sr:285b$/],
    synonyms: ["belaging", "stalking", "stalken", "lastigvallen"],
  },
  {
    code: "huisvredebreuk", group: "overig", label: "Huisvredebreuk",
    description: "Wederrechtelijk binnendringen of vertoeven in een woning of besloten lokaal (art. 138 Sr).",
    articles: ["Sr:138"], priority: 16,
    qual: [/huisvredebreuk/, /in (?:de |een )?woning[^.;]{0,60}wederrechtelijk (?:binnendringen|vertoeven)/, /wederrechtelijk[^.;]{0,30}(?:binnendringen|vertoeven)/, /lokaalvredebreuk/],
    articleHints: [/^Sr:138$/],
    synonyms: ["huisvredebreuk", "binnendringen", "woning binnengegaan", "lokaalvredebreuk"],
  },
  {
    code: "wapenbezit", group: "overig", label: "Wapenbezit",
    description: "Voorhanden hebben of dragen van wapens/munitie (Wet wapens en munitie).",
    articles: ["WWM:13", "WWM:26", "WWM:27", "WWM:55"], priority: 20,
    qual: [/wet wapens en munitie/, /wapen van categorie/, /munitie/],
    synonyms: ["wapenbezit", "mes op zak", "vuurwapen", "boksbeugel", "stroomstootwapen", "wapen", "taser", "pepperspray"],
  },
  {
    code: "valsheid_in_geschrift", group: "overig", label: "Valsheid in geschrift",
    description: "Valsheid in geschrift en gebruik van valse documenten (art. 225 e.v. Sr).",
    articles: ["Sr:225", "Sr:231"], priority: 20,
    qual: [/valsheid in geschrift/, /vals(?:e|elijk)[^.;]{0,40}(?:opgemaakt|vervalst)/, /(?:valse|vervalste) (?:reis|identiteits)/, /opzettelijk gebruik maken van (?:een )?(?:vals|vervalst)/],
    articleHints: [/^Sr:2(2[5-9]|3[01])$/],
    synonyms: ["valsheid in geschrift", "vervalsing", "vals document", "valse handtekening"],
  },
  {
    code: "cybercrime", group: "overig", label: "Cybercriminaliteit",
    description: "Computervredebreuk, doxing en andere computergerelateerde delicten (art. 138ab, 285d, 350a Sr).",
    articles: ["Sr:138ab", "Sr:285d", "Sr:350a"], priority: 24,
    qual: [/computervredebreuk/, /geautomatiseerd werk/, /persoonsgegevens[^.;]{0,80}(?:verschaffen|verspreiden)/, /doxing/],
    articleHints: [/^Sr:(138ab|285d|350a)$/],
    synonyms: ["hacken", "computervredebreuk", "doxing", "cybercrime", "online"],
  },
  {
    code: "zeden", group: "overig", label: "Relevante zedendelicten",
    description: "Zedendelicten die door de politierechter worden behandeld, zoals schennis van de eerbaarheid en (in beperkte mate) aanranding of seksuele intimidatie.",
    articles: ["Sr:239", "Sr:240", "Sr:240b", "Sr:246", "Sr:429ter"], priority: 26,
    qual: [/schennis/, /aanranding/, /ontuchtig/, /seksuele intimidatie/, /afbeelding van seksuele/, /seksueel (?:getint|karakter)/, /sexting/],
    articleHints: [/^Sr:(239|240b?|246|429ter|139h)$/],
    synonyms: ["schennispleging", "aanranding", "seksuele intimidatie", "zedendelict", "exhibitionisme"],
  },
  {
    code: "economisch", group: "overig", label: "Economische delicten en bijzondere wetten",
    description: "Delicten uit bijzondere wetten, veelal behandeld door de economische politierechter: milieu, dierenwelzijn, arbeidsomstandigheden, vuurwerk, visserij, Wet op de economische delicten.",
    articles: [], priority: 3,
    qual: [/wet (?:op de )?economische delicten|wet milieubeheer|wet dieren|arbeidsomstandigheden|vuurwerkbesluit|visserijwet|flora- en faunawet|wet natuurbescherming|omgevingswet|meststoffenwet|tabaks- en rookwarenwet/],
    synonyms: ["milieudelict", "dierenmishandeling", "vuurwerk", "economisch delict"],
  },
  {
    code: "overig", group: "overig", label: "Overige strafbare feiten",
    description: "Overige feiten die door politierechters worden behandeld (o.a. niet voldoen aan bevel/vordering, overtreding gebieds- of contactverbod).",
    articles: ["Sr:184"], priority: 1,
    qual: [/niet voldoen aan (?:een )?(?:bevel|vordering)/, /opzettelijk niet voldoen/],
    synonyms: ["overig"],
  },
];

export const OFFENSE_BY_CODE = new Map(OFFENSES.map((o) => [o.code, o]));

export function offenseLabel(code: string | null | undefined): string {
  if (!code) return "Onbekend";
  return OFFENSE_BY_CODE.get(code)?.label ?? code;
}
