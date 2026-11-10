// Inserimento rapido: capisce frasi come "Cena con Marco domani alle 20" e ne ricava titolo, giorno e orario.
import type { DateKey } from '../types';
import { addDays, addMonths, capitalize, daysInMonth, parseKey, toKey, weekday } from './dates';

export interface QuickAdd {
  title: string;
  date: DateKey;
  endDate: DateKey;
  allDay: boolean;
  start: number;
  end: number;
  /** Nella frase c'era un giorno / un orario. */
  hasDate: boolean;
  hasTime: boolean;
}

// Confini di parola che funzionano anche con le lettere accentate ("lunedì").
const B0 = '(?<![\\p{L}\\p{N}])';
const B1 = '(?![\\p{L}\\p{N}])';

function re(body: string): RegExp {
  return new RegExp(`${B0}${body}${B1}`, 'iu');
}

const MONTH_WORDS: [string, number][] = [
  ['gennaio', 1],
  ['febbraio', 2],
  ['marzo', 3],
  ['aprile', 4],
  ['maggio', 5],
  ['giugno', 6],
  ['luglio', 7],
  ['agosto', 8],
  ['settembre', 9],
  ['ottobre', 10],
  ['novembre', 11],
  ['dicembre', 12],
  ['gen', 1],
  ['feb', 2],
  ['mar', 3],
  ['apr', 4],
  ['mag', 5],
  ['giu', 6],
  ['lug', 7],
  ['ago', 8],
  ['sett', 9],
  ['set', 9],
  ['ott', 10],
  ['nov', 11],
  ['dic', 12],
];
const MONTH_ALT = MONTH_WORDS.map(([w]) => w).join('|');

const WEEKDAY_WORDS: [string, number][] = [
  ['luned[iì]', 1],
  ['marted[iì]', 2],
  ['mercoled[iì]', 3],
  ['gioved[iì]', 4],
  ['venerd[iì]', 5],
  ['sabato', 6],
  ['domenica', 7],
];
const WEEKDAY_ALT = WEEKDAY_WORDS.map(([w]) => w).join('|');

const SMALL_NUMBERS: Record<string, number> = { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10 };

function monthFromWord(word: string): number | null {
  const w = word.toLowerCase();
  const found = MONTH_WORDS.find(([name]) => name === w);
  return found ? found[1] : null;
}

function weekdayFromWord(word: string): number | null {
  const w = word.toLowerCase().replace('ì', 'i');
  const found = WEEKDAY_WORDS.find(([pattern]) => new RegExp(`^${pattern}$`, 'i').test(w));
  return found ? found[1] : null;
}

function validDate(y: number, m: number, d: number): DateKey | null {
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return toKey(y, m, d);
}

function minutesOf(h: number, m: number): number | null {
  if (h === 24 && m === 0) return 0;
  return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? h * 60 + m : null;
}

function extraMinutes(word: string | undefined): number {
  if (!word) return 0;
  const w = word.toLowerCase().replace(/\s+/g, ' ');
  if (w === 'mezza' || w === 'mezzo' || w === 'trenta') return 30;
  if (w === 'un quarto' || w === 'quindici') return 15;
  return 0;
}

/**
 * Legge la frase. `baseDate` è il giorno da usare se nella frase non c'è (quello scelto nel calendario),
 * `today` serve per "oggi", "domani", "lunedì"…
 */
