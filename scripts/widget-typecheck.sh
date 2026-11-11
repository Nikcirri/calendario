#!/usr/bin/env bash
# Controllo veloce dei tipi del codice Java dei widget (e delle loro prove) con javac, senza costruire l'app.
# Serve dove l'SDK di Android non c'è: basta il file android.jar di una versione recente di Android
# (per esempio quello della cartella android-34 del repository pubblico Sable/android-platforms).
# Non sostituisce la build vera né la prova sull'emulatore: trova solo gli errori di scrittura.
# Uso: scripts/widget-typecheck.sh /percorso/di/android.jar
set -euo pipefail

JAR="${1:?Indica il percorso di android.jar}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Finti R, MainActivity e librerie di prova: solo i nomi che servono a javac.
python3 "$REPO/scripts/widget-typecheck-stubs.py" "$REPO" "$TMP/stubs"
W="$REPO/android/app/src/main/java/com/nikcirri/calendario/widgets"
T="$REPO/android/app/src/androidTest/java/com/nikcirri/calendario/widgets"
# WidgetsPlugin usa Capacitor, che qui non c'è: resta fuori dal controllo.
D="$REPO/android/app/src/debug/java/com/nikcirri/calendario/widgets"
mapfile -t FILES < <(ls "$W"/*.java | grep -v WidgetsPlugin.java; ls "$D"/*.java "$T"/*.java; find "$TMP/stubs" -name '*.java')
mkdir -p "$TMP/out"
javac -proc:none --release 17 -cp "$JAR" -d "$TMP/out" "${FILES[@]}"
echo "Tipi a posto"
