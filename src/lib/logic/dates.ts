// Date e orari. I giorni sono stringhe 'AAAA-MM-GG' (senza fusi orari), gli orari minuti da mezzanotte.
import type { DateKey } from '../types';

export const MONTHS = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
] as const;
export const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'] as const;
/** Indice 0 = lunedì. */
export const WEEKDAYS = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'] as const;
export const WEEKDAYS_SHORT = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'] as const;
export const WEEKDAYS_LETTER = ['L', 'M', 'M', 'G', 'V', 'S', 'D'] as const;

const DAY_MS = 86_400_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function toKey(y: number, m: number, d: number): DateKey {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseKey(key: DateKey): { y: number; m: number; d: number } {
  return { y: Number(key.slice(0, 4)), m: Number(key.slice(5, 7)), d: Number(key.slice(8, 10)) };
}

export function isDateKey(v: unknown): v is DateKey {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const { y, m, d } = parseKey(v);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** Numero del giorno (giorni dal 1970): serve per fare i conti tra date. */
export function dayNumber(key: DateKey): number {
  const { y, m, d } = parseKey(key);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function keyFromDayNumber(n: number): DateKey {
  const dt = new Date(n * DAY_MS);
  return toKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(key: DateKey, n: number): DateKey {
  return keyFromDayNumber(dayNumber(key) + n);
}

/** Giorni da `a` a `b` (positivo se `b` viene dopo). */
export function diffDays(a: DateKey, b: DateKey): number {
  return dayNumber(b) - dayNumber(a);
}

/** Giorno della settimana: 1 = lunedì … 7 = domenica. */
export function weekday(key: DateKey): number {
  // Il giorno 0 (1 gennaio 1970) era giovedì.
  return ((((dayNumber(key) + 3) % 7) + 7) % 7) + 1;
}

export function startOfWeek(key: DateKey): DateKey {
  return addDays(key, 1 - weekday(key));
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function startOfMonth(key: DateKey): DateKey {
  const { y, m } = parseKey(key);
  return toKey(y, m, 1);
}

export function endOfMonth(key: DateKey): DateKey {
  const { y, m } = parseKey(key);
  return toKey(y, m, daysInMonth(y, m));
}

/** Sposta di `n` mesi; se il giorno non esiste nel mese di arrivo usa l'ultimo (31 gennaio → 28 febbraio). */
export function addMonths(key: DateKey, n: number): DateKey {
  const { y, m, d } = parseKey(key);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toKey(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

/** I 42 giorni (6 settimane da lunedì) della griglia del mese che contiene `key`. */
export function monthGrid(key: DateKey): DateKey[] {
  const first = startOfWeek(startOfMonth(key));
  const base = dayNumber(first);
  return Array.from({ length: 42 }, (_, i) => keyFromDayNumber(base + i));
}

export function weekDays(key: DateKey): DateKey[] {
  const base = dayNumber(startOfWeek(key));
  return Array.from({ length: 7 }, (_, i) => keyFromDayNumber(base + i));
}

/** Il giorno di oggi secondo l'orologio del telefono. */
export function todayKey(now: Date = new Date()): DateKey {
  return toKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function minutesOfDay(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** Momento reale (orologio del telefono) di un giorno e un orario. */
export function toDate(key: DateKey, minutes = 0): Date {
  const { y, m, d } = parseKey(key);
  return new Date(y, m - 1, d, 0, minutes, 0, 0);
}

/** 510 → "08:30". */
export function fmtTime(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** "08:30" → 510 (null se non valido). */
export function parseTime(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h <= 23 && mi <= 59 ? h * 60 + mi : null;
}

/** 375 → "6 h 15 min", 360 → "6 h", 45 → "45 min". */
export function fmtDuration(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Ore con al massimo una cifra decimale: 375 → "6,3". */
export function fmtHours(min: number): string {
  const h = Math.round((min / 60) * 10) / 10;
  return String(h).replace('.', ',');
}

/** "martedì 10 novembre" (con l'anno se diverso da `refYear`). */
export function fmtDayLong(key: DateKey, refYear?: number): string {
  const { y, m, d } = parseKey(key);
  const base = `${WEEKDAYS[weekday(key) - 1]} ${d} ${MONTHS[m - 1]}`;
  return refYear !== undefined && refYear !== y ? `${base} ${y}` : base;
}

/** "mar 10 nov" (con l'anno se diverso da `refYear`). */
export function fmtDayShort(key: DateKey, refYear?: number): string {
  const { y, m, d } = parseKey(key);
  const base = `${WEEKDAYS_SHORT[weekday(key) - 1]} ${d} ${MONTHS_SHORT[m - 1]}`;
  return refYear !== undefined && refYear !== y ? `${base} ${y}` : base;
}

/** "Novembre 2026". */
export function fmtMonthYear(key: DateKey): string {
  const { y, m } = parseKey(key);
  return `${capitalize(MONTHS[m - 1]!)} ${y}`;
}

export function monthName(key: DateKey): string {
  return capitalize(MONTHS[parseKey(key).m - 1]!);
}

/** "oggi", "domani", "ieri" oppure "mar 10 nov". */
export function fmtRelativeDay(key: DateKey, today: DateKey): string {
  const diff = diffDays(today, key);
  if (diff === 0) return 'oggi';
  if (diff === 1) return 'domani';
  if (diff === -1) return 'ieri';
  return fmtDayShort(key, parseKey(today).y);
}

/** Il giorno `n`-esimo (1 = primo … 5 o più = ultimo) con quel giorno della settimana nel mese. */
export function nthWeekdayOfMonth(y: number, m: number, wd: number, n: number): DateKey {
  const first = toKey(y, m, 1);
  const offset = (wd - weekday(first) + 7) % 7;
  const days = daysInMonth(y, m);
  let d = 1 + offset + (Math.min(n, 5) - 1) * 7;
  while (d > days) d -= 7;
  return toKey(y, m, d);
}

/** Quale occorrenza del suo giorno della settimana è nel mese: il 10 novembre 2026 è il 2° martedì → 2. */
export function weekdayOrdinal(key: DateKey): number {
  return Math.ceil(parseKey(key).d / 7);
}

/** È l'ultima occorrenza di quel giorno della settimana nel mese? */
export function isLastWeekdayOfMonth(key: DateKey): boolean {
  const { y, m, d } = parseKey(key);
  return d + 7 > daysInMonth(y, m);
}
