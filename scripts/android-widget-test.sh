#!/usr/bin/env bash
# Gira dentro l'emulatore di GitHub Actions (workflow "Prova su Android"):
# installa l'app di prova sul telefono finto e fa disegnare i tre widget con dati di esempio.
# Le immagini dei widget finiscono in android/app/build/outputs/connected_android_test_additional_output/.
# Uso: scripts/android-widget-test.sh [cartella dove salvare la fine del log di Gradle]
set -euo pipefail

OUT="${1:-}"
cd "$(dirname "$0")/../android"
echo "sdk.dir=$ANDROID_HOME" > local.properties
chmod +x gradlew
if [ -n "$OUT" ]; then
  mkdir -p "$OUT"
  # Le ultime righe del log bastano per capire un eventuale errore.
  ./gradlew --no-daemon --console=plain :app:connectedDebugAndroidTest 2>&1 | tee "$OUT/gradle-completo.log"
  tail -n 150 "$OUT/gradle-completo.log" > "$OUT/gradle.log"
  rm -f "$OUT/gradle-completo.log"
else
  ./gradlew --no-daemon --console=plain :app:connectedDebugAndroidTest
fi
