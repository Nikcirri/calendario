// Occorrenze: gli eventi (anche ripetuti e di più giorni) distribuiti sui giorni del calendario.
import type { CalEvent, DateKey } from '../types';
import { addDays, dayNumber, diffDays, toDate } from './dates';
import { occurrenceDates } from './recurrence';

/** Una volta in cui l'evento cade nel calendario. */
export interface Occurrence {
  event: CalEvent;
  /** Giorno di inizio di questa occorrenza. */
  date: DateKey;
  endDate: DateKey;
  /** Identificativo unico: id dell'evento + giorno. */
  key: string;
}

/** Quanti giorni dopo l'inizio finisce l'evento (0 = lo stesso giorno). */
export function spanDays(ev: CalEvent): number {
  return Math.max(0, diffDays(ev.date, ev.endDate));
}

export function makeOccurrence(ev: CalEvent, date: DateKey): Occurrence {
  return { event: ev, date, endDate: addDays(date, spanDays(ev)), key: `${ev.id}@${date}` };
}

/** Le occorrenze di un evento che toccano i giorni tra `from` e `to` (compresi). */
export function expandEvent(ev: CalEvent, from: DateKey, to: DateKey): Occurrence[] {
  const span = spanDays(ev);
  const dates = occurrenceDates(ev.date, ev.repeat, span ? addDays(from, -span) : from, to, ev.exdates);
  return dates.map((date) => ({ event: ev, date, endDate: span ? addDays(date, span) : date, key: `${ev.id}@${date}` }));
}

/** Parte di un'occorrenza in un certo giorno (un evento di più giorni ha una parte per giorno). */
export interface DayPart {
  occ: Occurrence;
  day: DateKey;
  /** Minuti da mezzanotte in quel giorno. */
  start: number;
  end: number;
  /** Occupa tutto il giorno (evento "tutto il giorno" o giorno intermedio di un evento lungo). */
  allDay: boolean;
}

export function dayPart(occ: Occurrence, day: DateKey): DayPart {
  const ev = occ.event;
  if (ev.allDay) return { occ, day, start: 0, end: 1440, allDay: true };
  const start = day === occ.date ? ev.start : 0;
  const end = day === occ.endDate ? ev.end : 1440;
  return { occ, day, start, end, allDay: start === 0 && end === 1440 };
}

export function compareParts(a: DayPart, b: DayPart): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.start !== b.start) return a.start - b.start;
  if (a.end !== b.end) return b.end - a.end;
  return a.occ.event.title.localeCompare(b.occ.event.title, 'it');
}

/**
 * Per ogni giorno tra `from` e `to`, le parti degli eventi di quel giorno, in ordine
 * (prima "tutto il giorno", poi per orario). Gli eventi nel cestino sono esclusi.
 */
export function partsByDay(events: readonly CalEvent[], from: DateKey, to: DateKey): Map<DateKey, DayPart[]> {
  const map = new Map<DateKey, DayPart[]>();
  const first = dayNumber(from);
  const count = dayNumber(to) - first + 1;
  for (let i = 0; i < count; i++) map.set(addDays(from, i), []);
  for (const ev of events) {
    if (ev.deletedAt) continue;
    for (const occ of expandEvent(ev, from, to)) {
      const a = occ.date < from ? from : occ.date;
      const b = occ.endDate > to ? to : occ.endDate;
      const n = diffDays(a, b);
      for (let i = 0; i <= n; i++) {
        const day = i === 0 ? a : addDays(a, i);
        // Un evento che finisce a mezzanotte non occupa il giorno dopo.
        if (!occ.event.allDay && day === occ.endDate && day !== occ.date && occ.event.end === 0) continue;
        map.get(day)?.push(dayPart(occ, day));
      }
    }
  }
  for (const list of map.values()) list.sort(compareParts);
  return map;
}

/** Tutte le occorrenze che iniziano tra `from` e `to`, in ordine di tempo. */
export function occurrencesStarting(events: readonly CalEvent[], from: DateKey, to: DateKey): Occurrence[] {
  const out: Occurrence[] = [];
  for (const ev of events) {
    if (ev.deletedAt) continue;
    for (const date of occurrenceDates(ev.date, ev.repeat, from, to, ev.exdates)) out.push(makeOccurrence(ev, date));
  }
  return out.sort((a, b) => occurrenceStart(a).getTime() - occurrenceStart(b).getTime() || a.event.title.localeCompare(b.event.title, 'it'));
}

