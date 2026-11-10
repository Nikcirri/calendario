# Calendario

App calendario per Android: tutto quello che serve per organizzare lavoro, studio e famiglia in un posto solo.

- **Viste**: Anno, Mese, Settimana, Giorno e Programma (l'elenco dei prossimi impegni).
- **Eventi e promemoria**: titolo, luogo, orario o tutto il giorno, colore, note, checklist, avvisi con notifica.
- **Ripetizioni**: ogni N giorni, settimane (con i giorni scelti), mesi o anni; per sempre, per un numero di volte o fino a una data.
- **Inserimento rapido**: scrivi "Cena con Marco domani alle 20" e l'evento si crea da solo.
- **Categorie e recap del mese**: ore fatte e programmate per categoria, tetto di ore, tariffa oraria, compenso stimato, grafico per settimana, tabella per Excel.
- **Modelli** di evento, avviso delle sovrapposizioni, ricerca, cestino (30 giorni), festività italiane.
- **Backup** in un file e **aggiornamenti** dentro l'app.

Tutti i dati restano sul telefono.

## Installare l'app

1. Dal telefono apri https://github.com/Nikcirri/calendario/releases/latest
2. In fondo alla pagina, sotto "Assets", tocca il file `Calendario-vX.Y.Z.apk`.
3. Apri il file scaricato. Se Android blocca l'installazione, tocca **Impostazioni**, attiva **Consenti da questa origine** e torna indietro.
4. Tocca **Installa** (se compare Play Protect, **Installa comunque**).

Per aggiornare: l'app avvisa da sola quando c'è una versione nuova. La nuova versione si installa sopra quella vecchia e i dati restano.

## In arrivo

- Widget per la schermata Home (mese, settimana, lista eventi).
- Sincronizzazione con gli account del telefono (Google, Samsung, Microsoft).
- Calendario condiviso fra più persone, con spazi separati e notifiche condivise.

## Per chi sviluppa

- Vite + Svelte 5 + TypeScript + Capacitor 8 (Android). Dati in IndexedDB con Dexie.
- `src/lib/logic`: funzioni pure con i test. `src/lib/services`: notifiche, file, aggiornamenti. `src/views`: schermate.
- `npm run dev` avvia la versione web, `npm run verify` fa controllo dei tipi, test e build, `python3 tests/smoke.py` prova l'app nel browser e fotografa le schermate.
- Quando su `main` cambia la versione in `package.json`, GitHub Actions costruisce l'APK firmato e pubblica la Release (`.github/workflows/release.yml`). A ogni push `.github/workflows/check.yml` fa i controlli e una build Android di prova.
- Regole di lavoro: [`CLAUDE.md`](CLAUDE.md). Novità: [`CHANGELOG.md`](CHANGELOG.md).
