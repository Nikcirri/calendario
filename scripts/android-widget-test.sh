#!/usr/bin/env bash
# Gira dentro l'emulatore di GitHub Actions (workflow "Prova su Android"):
# installa l'app di prova sul telefono finto e fa disegnare i tre widget con dati di esempio.
# Le immagini dei widget finiscono in android/app/build/outputs/connected_android_test_additional_output/.
set -euo pipefail

cd "$(dirname "$0")/../android"
echo "sdk.dir=$ANDROID_HOME" > local.properties
chmod +x gradlew
./gradlew --no-daemon --console=plain connectedDebugAndroidTest
