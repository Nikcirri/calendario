// Notifiche degli avvisi: programma sul telefono quelle decise da logic/notify.ts.
import { LocalNotifications } from '@capacitor/local-notifications';
import { planAlerts, planSignature } from '../logic/notify';
import { isNative } from '../platform';
import type { CalEvent, DateKey } from '../types';

const CHANNEL_ID = 'avvisi';
let channelReady = false;
/** Firma dell'ultimo elenco programmato: se non cambia non si tocca niente. */
let lastSignature: string | null = null;

async function ensureChannel(): Promise<void> {
  if (channelReady) return;
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Avvisi del calendario',
    description: 'Avvisi di eventi e promemoria',
    importance: 4,
    visibility: 1,
    vibration: true,
  });
  channelReady = true;
}

export type NotificationStatus = 'granted' | 'denied' | 'web';

export async function notificationStatus(): Promise<NotificationStatus> {
  if (!isNative()) return 'web';
  const current = await LocalNotifications.checkPermissions();
  return current.display === 'granted' ? 'granted' : 'denied';
}

/** Chiede il permesso delle notifiche (Android lo chiede una volta sola). true se concesso. */
export async function askNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return true;
  const asked = await LocalNotifications.requestPermissions();
  return asked.display === 'granted';
}

async function cancelPending(): Promise<void> {
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
}

export type SyncResult = 'scheduled' | 'unchanged' | 'off' | 'denied' | 'web';

/**
 * Allinea le notifiche del telefono agli avvisi degli eventi.
 * Si può chiamare spesso: se l'elenco non è cambiato non fa niente.
 */
export async function syncNotifications(events: readonly CalEvent[], enabled: boolean, now: Date = new Date()): Promise<SyncResult> {
  if (!isNative()) return 'web';
  if (!enabled) {
    if (lastSignature !== 'off') {
      await cancelPending();
      lastSignature = 'off';
    }
    return 'off';
  }
  const plan = planAlerts(events, now);
  const signature = planSignature(plan);
  if (signature === lastSignature) return 'unchanged';
  if (plan.length && (await notificationStatus()) !== 'granted') return 'denied';
  await cancelPending();
  if (plan.length) {
    await ensureChannel();
    // Orario esatto solo se Android lo permette: così non si apre mai da sola la schermata delle impostazioni.
    const exact = (await LocalNotifications.checkExactNotificationSetting().catch(() => ({ exact_alarm: 'denied' }))).exact_alarm === 'granted';
    await LocalNotifications.schedule({
      notifications: plan.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        schedule: { at: new Date(a.at), allowWhileIdle: true },
        channelId: CHANNEL_ID,
        isExactNotification: exact,
        extra: { eventId: a.eventId, date: a.date },
      })),
    });
  }
  lastSignature = signature;
  return 'scheduled';
}

/** Dimentica l'ultimo elenco: la prossima sincronizzazione riprogramma tutto. */
export function forgetNotificationPlan(): void {
  lastSignature = null;
}

/** Tocco su una notifica: `handler` riceve l'evento e il giorno da aprire. */
export function onNotificationTap(handler: (eventId: string, date: DateKey) => void): void {
  if (!isNative()) return;
  void LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const extra = action.notification.extra as { eventId?: unknown; date?: unknown } | undefined;
    if (extra && typeof extra.eventId === 'string' && typeof extra.date === 'string') handler(extra.eventId, extra.date);
  });
}