export function parseQuickAdd(text: string, baseDate: DateKey, today: DateKey): QuickAdd {
  let rest = ` ${text.replace(/\s+/g, ' ').trim()} `;
  // "as": questi valori vengono riempiti dentro le funzioni qui sotto.
  let date = null as DateKey | null;
  let start = null as number | null;
  let end = null as number | null;
  let duration = null as number | null;
  let afternoon = false as boolean;

  /** Cerca `pattern`; se `use` accetta il risultato, toglie quel pezzo dalla frase. */
  const take = (pattern: RegExp, use: (m: RegExpExecArray) => boolean): boolean => {
    const m = pattern.exec(rest);
    if (!m || !use(m)) return false;
    rest = `${rest.slice(0, m.index)} ${rest.slice(m.index + m[0].length)}`;
    return true;
  };

  // ----- Durata: "per 2 ore", "per 45 minuti", "per mezz'ora" -----
  take(re('per\\s+(?:(\\d+(?:[.,]\\d+)?)\\s*(ore|ora|h|minuti|min)|(un[\'’]ora\\s+e\\s+mezza|un[\'’]ora|mezz[\'’]ora))'), (m) => {
    if (m[3]) {
      const w = m[3].toLowerCase();
      duration = w.startsWith('mezz') ? 30 : w.includes('mezza') ? 90 : 60;
      return true;
    }
    const n = Number(m[1]!.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return false;
    const unit = m[2]!.toLowerCase();
    duration = Math.round(unit.startsWith('min') ? n : n * 60);
    return duration > 0 && duration <= 24 * 60;
  });

  // ----- Orario "dalle 18 alle 19:30" e "18:00-19:30" -----
  const TIME = '(\\d{1,2})(?:[:.](\\d{2}))?';
  // "di sera", "del pomeriggio"… contano solo subito dopo un orario ("alle 8 di sera"), così
  // un titolo come "Turno di notte" resta intero.
  const PERIOD = '(?:\\s+(?:di|del|della)\\s+(sera|serata|pomeriggio|mattina|mattino|mattinata|notte))?';
  const notePeriod = (word: string | undefined) => {
    if (!word) return;
    const w = word.toLowerCase();
    if (w.startsWith('ser') || w === 'pomeriggio') afternoon = true;
  };
  take(re(`(?:dalle|da)\\s+(?:ore\\s+)?${TIME}\\s+(?:fino\\s+alle|alle|a)\\s+(?:ore\\s+)?${TIME}${PERIOD}`), (m) => {
    const a = minutesOf(Number(m[1]), Number(m[2] ?? 0));
    const b = minutesOf(Number(m[3]), Number(m[4] ?? 0));
    if (a === null || b === null) return false;
    start = a;
    end = b;
    notePeriod(m[5]);
    return true;
  });
  if (start === null) {
    take(re(`(\\d{1,2}):(\\d{2})\\s*[-–]\\s*(\\d{1,2}):(\\d{2})`), (m) => {
      const a = minutesOf(Number(m[1]), Number(m[2]));
      const b = minutesOf(Number(m[3]), Number(m[4]));
      if (a === null || b === null) return false;
      start = a;
      end = b;
      return true;
    });
  }

  // ----- Orario singolo: "alle 20", "ore 9:30", "alle 8 e mezza", "a mezzogiorno", "20:30" -----
  if (start === null) {
    take(re('a\\s+(mezzogiorno|mezzanotte)'), (m) => {
      start = m[1]!.toLowerCase() === 'mezzogiorno' ? 12 * 60 : 0;
      return true;
    });
  }
  if (start === null) {
    take(re(`(?:alle\\s+ore|alle|all['’]|ore)\\s*${TIME}(?:\\s+e\\s+(mezza|mezzo|un\\s+quarto|trenta|quindici))?${PERIOD}`), (m) => {
      const base = minutesOf(Number(m[1]), Number(m[2] ?? 0));
      if (base === null) return false;
      start = Math.min(1439, base + (m[2] ? 0 : extraMinutes(m[3])));
      notePeriod(m[4]);
      return true;
    });
  }
  if (start === null) {
    take(re(`(\\d{1,2}):(\\d{2})${PERIOD}`), (m) => {
      const v = minutesOf(Number(m[1]), Number(m[2]));
      if (v === null) return false;
      start = v;
      notePeriod(m[3]);
      return true;
    });
  }

  // ----- "stasera", "domani pomeriggio"… dicono anche il giorno -----
  take(re('(stasera|stamattina|stanotte|oggi\\s+pomeriggio)'), (m) => {
    const w = m[1]!.toLowerCase();
    date = today;
    afternoon = afternoon || w === 'stasera' || w.includes('pomeriggio');
    return true;
  });
  take(re('(domattina|domani\\s+(?:mattina|sera|pomeriggio))'), (m) => {
    const w = m[1]!.toLowerCase();
    date = addDays(today, 1);
    afternoon = afternoon || w.includes('sera') || w.includes('pomeriggio');
    return true;
  });

  // ----- Giorno -----
  if (date === null) {
    take(re('(dopodomani|domani|oggi)'), (m) => {
      const w = m[1]!.toLowerCase();
      date = addDays(today, w === 'oggi' ? 0 : w === 'domani' ? 1 : 2);
      return true;
    });
  }
  if (date === null) {
    take(re('(?:tra|fra)\\s+(\\d{1,3}|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\\s+(giorni|giorno|settimane|settimana|mesi|mese)'), (m) => {
      const word = m[1]!.toLowerCase();
      const n = /^\d+$/.test(word) ? Number(word) : (SMALL_NUMBERS[word] ?? 0);
      if (n <= 0 || n > 730) return false;
      const unit = m[2]!.toLowerCase();
      date = unit.startsWith('giorn') ? addDays(today, n) : unit.startsWith('settiman') ? addDays(today, n * 7) : addMonths(today, n);
      return true;
    });
  }
  if (date === null) {
    // 12/11 oppure 12/11/2026
    take(re('(?:il\\s+|l[\'’])?(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2}|\\d{4}))?'), (m) => {
      const d = Number(m[1]);
      const mo = Number(m[2]);
      const t = parseKey(today);
      let y = m[3] ? Number(m[3]) : t.y;
      if (m[3] && m[3].length === 2) y += 2000;
      let key = validDate(y, mo, d);
      if (!key) return false;
      if (!m[3] && key < today) key = validDate(y + 1, mo, d) ?? key;
      date = key;
      return true;
    });
  }
  if (date === null) {
    // 12 novembre, il 3 mar 2027, primo dicembre
    take(re(`(?:il\\s+|l[\'’])?(\\d{1,2}|primo)°?\\s+(${MONTH_ALT})(?:\\s+(\\d{4}))?`), (m) => {
      const d = m[1]!.toLowerCase() === 'primo' ? 1 : Number(m[1]);
      const mo = monthFromWord(m[2]!);
      if (mo === null) return false;
      const t = parseKey(today);
      const y = m[3] ? Number(m[3]) : t.y;
      let key = validDate(y, mo, d);
      if (!key) return false;
      if (!m[3] && key < today) key = validDate(y + 1, mo, d) ?? key;
      date = key;
      return true;
    });
  }
  if (date === null) {
    // lunedì, giovedì prossimo
    take(re(`(?:(questo|questa|prossimo|prossima)\\s+)?(${WEEKDAY_ALT})(?:\\s+(prossimo|prossima))?`), (m) => {
      const wd = weekdayFromWord(m[2]!);
      if (wd === null) return false;
      const next = /prossim/i.test(`${m[1] ?? ''}${m[3] ?? ''}`);
      let offset = (wd - weekday(today) + 7) % 7;
      if (offset === 0 && next) offset = 7;
      date = addDays(today, offset);
      return true;
    });
  }
  if (date === null) {
    // il 22 (di questo mese, o del prossimo se è già passato)
    take(re('il\\s+(\\d{1,2})'), (m) => {
      const d = Number(m[1]);
      const t = parseKey(today);
      let key = validDate(t.y, t.m, d);
      if (key && key < today) key = null;
      if (!key) {
        const nextMonth = parseKey(addMonths(toKey(t.y, t.m, 1), 1));
        key = validDate(nextMonth.y, nextMonth.m, d);
      }
      if (!key) return false;
      date = key;
      return true;
    });
  }

  // ----- Titolo: quello che resta, senza le paroline rimaste in fondo o all'inizio -----
  let title = rest.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 4; i++) {
    const before = title;
    title = title
      .replace(/[\s,;:–-]+$/u, '')
      .replace(/^[\s,;:–-]+/u, '')
      .replace(new RegExp(`\\s+(?:il|lo|la|di|del|a|al|alle|per|da|dal|dalle|e|ore)$`, 'iu'), '')
      .replace(new RegExp(`^(?:il|alle|a|per|ore|e)\\s+`, 'iu'), '');
    if (title === before) break;
  }
  title = capitalize(title);

  const hasDate = date !== null;
  const hasTime = start !== null;
  const day: DateKey = date ?? baseDate;
  if (start === null) {
    return { title, date: day, endDate: day, allDay: true, start: 9 * 60, end: 10 * 60, hasDate, hasTime };
  }
  let s: number = start;
  let e: number | null = end;
  // "alle 8 di sera" → 20:00; "dalle 3 alle 5 del pomeriggio" → 15–17.
  if (afternoon && s < 12 * 60) {
    s += 12 * 60;
    if (e !== null && e <= 12 * 60) e += 12 * 60;
    if (e !== null && e >= 1440) e -= 1440;
  }
  let endDate = day;
  if (e === null) {
    const total = s + (duration ?? 60);
    if (total >= 1440) {
      endDate = addDays(day, 1);
      e = total - 1440;
      if (e >= 1440) e = 1439;
    } else e = total;
  } else if (e <= s) {
    endDate = addDays(day, 1);
  }
  return { title, date: day, endDate, allDay: false, start: s, end: e, hasDate, hasTime };
}
