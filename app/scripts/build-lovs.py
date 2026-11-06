#!/usr/bin/env python3
"""Bouwt data/lovs.json met LETTERLIJKE fragmenten uit het officiële document
'Oriëntatiepunten voor straftoemeting en LOVS-afspraken' (Rechtspraak), inclusief
paginanummer. Getallen worden niet overgetypt: de tekst wordt ongewijzigd overgenomen.
Gebruik: python3 scripts/build-lovs.py <pad/naar/lovs.pdf>   (vereist pdftotext)"""
import json, re, subprocess, sys, hashlib

pdf = sys.argv[1]
raw = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, check=True).stdout.decode("utf-8")
pages = raw.split("\f")
lines = []  # (page, text)
for i, p in enumerate(pages, start=1):
    for l in p.split("\n"):
        lines.append((i, l.rstrip()))

version = re.search(r"Bijgewerkt:\s*([^\n]+)", raw)
SECTIONS = {
  "openlijke_geweldpleging": r"^\s*Art\. 141 Sr\s+openlijke geweldpleging",
  "belediging": r"^\s*Art\. 266 Sr\s+belediging",
  "bedreiging": r"^\s*Art\. 285 Sr\s+bedreiging",
  "mishandeling": r"^\s*Art\. 300 Sr\s+eenvoudige mishandeling",
  "zware_mishandeling": r"^\s*Art\. 302 Sr\s+zware mishandeling",
  "winkeldiefstal": r"^\s*Art\. 310-312 Sr\s+winkeldiefstal",
  "diefstal_braak": r"^\s*Art\. 310-311 Sr\s+inbraak",
  "verkeersongeval_letsel": r"^\s*Art\. 6 WVW",
  "rijden_onder_invloed_alcohol": r"^\s*Art\. 8 WVW1994 rijden onder invloed auto",
  "rijden_onder_invloed_drugs": r"^\s*Art\. 8 WVW 1994 rijden onder invloed auto",
  "rijden_tijdens_ontzegging": r"^\s*Art\. 9 lid 1 WVW",
  "rijden_zonder_rijbewijs": r"^\s*Art\. 9 lid 2 WVW",
  "weigeren_blaastest": r"^\s*Art\. 163 WVW",
  "bezit_harddrugs": r"^\s*Art\. 2 onder C Opiumwet",
  "drugshandel": r"^\s*Art\. 2 onder B Opiumwet",
  "hennepteelt": r"^\s*Art\. 3 onder B Opiumwet",
  "bezit_softdrugs": r"^\s*Art\. 3 onder C Opiumwet",
  "wapenbezit": r"^\s*Art\. 27/31 WWM",
  "fraude": r"^\s*Fraude\s*$",
  "_recidive": r"^\s*Recidive\s*$",
  "_omstandigheden": r"^\s*Strafverzwarende en strafmatigende omstandigheden\s*$",
}
HEAD = re.compile(r"^\s*(Art\. |Wegenverkeerswet|Opiumwet\s*$|Wet [Ww]apens|Fraude\s*$|LOVS-afspraken|Deelneming|Strafverzwarende en|Recidive\s*$|Meerdaadse|Oriëntatiepunten (voor )?straftoemeting jeugd|Overzicht)")
start_body = next(i for i, (_, l) in enumerate(lines) if "Naast oriëntatiepunten voor specifieke delicten" in l) - 40
out = {"source": "Oriëntatiepunten voor straftoemeting en LOVS-afspraken (Landelijk Overleg Vakinhoud Strafrecht)",
       "url": "https://www.rechtspraak.nl/SiteCollectionDocuments/Orientatiepunten-en-afspraken-LOVS.pdf",
       "version": version.group(1).strip() if version else None,
       "sha256": hashlib.sha256(open(pdf, "rb").read()).hexdigest(), "sections": {}}
for key, pat in SECTIONS.items():
    rx = re.compile(pat)
    idx = next((i for i in range(start_body, len(lines)) if rx.search(lines[i][1])), None)
    if idx is None:
        print("niet gevonden:", key); continue
    body = [lines[idx]]
    for j in range(idx + 1, min(idx + 160, len(lines))):
        t = lines[j][1]
        if HEAD.search(t) and j > idx + 1:
            break
        if "< terug naar overzicht" in t:
            continue
        body.append(lines[j])
    text = "\n".join(l for _, l in body).strip("\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    out["sections"][key] = {"heading": lines[idx][1].strip(), "page": lines[idx][0], "text": text}
    print(key, "p.", lines[idx][0], len(text))
json.dump(out, open("data/lovs.json", "w"), ensure_ascii=False, indent=1)
