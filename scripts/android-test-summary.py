#!/usr/bin/env python3
"""Legge i risultati della prova sull'emulatore e li scrive nel riepilogo di GitHub Actions.

Ogni prova fallita diventa anche un "errore" visibile dalla pagina del workflow (e dalle API),
così si capisce cosa non va senza scaricare i log.
"""
import glob
import os
import sys
import xml.etree.ElementTree as ET

files = glob.glob("android/app/build/outputs/androidTest-results/connected/**/*.xml", recursive=True)
total = failed = 0
lines = []
for path in files:
    for case in ET.parse(path).getroot().iter("testcase"):
        total += 1
        problem = case.find("failure")
        if problem is None:
            problem = case.find("error")
        name = case.get("name", "?")
        if problem is None:
            lines.append(f"- ok: {name}")
            continue
        failed += 1
        text = " ".join((problem.get("message") or problem.text or "").split())[:900]
        lines.append(f"- FALLITA: {name}: {text}")
        print(f"::error title=Prova fallita: {name}::{text}")

summary = [f"### Prova dei widget sull'emulatore: {total - failed} riuscite su {total}", *lines]
if not files:
    summary = ["### Prova dei widget sull'emulatore: nessun risultato trovato (la build non è arrivata alle prove)"]
    print("::error title=Nessun risultato::La build non è arrivata a eseguire le prove sull'emulatore.")
with open(os.environ.get("GITHUB_STEP_SUMMARY", "/dev/stdout"), "a", encoding="utf-8") as out:
    out.write("\n".join(summary) + "\n")
print("\n".join(summary))
sys.exit(1 if failed or not files else 0)
