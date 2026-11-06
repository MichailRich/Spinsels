import { describe, it, expect } from "vitest";
import { extractSanctions } from "../src/lib/extract/sanctions";
import { parseDutchNumber } from "../src/lib/extract/numbers";

const run = (t: string, origin: "opgelegd" | "eis_om" = "opgelegd") =>
  extractSanctions(t, 0, { origin }).map((c) => ({ k: c.kind, a: c.amount, c: c.conditional, p: c.probationMonths, s: c.substituteDays }));

describe("telwoorden", () => {
  it("parst samengestelde telwoorden", () => {
    expect(parseDutchNumber("honderdtwintig")).toBe(120);
    expect(parseDutchNumber("vierentwintig")).toBe(24);
    expect(parseDutchNumber("tweehonderdveertig")).toBe(240);
    expect(parseDutchNumber("één")).toBe(1);
  });
});

describe("strafcomponenten", () => {
  it("taakstraf met vervangende hechtenis", () => {
    expect(run("Veroordeelt verdachte tot een taakstraf van 60 (zestig) uren, met bevel, voor het geval dat de veroordeelde de taakstraf niet naar behoren heeft verricht, dat vervangende hechtenis zal worden toegepast van 30 (dertig) dagen.")).toEqual([
      { k: "taakstraf", a: 60, c: false, p: null, s: 30 },
    ]);
  });
  it("voorwaardelijke gevangenisstraf via 'bepaalt dat'", () => {
    expect(run("Veroordeelt de verdachte tot een gevangenisstraf voor de duur van 4 (vier) weken.\nBepaalt dat deze gevangenisstraf niet zal worden tenuitvoergelegd, tenzij de rechter later anders gelast.\nStelt daarbij een proeftijd vast van 2 (twee) jaren.")).toEqual([
      { k: "gevangenisstraf", a: 28, c: true, p: 24, s: null },
    ]);
  });
  it("gedeeltelijk voorwaardelijk", () => {
    expect(run("Veroordeelt verdachte tot een gevangenisstraf voor de duur van 3 maanden. Bepaalt dat een gedeelte van de gevangenisstraf, groot 2 maanden, niet ten uitvoer zal worden gelegd, tenzij de rechter later anders gelast. Stelt een proeftijd vast van 2 jaren.")).toEqual([
      { k: "gevangenisstraf", a: 30, c: false, p: null, s: null },
      { k: "gevangenisstraf", a: 60, c: true, p: 24, s: null },
    ]);
  });
  it("eis met combinatie in één zin", () => {
    expect(run("De officier van justitie heeft gevorderd verdachte te veroordelen tot een taakstraf van 80 uren, subsidiair 40 dagen hechtenis, en een voorwaardelijke gevangenisstraf van 2 weken met een proeftijd van 2 jaren.", "eis_om")).toEqual([
      { k: "taakstraf", a: 80, c: false, p: null, s: 40 },
      { k: "gevangenisstraf", a: 14, c: true, p: 24, s: null },
    ]);
  });
  it("geldboete en ontzegging waarvan voorwaardelijk", () => {
    expect(run("Veroordeelt verdachte tot betaling van een geldboete van € 1.250,00, subsidiair 22 dagen hechtenis. Ontzegt verdachte de bevoegdheid motorrijtuigen te besturen voor de duur van 9 maanden, waarvan 6 maanden voorwaardelijk, met een proeftijd van 2 jaren.")).toEqual([
      { k: "geldboete", a: 1250, c: false, p: null, s: 22 },
      { k: "ontzegging", a: 3, c: false, p: null, s: null },
      { k: "ontzegging", a: 6, c: true, p: 24, s: null },
    ]);
  });
  it("gevangenisstraf waarvan voorwaardelijk", () => {
    expect(run("veroordeelt verdachte tot een gevangenisstraf van 6 maanden, waarvan 4 maanden voorwaardelijk met een proeftijd van 3 jaren")).toEqual([
      { k: "gevangenisstraf", a: 60, c: false, p: null, s: null },
      { k: "gevangenisstraf", a: 120, c: true, p: 36, s: null },
    ]);
  });
  it("negeert tenuitvoerlegging van eerdere straf", () => {
    const r = run("Gelast de tenuitvoerlegging van de voorwaardelijke gevangenisstraf van 2 weken, opgelegd bij vonnis van de politierechter van 1 maart 2022.");
    expect(r.map((x) => x.k)).toEqual(["tul_eerder"]);
  });
  it("taakstraf in woorden", () => {
    expect(run("Veroordeelt verdachte tot een taakstraf voor de duur van honderdtwintig uren")[0].a).toBe(120);
  });
});

describe("regressies uit kwaliteitsmeting", () => {
  it("werkstraf met gedeelte voorwaardelijk via 'bepaalt dat van deze werkstraf'", () => {
    expect(run("Veroordeelt verdachte tot een werkstraf gedurende 80 uren, te vervangen door 40 dagen vervangende hechtenis. De politierechter bepaalt dat van deze werkstraf een gedeelte van 40 uren niet zal worden ten uitvoer gelegd, tenzij de rechter later anders gelast. Stelt een proeftijd van 2 jaren.")).toEqual([
      { k: "taakstraf", a: 40, c: false, p: null, s: 40 },
      { k: "taakstraf", a: 40, c: true, p: 24, s: 40 },
    ]);
  });
  it("gevangenisstraf met 'met bevel dat van deze straf een gedeelte, groot'", () => {
    expect(run("Veroordeelt de verdachte tot een gevangenisstraf voor de duur van 30 [dertig] dagen, met bevel dat van deze straf een gedeelte, groot 17 [zeventien] dagen, niet ten uitvoer zal worden gelegd, tenzij de rechter later anders gelast, met een proeftijd van 2 jaren.").map((x) => [x.k, x.a, x.c])).toEqual([
      ["gevangenisstraf", 13, false], ["gevangenisstraf", 17, true],
    ]);
  });
  it("geldboete met gedeelte voorwaardelijk in volgende zin", () => {
    expect(run("Geldboete van € 2.000,00 (tweeduizend euro). Met bevel dat van de geldboete van € 2.000,- (tweeduizend euro) een gedeelte, groot € 1.000,-, niet ten uitvoer zal worden gelegd.").map((x) => [x.k, x.a, x.c])).toEqual([
      ["geldboete", 1000, false], ["geldboete", 1000, true],
    ]);
  });
  it("gijzeling-zin is geen maatregel", () => {
    expect(run("De toepassing van deze gijzeling heft de hiervoor opgelegde betalingsverplichting niet op.")).toEqual([]);
  });
});

describe("eis met aftrek voorarrest", () => {
  it("telt werkstraf met aftrek voorarrest mee", () => {
    expect(run("- een werkstraf van 150 uur subsidiair 75 dagen hechtenis, met aftrek van voorarrest;", "eis_om").map((x) => [x.k, x.a])).toEqual([["taakstraf", 150]]);
  });
});
