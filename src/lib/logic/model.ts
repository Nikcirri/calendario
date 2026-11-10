// Creazione e controllo dei dati (eventi, promemoria, categorie, modelli) e testi degli avvisi.
import type { CalEvent, Category, ChecklistItem, DateKey, EventKind, Repeat, RepeatEnd, Template } from '../types';
import { fmtTime, isDateKey } from './dates';
import { normalizeRepeat } from './recurrence';

/** Colori tra cui scegliere (leggibili sullo sfondo scuro, con il testo bianco sopra). */
export const PALETTE = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#8b6fe8', '#2a9db0', '#7d8799'] as const;
export const DEFAULT_COLOR = '#7d8799';

export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultCategories(): Category[] {
  const names: [string, string][] = [
    ['Lavoro', '#3987e5'],
    ['Studio', '#d95926'],
    ['Sport', '#199e70'],
    ['Personale', '#c98500'],
    ['Famiglia', '#d55181'],
  ];
  return names.map(([name, color], i) => ({ id: newId(), name, color, goalHours: null, hourlyRate: null, order: i }));
}

/** Evento o promemoria nuovo, con i valori di partenza. */
export function blankEvent(kind: EventKind, date: DateKey, start: number, now: Date = new Date()): CalEvent {
  const s = Math.min(1439, Math.max(0, Math.round(start)));
  const end = kind === 'reminder' ? s : Math.min(1439, s + 60);
  const stamp = now.toISOString();
  return {
    id: newId(),
    kind,
    title: '',
    date,
    endDate: date,
    allDay: false,
    start: s,
    end,
    location: '',
    categoryId: null,
    color: null,
    alerts: [],
    repeat: null,
    exdates: [],
    notes: '',
    checklist: [],
    actual: {},
    done: [],
    deletedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

/** Orario di partenza proposto per un evento nuovo: l'ora successiva (oggi) oppure le 9:00. */
export function suggestedStart(date: DateKey, today: DateKey, nowMinutes: number): number {
  if (date !== today) return 9 * 60;
  const next = (Math.floor(nowMinutes / 60) + 1) * 60;
  return next >= 23 * 60 ? 23 * 60 : next;
}

// ---------- Controllo dei dati letti da un backup ----------

function str(v: unknown, max = 2000): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function int(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
}

function numOrNull(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

function isColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
}

function numberList(v: unknown, min: number, max: number, limit: number): number[] {
  if (!Array.isArray(v)) return [];
  const out: number[] = [];
  for (const n of v) {
    if (typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max && !out.includes(n)) out.push(n);
    if (out.length >= limit) break;
  }
  return out;
}

function dateList(v: unknown, limit: number): DateKey[] {
  if (!Array.isArray(v)) return [];
  const out: DateKey[] = [];
  for (const d of v) {
    if (isDateKey(d) && !out.includes(d)) out.push(d);
    if (out.length >= limit) break;
  }
  return out;
}

function sanitizeRepeat(raw: unknown, start: DateKey): Repeat | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.freq !== 'day' && r.freq !== 'week' && r.freq !== 'month' && r.freq !== 'year') return null;
  let end: RepeatEnd = { type: 'never' };
  const e = r.end as Record<string, unknown> | null | undefined;
  if (e && e.type === 'count') end = { type: 'count', count: int(e.count, 1, 999, 1) };
  else if (e && e.type === 'until' && isDateKey(e.date)) end = { type: 'until', date: e.date };
  return normalizeRepeat(
    {
      freq: r.freq,
      interval: int(r.interval, 1, 99, 1),
      weekdays: numberList(r.weekdays, 1, 7, 7),
      monthMode: r.monthMode === 'weekday' || r.monthMode === 'dates' ? r.monthMode : 'day',
      monthDays: numberList(r.monthDays, 1, 31, 31),
      yearMode: r.yearMode === 'weekday' || r.yearMode === 'months' ? r.yearMode : 'date',
      yearMonths: numberList(r.yearMonths, 1, 12, 12),
      end,
    },
    start,
  );
}

function sanitizeChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ChecklistItem[] = [];
  for (const item of raw.slice(0, 100)) {
    if (typeof item !== 'object' || item === null) continue;
    const i = item as Record<string, unknown>;
    const text = str(i.text, 300).trim();
    if (text) out.push({ id: str(i.id, 80) || newId(), text, done: i.done === true });
  }
  return out;
}

