// Tiene aggiornati i widget della schermata Home: a ogni modifica degli impegni (e al cambio del giorno)
// l'app passa ad Android la fotografia nuova. I widget poi la mostrano anche ad app chiusa.
import { widgetSnapshot } from './logic/widget';
import { isNative } from './platform';
import { pushWidgetSnapshot } from './services/widgets';
import { app, data } from './state/app.svelte';

/** Va chiamata una volta, durante la creazione dell'app. Fuori dall'app Android non fa niente. */
export function useWidgetSync(): void {
  if (!isNative()) return;
  let last = '';
  $effect(() => {
    if (!app.ready) return;
    // I widget mostrano quello che si vede nel calendario: le categorie nascoste restano fuori.
    const snapshot = widgetSnapshot(data.visible, data.categories, app.today);
    const timer = setTimeout(() => {
      const key = JSON.stringify(snapshot);
      if (key === last) return;
      last = key;
      pushWidgetSnapshot(snapshot).catch(() => {
        // I widget sono un extra: se l'invio non riesce si riprova alla prossima modifica.
        last = '';
      });
    }, 800);
    return () => clearTimeout(timer);
  });
}
