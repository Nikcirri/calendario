#!/usr/bin/env bash
# Gira dentro l'emulatore di GitHub Actions (workflow "Prova su Android"):
# installa l'app di prova sul telefono finto e fa disegnare i widget con dati di esempio.
# Le immagini dei widget finiscono in android/app/build/outputs/connected_android_test_additional_output/.
# Uso: scripts/android-widget-test.sh [cartella dove salvare la fine del log di Gradle e il registro del telefono]
set -uo pipefail

OUT="${1:-}"
cd "$(dirname "$0")/../android" || exit 1
echo "sdk.dir=$ANDROID_HOME" > local.properties
chmod +x gradlew
if [ -z "$OUT" ]; then
  ./gradlew --no-daemon --console=plain :app:connectedDebugAndroidTest
  exit $?
fi

mkdir -p "$OUT"
adb logcat -c || true
./gradlew --no-daemon --console=plain :app:connectedDebugAndroidTest 2>&1 | tee "$OUT/gradle-completo.log"
STATUS=$?
# Le ultime righe del log bastano per capire un eventuale errore.
tail -n 150 "$OUT/gradle-completo.log" > "$OUT/gradle.log"
rm -f "$OUT/gradle-completo.log"
# Registro del telefono finto: errori dell'app e avvisi di Android sui widget. Se l'app di prova
# si chiude da sola a metà, qui c'è scritto il perché.
adb logcat -d -v brief AndroidRuntime:E RemoteViews:V AppWidgetHostView:V TestRunner:I '*:S' 2>/dev/null | tail -n 300 > "$OUT/logcat.txt" || true
exit $STATUS
