// Tiene le notifiche del telefono allineate agli avvisi: a ogni modifica degli eventi e al cambio del giorno.
import { reportError } from './errors';
import { syncNotifications } from './services/notifications';
import { app, data } from './state/app.svelte';

/** Va chiamata una volta, durante la creazione dell'app. */
export function useNotificationSync(): void {
  $effect(() => {
    if (!app.ready) return;
    const events = data.events;
    const enabled = app.settings.notifications;
    // Il giorno è tra le dipendenze: a mezzanotte l'elenco si ricalcola.
    void app.today;
    const timer = setTimeout(() => {
      syncNotifications(events, enabled).catch((e: unknown) => reportError(e, 'Non riesco a programmare le notifiche.'));
    }, 1200);
    return () => clearTimeout(timer);
  });
}
