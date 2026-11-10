// Festività nazionali italiane (giorni festivi per legge).
import type { DateKey } from '../types';
import { addDays, parseKey, toKey } from './dates';

/** Domenica di Pasqua (calendario gregoriano). */
export function easterSunday(year: number): DateKey {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toKey(year, month, day);
}

const cache = new Map<number, Map<DateKey, string>>();

export function holidaysOfYear(year: number): Map<DateKey, string> {
  const known = cache.get(year);
  if (known) return known;
  const easter = easterSunday(year);
  const list: [DateKey, string][] = [
    [toKey(year, 1, 1), 'Capodanno'],
    [toKey(year, 1, 6), 'Epifania'],
    [easter, 'Pasqua'],
    [addDays(easter, 1), 'Lunedì dell’Angelo'],
    [toKey(year, 4, 25), 'Festa della Liberazione'],
    [toKey(year, 5, 1), 'Festa del Lavoro'],
    [toKey(year, 6, 2), 'Festa della Repubblica'],
    [toKey(year, 8, 15), 'Ferragosto'],
    [toKey(year, 11, 1), 'Ognissanti'],
    [toKey(year, 12, 8), 'Immacolata Concezione'],
    [toKey(year, 12, 25), 'Natale'],
    [toKey(year, 12, 26), 'Santo Stefano'],
  ];
  // Dal 2026 il 4 ottobre è di nuovo festa nazionale (legge 8 ottobre 2025, n. 151).
  if (year >= 2026) list.push([toKey(year, 10, 4), 'San Francesco']);
  const map = new Map(list);
  cache.set(year, map);
  return map;
}

/** Nome della festività di quel giorno (null se è un giorno normale). */
export function holidayName(key: DateKey): string | null {
  return holidaysOfYear(parseKey(key).y).get(key) ?? null;
}
