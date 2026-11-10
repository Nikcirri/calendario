#!/usr/bin/env bash
# Controlla l'APK finito (dopo la build Android, in GitHub Actions):
#  - i permessi devono essere solo quelli previsti (se una libreria ne aggiunge uno, la build si ferma);
#  - scrive la dimensione dell'APK e delle parti più pesanti nel riepilogo della build.
# Uso: scripts/check-apk.sh percorso/app.apk
set -euo pipefail

APK="$1"
# Permessi previsti: internet (aggiornamenti), installazione aggiornamenti, notifiche e avvisi puntuali, vibrazione.
ALLOWED="INTERNET REQUEST_INSTALL_PACKAGES POST_NOTIFICATIONS RECEIVE_BOOT_COMPLETED WAKE_LOCK SCHEDULE_EXACT_ALARM USE_EXACT_ALARM VIBRATE"

BUILD_TOOLS=$(ls -d "$ANDROID_HOME"/build-tools/*/ | sort -V | tail -n 1)
AAPT2="${BUILD_TOOLS}aapt2"

PERMS=$("$AAPT2" dump permissions "$APK")
ANDROID_PERMS=$(grep -o "android.permission.[A-Za-z0-9_.]*" <<< "$PERMS" | sed 's/android.permission.//' | sort -u || true)

BAD=""
for p in $ANDROID_PERMS; do
  if [[ " $ALLOWED " != *" $p "* ]]; then BAD="$BAD $p"; fi
done

SIZE=$(du -k "$APK" | cut -f1)
{
  echo "### APK"
  echo "- Dimensione: $((SIZE / 1024)) MB ($SIZE KB)"
  echo "- Permessi: $(echo $ANDROID_PERMS)"
  echo ""
  echo "Parti più pesanti:"
  echo '```'
  # awk legge tutto (con "head" sort si interromperebbe con un errore).
  unzip -l "$APK" | sort -k1 -n -r | awk 'NR <= 12'
  echo '```'
} >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"

if [ -n "$BAD" ]; then
  echo "::error title=Permessi non previsti::$BAD (se servono davvero, aggiungili all'elenco in scripts/check-apk.sh)"
  exit 1
fi
echo "APK controllato: $((SIZE / 1024)) MB, permessi: $(echo $ANDROID_PERMS)"
