// Avvisi: decide quali notifiche programmare (la parte che parla con Android è in services/notifications.ts).
import type { CalEvent, DateKey } from '../types';
import { addDays, diffDays, fmtDayShort, fmtTime, parseKey, toDate, todayKey } from './dates';
import { expandEvent } from './occurrences';

export interface PlannedAlert {
  /** Numero della notifica per Android (sempre lo stesso per lo stesso evento, giorno e avviso). */
  id: number;
  /** Quando mostrarla (millisecondi). */
  at: number;
  title: string;
  body: string;
  eventId: string;
  date: DateKey;
}

/** Android accetta un numero limitato di sveglie per app: si programmano solo le più vicine. */
export const MAX_ALERTS = 120;
export const HORIZON_DAYS = 60;

/** Numero positivo a 31 bit ricavato da un testo (per l'id della notifica). */
export function hashId(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 1) || 1) | 0;
}

function whenText(ev: CalEvent, date: DateKey, endDate: DateKey, alertDay: DateKey): string {
  const diff = diffDays(alertDay, date);
  const day = diff === 0 ? 'Oggi' : diff === 1 ? 'Domani' : capitalizeFirst(fmtDayShort(date, parseKey(alertDay).y));
  if (ev.allDay) return endDate !== date ? `${day}, più giorni` : `${day}, tutto il giorno`;
  if (ev.kind === 'reminder') return `${day} alle ${fmtTime(ev.start)}`;
  return `${day}, ${fmtTime(ev.start)} – ${fmtTime(ev.end)}`;
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Le prossime notifiche da programmare, in ordine di tempo.
 * Saltano: eventi nel cestino, promemoria già fatti, avvisi il cui momento è già passato.
 */
export function planAlerts(
  events: readonly CalEvent[],
  now: Date,
  opts: { horizonDays?: number; max?: number } = {},
): PlannedAlert[] {
  const horizon = opts.horizonDays ?? HORIZON_DAYS;
  const max = opts.max ?? MAX_ALERTS;
  const today = todayKey(now);
  const nowMs = now.getTime();
  const limitMs = toDate(addDays(today, horizon + 1), 0).getTime();
  const out: PlannedAlert[] = [];
  for (const ev of events) {
    if (ev.deletedAt || !ev.alerts.length) continue;
    // Un avviso può arrivare fino a 4 settimane prima: si guardano anche le occorrenze oltre l'orizzonte.
    const maxLead = Math.max(0, ...ev.alerts);
    const to = addDays(today, horizon + Math.ceil(maxLead / 1440));
    for (const occ of expandEvent(ev, today, to)) {
      if (ev.kind === 'reminder' && ev.done.includes(occ.date)) continue;
      const startMs = toDate(occ.date, ev.allDay ? 0 : ev.start).getTime();
      for (const lead of ev.alerts) {
        const at = startMs - lead * 60_000;
        if (at <= nowMs + 5_000 || at >= limitMs) continue;
        const title = ev.title.trim() || (ev.kind === 'reminder' ? 'Promemoria' : 'Evento');
        const where = ev.location.trim();
        const when = whenText(ev, occ.date, occ.endDate, todayKey(new Date(at)));
        out.push({
          id: hashId(`${ev.id}|${occ.date}|${lead}`),
          at,
          title,
          body: where ? `${when} · ${where}` : when,
          eventId: ev.id,
          date: occ.date,
        });
      }
    }
  }
  out.sort((a, b) => a.at - b.at || a.id - b.id);
  // Due avvisi diversi non devono mai avere lo stesso numero: se capita, il secondo si salta.
  const seen = new Set<number>();
  const unique = out.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
  return unique.slice(0, max);
}

/** Firma dell'elenco: se non cambia, non serve riprogrammare le notifiche. */
export function planSignature(plan: readonly PlannedAlert[]): string {
  return plan.map((a) => `${a.id}:${a.at}:${a.title}:${a.body}`).join('|');
}
