// Ripetizioni: calcola in quali giorni cade un evento che si ripete.
import type { DateKey, Repeat, RepeatFreq } from '../types';
import {
  MONTHS,
  WEEKDAYS,
  WEEKDAYS_SHORT,
  addDays,
  dayNumber,
  daysInMonth,
  diffDays,
  fmtDayShort,
  keyFromDayNumber,
  nthWeekdayOfMonth,
  parseKey,
  startOfWeek,
  toKey,
  weekday,
  weekdayOrdinal,
} from './dates';

/** Limite di sicurezza: nessuna serie viene calcolata oltre questo numero di periodi. */
const MAX_PERIODS = 20_000;
export const MAX_COUNT = 999;

/** Ripetizione nuova, già coerente con il giorno di inizio. */
export function defaultRepeat(freq: RepeatFreq, start: DateKey): Repeat {
  const { m, d } = parseKey(start);
  return {
    freq,
    interval: 1,
    weekdays: [weekday(start)],
    monthMode: 'day',
    monthDays: [d],
    yearMode: 'date',
    yearMonths: [m],
    end: { type: 'never' },
  };
}

function uniqueSorted(list: number[], min: number, max: number): number[] {
  return [...new Set(list.filter((n) => Number.isInteger(n) && n >= min && n <= max))].sort((a, b) => a - b);
}

/**
 * Sistema una ripetizione perché sia sempre valida e comprenda il giorno di inizio
 * (es. se l'evento inizia di martedì, il martedì resta tra i giorni scelti).
 */
export function normalizeRepeat(repeat: Repeat, start: DateKey): Repeat {
  const { m, d } = parseKey(start);
  const interval = Math.min(99, Math.max(1, Math.round(repeat.interval) || 1));
  const weekdays = uniqueSorted([...repeat.weekdays, weekday(start)], 1, 7);
  const monthDays = uniqueSorted([...repeat.monthDays, d], 1, 31);
  const yearMonths = uniqueSorted([...repeat.yearMonths, m], 1, 12);
  let end = repeat.end;
  if (end.type === 'count') end = { type: 'count', count: Math.min(MAX_COUNT, Math.max(1, Math.round(end.count) || 1)) };
  else if (end.type === 'until' && end.date < start) end = { type: 'until', date: start };
  return { ...repeat, interval, weekdays, monthDays, yearMonths, end };
}

/** Il giorno n-esimo (o ultimo) con lo stesso giorno della settimana di `start`, nel mese dato. */
function sameWeekdaySlot(start: DateKey, y: number, m: number): DateKey {
  // Il 5° (quando c'è) vale come "ultimo": nei mesi che ne hanno solo 4 si usa il quarto.
  return nthWeekdayOfMonth(y, m, weekday(start), weekdayOrdinal(start));
}

/** I giorni del periodo numero `p` (0 = quello che contiene l'inizio), in ordine. */
function periodDates(start: DateKey, repeat: Repeat, p: number): DateKey[] {
  const s = parseKey(start);
  const step = p * repeat.interval;
  switch (repeat.freq) {
    case 'day':
      return [addDays(start, step)];
    case 'week': {
      const monday = dayNumber(startOfWeek(start)) + step * 7;
      const days = repeat.weekdays.length ? repeat.weekdays : [weekday(start)];
      return days.map((wd) => keyFromDayNumber(monday + wd - 1));
    }
    case 'month': {
      const total = s.y * 12 + (s.m - 1) + step;
      const y = Math.floor(total / 12);
      const m = (total % 12) + 1;
      const last = daysInMonth(y, m);
      if (repeat.monthMode === 'weekday') return [sameWeekdaySlot(start, y, m)];
      if (repeat.monthMode === 'dates') {
        const days = repeat.monthDays.length ? repeat.monthDays : [s.d];
        return days.filter((d) => d <= last).map((d) => toKey(y, m, d));
      }
      return s.d <= last ? [toKey(y, m, s.d)] : [];
    }
    case 'year': {
      const y = s.y + step;
      if (repeat.yearMode === 'weekday') return [sameWeekdaySlot(start, y, s.m)];
      if (repeat.yearMode === 'months') {
        const months = repeat.yearMonths.length ? repeat.yearMonths : [s.m];
        return months.filter((m) => s.d <= daysInMonth(y, m)).map((m) => toKey(y, m, s.d));
      }
      return s.d <= daysInMonth(y, s.m) ? [toKey(y, s.m, s.d)] : [];
    }
  }
}

/** Primo periodo che può contenere giorni da `from` in poi (per non partire sempre dall'inizio). */
function firstPeriod(start: DateKey, repeat: Repeat, from: DateKey): number {
  if (from <= start) return 0;
  const s = parseKey(start);
  const f = parseKey(from);
  let periods: number;
  switch (repeat.freq) {
    case 'day':
      periods = diffDays(start, from) / repeat.interval;
      break;
    case 'week':
      periods = diffDays(startOfWeek(start), from) / (7 * repeat.interval);
      break;
    case 'month':
      periods = (f.y * 12 + f.m - (s.y * 12 + s.m)) / repeat.interval;
      break;
    case 'year':
      periods = (f.y - s.y) / repeat.interval;
      break;
  }
  return Math.max(0, Math.floor(periods) - 1);
}

/**
 * I giorni in cui cade l'evento tra `from` e `to` (compresi), in ordine.
 * Senza ripetizione restituisce solo il giorno di inizio, se è nell'intervallo.
 * I giorni in `exdates` (occorrenze eliminate) vengono saltati, ma contano nel "numero di volte".
 */