/** Controlla un evento letto da fuori (backup): restituisce null se non è utilizzabile. */
export function sanitizeEvent(raw: unknown): CalEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 80);
  if (!id || !isDateKey(r.date)) return null;
  const kind: EventKind = r.kind === 'reminder' ? 'reminder' : 'event';
  const date = r.date;
  let endDate = isDateKey(r.endDate) && r.endDate >= date ? r.endDate : date;
  const allDay = r.allDay === true;
  const start = int(r.start, 0, 1439, 9 * 60);
  let end = int(r.end, 0, 1440, Math.min(1439, start + 60));
  if (kind === 'reminder') {
    endDate = date;
    end = start;
  } else if (!allDay && endDate === date && end < start) end = start;
  const actual: Record<DateKey, number> = {};
  if (typeof r.actual === 'object' && r.actual !== null) {
    for (const [k, v] of Object.entries(r.actual as Record<string, unknown>)) {
      if (isDateKey(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 14_400) actual[k] = Math.round(v);
    }
  }
  const now = new Date().toISOString();
  return {
    id,
    kind,
    title: str(r.title, 200),
    date,
    endDate,
    allDay,
    start,
    end,
    location: str(r.location, 300),
    categoryId: typeof r.categoryId === 'string' && r.categoryId ? r.categoryId.slice(0, 80) : null,
    color: isColor(r.color) ? r.color : null,
    alerts: numberList(r.alerts, -1439, 40_320, 5),
    repeat: sanitizeRepeat(r.repeat, date),
    exdates: dateList(r.exdates, 2000),
    notes: str(r.notes, 5000),
    checklist: sanitizeChecklist(r.checklist),
    actual,
    done: dateList(r.done, 5000),
    deletedAt: typeof r.deletedAt === 'string' && r.deletedAt ? r.deletedAt : null,
    createdAt: typeof r.createdAt === 'string' && r.createdAt ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' && r.updatedAt ? r.updatedAt : now,
  };
}

export function sanitizeCategory(raw: unknown, index = 0): Category | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 80);
  const name = str(r.name, 40).trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    color: isColor(r.color) ? r.color : DEFAULT_COLOR,
    goalHours: numOrNull(r.goalHours, 0.5, 744),
    hourlyRate: numOrNull(r.hourlyRate, 0.01, 10_000),
    order: int(r.order, 0, 10_000, index),
  };
}

export function sanitizeTemplate(raw: unknown, index = 0): Template | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 80);
  const title = str(r.title, 200).trim();
  if (!id || !title) return null;
  const start = int(r.start, 0, 1439, 9 * 60);
  return {
    id,
    title,
    allDay: r.allDay === true,
    start,
    end: Math.max(start, int(r.end, 0, 1440, Math.min(1439, start + 60))),
    location: str(r.location, 300),
    categoryId: typeof r.categoryId === 'string' && r.categoryId ? r.categoryId.slice(0, 80) : null,
    color: isColor(r.color) ? r.color : null,
    alerts: numberList(r.alerts, -1439, 40_320, 5),
    order: int(r.order, 0, 10_000, index),
  };
}

// ---------- Colori ----------

export function eventColor(ev: Pick<CalEvent, 'color' | 'categoryId'>, categories: ReadonlyMap<string, Category>): string {
  if (ev.color) return ev.color;
  const cat = ev.categoryId ? categories.get(ev.categoryId) : undefined;
  return cat ? cat.color : DEFAULT_COLOR;
}

// ---------- Avvisi ----------

export interface AlertOption {
  value: number;
  label: string;
}

/** Avvisi per gli eventi con orario: minuti prima dell'inizio. */
export const TIMED_ALERTS: readonly AlertOption[] = [
  { value: 0, label: 'All’ora di inizio' },
  { value: 5, label: '5 minuti prima' },
  { value: 10, label: '10 minuti prima' },
  { value: 15, label: '15 minuti prima' },
  { value: 30, label: '30 minuti prima' },
  { value: 60, label: '1 ora prima' },
  { value: 120, label: '2 ore prima' },
  { value: 1440, label: '1 giorno prima' },
  { value: 2880, label: '2 giorni prima' },
  { value: 10_080, label: '1 settimana prima' },
];

/** Avvisi per gli eventi di tutto il giorno: minuti prima della mezzanotte del giorno (negativo = lo stesso giorno). */
export const ALLDAY_ALERTS: readonly AlertOption[] = [
  { value: -540, label: 'Il giorno stesso alle 9:00' },
  { value: 900, label: 'Il giorno prima alle 9:00' },
  { value: 360, label: 'Il giorno prima alle 18:00' },
  { value: 2340, label: '2 giorni prima alle 9:00' },
  { value: 9540, label: '1 settimana prima alle 9:00' },
];

export function alertOptions(allDay: boolean): readonly AlertOption[] {
  return allDay ? ALLDAY_ALERTS : TIMED_ALERTS;
}

export function alertLabel(value: number, allDay: boolean): string {
  const known = alertOptions(allDay).find((o) => o.value === value);
  if (known) return known.label;
  if (allDay) {
    const days = Math.ceil(value / 1440);
    const time = fmtTime((((-value % 1440) + 1440) % 1440));
    return days <= 0 ? `Il giorno stesso alle ${time}` : `${days} ${days === 1 ? 'giorno' : 'giorni'} prima alle ${time}`;
  }
  if (value % 1440 === 0) return `${value / 1440} giorni prima`;
  if (value % 60 === 0) return `${value / 60} ore prima`;
  return `${value} minuti prima`;
}

/** Testo breve per l'elenco dei campi: "30 min prima, 1 giorno prima". */
export function alertsSummary(alerts: readonly number[], allDay: boolean): string {
  if (!alerts.length) return 'Nessuno';
  return [...alerts]
    .sort((a, b) => a - b)
    .map((a) => alertLabel(a, allDay).replace('minuti', 'min'))
    .join(', ');
}

/** Passando da "con orario" a "tutto il giorno" (o viceversa) gli avvisi vecchi non valgono più. */
export function convertAlerts(alerts: readonly number[], toAllDay: boolean): number[] {
  if (!alerts.length) return [];
  return toAllDay ? [-540] : [30];
}