/** Momento di inizio di un'occorrenza (gli eventi di tutto il giorno iniziano a mezzanotte). */
export function occurrenceStart(occ: Occurrence): Date {
  return toDate(occ.date, occ.event.allDay ? 0 : occ.event.start);
}

/** Momento di fine (gli eventi di tutto il giorno finiscono alla mezzanotte dopo l'ultimo giorno). */
export function occurrenceEnd(occ: Occurrence): Date {
  return occ.event.allDay ? toDate(addDays(occ.endDate, 1), 0) : toDate(occ.endDate, occ.event.end);
}

/** Durata programmata in minuti (0 per gli eventi di tutto il giorno e i promemoria). */
export function plannedMinutes(ev: CalEvent): number {
  if (ev.allDay || ev.kind === 'reminder') return 0;
  return Math.max(0, spanDays(ev) * 1440 + ev.end - ev.start);
}

/** Durata che conta nel recap: quella confermata/corretta se c'è, altrimenti quella programmata. */
export function countedMinutes(occ: Occurrence): number {
  const actual = occ.event.actual[occ.date];
  return typeof actual === 'number' ? actual : plannedMinutes(occ.event);
}

// ---------- Disposizione nella griglia delle ore ----------

export interface TimedBlock {
  part: DayPart;
  /** Minuti da mezzanotte usati per disegnare (gli eventi brevi hanno un'altezza minima). */
  top: number;
  bottom: number;
  /** Colonna (da 0) e numero di colonne del gruppo di eventi sovrapposti. */
  col: number;
  cols: number;
}

/** Durata minima disegnata, così anche promemoria ed eventi brevi si leggono. */
export const MIN_BLOCK_MINUTES = 30;

/** Dispone gli eventi con orario di un giorno in colonne affiancate quando si sovrappongono. */
export function layoutTimed(parts: readonly DayPart[]): TimedBlock[] {
  const timed = parts
    .filter((p) => !p.allDay)
    .map((part) => {
      const top = Math.min(part.start, 1440 - MIN_BLOCK_MINUTES);
      return { part, top, bottom: Math.max(part.end, top + MIN_BLOCK_MINUTES), col: 0, cols: 1 };
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);
  let group: TimedBlock[] = [];
  let groupEnd = -1;
  const close = () => {
    const cols = group.reduce((m, b) => Math.max(m, b.col + 1), 1);
    for (const b of group) b.cols = cols;
    group = [];
  };
  for (const block of timed) {
    if (group.length && block.top >= groupEnd) close();
    const used = new Set(group.filter((b) => b.bottom > block.top).map((b) => b.col));
    let col = 0;
    while (used.has(col)) col++;
    block.col = col;
    group.push(block);
    groupEnd = Math.max(groupEnd, block.bottom);
  }
  if (group.length) close();
  return timed;
}

// ---------- Sovrapposizioni ----------

function absMinutes(day: DateKey, minutes: number): number {
  return dayNumber(day) * 1440 + minutes;
}

/**
 * Eventi con orario che si sovrappongono alla prima occorrenza di `candidate`
 * (esclusi lui stesso, i promemoria, gli eventi di tutto il giorno e quelli nel cestino).
 */
export function findOverlaps(events: readonly CalEvent[], candidate: CalEvent): Occurrence[] {
  if (candidate.kind !== 'event' || candidate.allDay) return [];
  const cStart = absMinutes(candidate.date, candidate.start);
  const cEnd = absMinutes(candidate.endDate, candidate.end);
  if (cEnd <= cStart) return [];
  const out: Occurrence[] = [];
  for (const ev of events) {
    if (ev.id === candidate.id || ev.deletedAt || ev.kind !== 'event' || ev.allDay) continue;
    for (const occ of expandEvent(ev, candidate.date, candidate.endDate)) {
      const s = absMinutes(occ.date, ev.start);
      const e = absMinutes(occ.endDate, ev.end);
      if (s < cEnd && cStart < e) {
        out.push(occ);
        break;
      }
    }
  }
  return out.sort((a, b) => occurrenceStart(a).getTime() - occurrenceStart(b).getTime());
}

/** Ricerca nel titolo, nel luogo e nelle note (senza badare a maiuscole e accenti). */
export function matchesQuery(ev: CalEvent, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return false;
  return fold(ev.title).includes(q) || fold(ev.location).includes(q) || fold(ev.notes).includes(q);
}

export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