export function occurrenceDates(
  start: DateKey,
  repeat: Repeat | null,
  from: DateKey,
  to: DateKey,
  exdates: readonly DateKey[] = [],
): DateKey[] {
  if (to < from) return [];
  if (!repeat) return start >= from && start <= to && !exdates.includes(start) ? [start] : [];
  const until = repeat.end.type === 'until' ? repeat.end.date : null;
  const limit = repeat.end.type === 'count' ? repeat.end.count : Infinity;
  const last = until && until < to ? until : to;
  if (last < start) return [];
  const skip = exdates.length ? new Set(exdates) : null;
  const out: DateKey[] = [];
  let produced = 0;
  // Con "numero di volte" bisogna contare dall'inizio; altrimenti si salta vicino a `from`.
  let p = limit === Infinity ? firstPeriod(start, repeat, from) : 0;
  for (let guard = 0; guard < MAX_PERIODS; guard++, p++) {
    const dates = periodDates(start, repeat, p);
    let beyond = dates.length === 0 ? false : true;
    for (const date of dates) {
      if (date < start) {
        beyond = false;
        continue;
      }
      if (date > last) continue;
      beyond = false;
      produced++;
      if (produced > limit) return out;
      if (date >= from && !(skip && skip.has(date))) out.push(date);
    }
    if (produced >= limit) return out;
    if (beyond) return out;
    // Periodo vuoto (es. il 31 in un mese di 30 giorni): si controlla che non si sia già oltre la fine.
    if (dates.length === 0 && periodStart(start, repeat, p) > last) return out;
  }
  return out;
}

/** Primo giorno del periodo `p` (serve solo per capire quando fermarsi nei periodi vuoti). */
function periodStart(start: DateKey, repeat: Repeat, p: number): DateKey {
  const s = parseKey(start);
  const step = p * repeat.interval;
  if (repeat.freq === 'day') return addDays(start, step);
  if (repeat.freq === 'week') return addDays(startOfWeek(start), step * 7);
  if (repeat.freq === 'month') {
    const total = s.y * 12 + (s.m - 1) + step;
    return toKey(Math.floor(total / 12), (total % 12) + 1, 1);
  }
  return toKey(s.y + step, 1, 1);
}

/** La prima occorrenza da `from` in poi (null se la serie è finita). Cerca fino a 12 anni avanti. */
export function nextOccurrenceDate(
  start: DateKey,
  repeat: Repeat | null,
  from: DateKey,
  exdates: readonly DateKey[] = [],
): DateKey | null {
  if (!repeat) return start >= from && !exdates.includes(start) ? start : null;
  let cursor = from < start ? start : from;
  // Finestre sempre più larghe: quasi sempre basta la prima.
  for (const span of [62, 400, 4400]) {
    const found = occurrenceDates(start, repeat, cursor, addDays(cursor, span), exdates);
    if (found.length) return found[0]!;
    cursor = addDays(cursor, span + 1);
  }
  return null;
}

// ---------- Testi ----------

const ORDINALS = ['1°', '2°', '3°', '4°', 'ultimo'];

/** "2° martedì" oppure "ultimo venerdì". */
export function weekdaySlotLabel(start: DateKey): string {
  const n = weekdayOrdinal(start);
  const wd = WEEKDAYS[weekday(start) - 1]!;
  if (n === 5) return wd === 'domenica' ? 'ultima domenica' : `ultimo ${wd}`;
  return `${ORDINALS[n - 1]} ${wd}`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** Descrizione breve per l'elenco dei campi: "Ogni settimana, lun e mer" … */
export function repeatSummary(repeat: Repeat | null, start: DateKey): string {
  if (!repeat) return 'Non ripetere';
  const n = repeat.interval;
  const s = parseKey(start);
  let text: string;
  switch (repeat.freq) {
    case 'day':
      text = n === 1 ? 'Ogni giorno' : `Ogni ${n} giorni`;
      break;
    case 'week': {
      const base = n === 1 ? 'Ogni settimana' : `Ogni ${n} settimane`;
      const days = repeat.weekdays.length ? repeat.weekdays : [weekday(start)];
      text = days.length === 7 && n === 1 ? 'Ogni giorno' : `${base}, ${joinList(days.map((d) => WEEKDAYS_SHORT[d - 1]!))}`;
      break;
    }
    case 'month': {
      const base = n === 1 ? 'Ogni mese' : `Ogni ${n} mesi`;
      if (repeat.monthMode === 'weekday') text = `${base}, ${weekdaySlotLabel(start)}`;
      else if (repeat.monthMode === 'dates') text = `${base}, il ${joinList((repeat.monthDays.length ? repeat.monthDays : [s.d]).map(String))}`;
      else text = `${base}, il ${s.d}`;
      break;
    }
    case 'year': {
      const base = n === 1 ? 'Ogni anno' : `Ogni ${n} anni`;
      if (repeat.yearMode === 'weekday') text = `${base}, ${weekdaySlotLabel(start)} di ${MONTHS[s.m - 1]}`;
      else if (repeat.yearMode === 'months') {
        text = `${base}, il ${s.d} di ${joinList((repeat.yearMonths.length ? repeat.yearMonths : [s.m]).map((m) => MONTHS[m - 1]!))}`;
      } else text = `${base}, il ${s.d} ${MONTHS[s.m - 1]}`;
      break;
    }
  }
  if (repeat.end.type === 'count') text += repeat.end.count === 1 ? ', 1 volta' : `, ${repeat.end.count} volte`;
  else if (repeat.end.type === 'until') text += `, fino al ${fmtDayShort(repeat.end.date).replace(/^\S+ /, '')} ${parseKey(repeat.end.date).y}`;
  return text;
}
