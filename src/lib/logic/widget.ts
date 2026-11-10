// Dati che l'app passa ai widget della schermata Home: gli impegni giorno per giorno, pronti da mostrare.
// I widget li leggono anche ad app chiusa, quindi devono coprire parecchi giorni in avanti.
import type { CalEvent, Category, DateKey } from '../types';
import { addDays, startOfMonth, startOfWeek } from './dates';
import { eventColor } from './model';
import { partsByDay } from './occurrences';

export interface WidgetItem {
  /** Titolo. */
  t: string;
  /** Inizio e fine in minuti da mezzanotte, in quel giorno. */
  s: number;
  e: number;
  /** Colore (#rrggbb). */
  c: string;
  /** 0 = evento con orario, 1 = tutto il giorno, 2 = promemoria. */
  k: 0 | 1 | 2;
}

export interface WidgetSnapshot {
  v: 1;
  /** Primo e ultimo giorno coperti. */
  from: DateKey;
  to: DateKey;
  /** Solo i giorni che hanno almeno un impegno. */
  days: Record<DateKey, WidgetItem[]>;
}

/** Giorni in avanti coperti: se l'app non viene aperta per più tempo, i widget chiedono di riaprirla. */
export const WIDGET_DAYS_AHEAD = 75;
/** Al massimo questi impegni per giorno (i widget ne mostrano comunque pochi). */
export const WIDGET_MAX_PER_DAY = 8;

/**
 * La fotografia per i widget: dalla prima casella del mese di oggi fino a 75 giorni avanti.
 * I promemoria già fatti non compaiono.
 */
export function widgetSnapshot(events: readonly CalEvent[], categories: readonly Category[], today: DateKey): WidgetSnapshot {
  const from = startOfWeek(startOfMonth(today));
  const to = addDays(today, WIDGET_DAYS_AHEAD);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const days: Record<DateKey, WidgetItem[]> = {};
  for (const [day, parts] of partsByDay(events, from, to)) {
    const items: WidgetItem[] = [];
    for (const p of parts) {
      const ev = p.occ.event;
      if (ev.kind === 'reminder' && ev.done.includes(p.occ.date)) continue;
      items.push({
        t: (ev.title || 'Senza titolo').slice(0, 60),
        s: p.start,
        e: p.end,
        c: eventColor(ev, byId),
        k: ev.kind === 'reminder' ? 2 : p.allDay ? 1 : 0,
      });
      if (items.length >= WIDGET_MAX_PER_DAY) break;
    }
    if (items.length) days[day] = items;
  }
  return { v: 1, from, to, days };
}
