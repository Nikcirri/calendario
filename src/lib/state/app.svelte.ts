// Stato principale dell'app: dati letti dal database, vista e giorno scelti, impostazioni.
import { liveQuery } from 'dexie';
import { db } from '../db';
import { reportError } from '../errors';
import { addDays, addMonths, minutesOfDay, todayKey } from '../logic/dates';
import { eventColor } from '../logic/model';
import { NO_CATEGORY } from '../logic/recap';
import { defaultSettings } from '../logic/settings';
import { ensureSeed, loadSettings, purgeOldTrash, saveSettings } from '../repo';
import type { CalEvent, Category, DateKey, Settings, Template, ViewId } from '../types';

export type PageId = 'recap' | 'settings' | 'trash' | 'search' | 'categories';

// Elenchi "grezzi": cambiano tutti insieme quando il database cambia.
let events = $state.raw<CalEvent[]>([]);
let categories = $state.raw<Category[]>([]);
let templates = $state.raw<Template[]>([]);

export const app = $state({
  ready: false,
  settings: defaultSettings() as Settings,
  view: 'month' as ViewId,
  /** Giorno scelto nel calendario. */
  cursor: todayKey(),
  today: todayKey(),
  /** Minuti da mezzanotte, aggiornati ogni mezzo minuto (per la linea dell'ora attuale). */
  nowMinutes: minutesOfDay(),
  drawer: false,
  page: null as PageId | null,
  /** Categorie nascoste dal calendario (id, oppure 'none' per gli eventi senza categoria). */
  hidden: [] as string[],
});

const active = $derived(events.filter((e) => !e.deletedAt));
const trashed = $derived(
  events.filter((e) => e.deletedAt).sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '')),
);
const visible = $derived.by(() => {
  if (!app.hidden.length) return active;
  const hidden = new Set(app.hidden);
  const known = new Set(categories.map((c) => c.id));
  return active.filter((e) => !hidden.has(e.categoryId && known.has(e.categoryId) ? e.categoryId : NO_CATEGORY));
});
const categoryById = $derived(new Map(categories.map((c) => [c.id, c])));

/** Dati dell'app, sempre aggiornati. */
export const data = {
  /** Eventi e promemoria non eliminati. */
  get events(): CalEvent[] {
    return active;
  },
  /** Come `events`, senza le categorie nascoste dal menu. */
  get visible(): CalEvent[] {
    return visible;
  },
  get trash(): CalEvent[] {
    return trashed;
  },
  get categories(): Category[] {
    return categories;
  },
  get categoryById(): Map<string, Category> {
    return categoryById;
  },
  get templates(): Template[] {
    return templates;
  },
};

export function colorOf(ev: Pick<CalEvent, 'color' | 'categoryId'>): string {
  return eventColor(ev, categoryById);
}

export function findEvent(id: string): CalEvent | undefined {
  return events.find((e) => e.id === id);
}

/** Segue una tabella del database; la promessa si risolve al primo risultato. */
function follow<T>(query: () => Promise<T>, apply: (value: T) => void): Promise<void> {
  return new Promise((resolve) => {
    liveQuery(query).subscribe({
      next: (value) => {
        apply(value);
        resolve();
      },
      error: (e: unknown) => {
        reportError(e, 'Non riesco a leggere i dati dell’app.');
        resolve();
      },
    });
  });
}

export async function initApp(): Promise<void> {
  await ensureSeed(db);
  await purgeOldTrash(db).catch(() => 0);
  app.settings = await loadSettings(db);
  app.view = app.settings.view;
  const hiddenRow = await db.kv.get('hiddenCategories').catch(() => undefined);
  if (Array.isArray(hiddenRow?.value)) app.hidden = hiddenRow.value.filter((v): v is string => typeof v === 'string');
  await Promise.all([
    follow(
      () => db.events.toArray(),
      (v) => (events = v),
    ),
    follow(
      () => db.categories.toArray(),
      (v) => (categories = v.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'it'))),
    ),
    follow(
      () => db.templates.toArray(),
      (v) => (templates = v.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'it'))),
    ),
  ]);
  app.ready = true;
}

/** Modifica le impostazioni e le salva. */
export async function updateSettings(change: (s: Settings) => void): Promise<void> {
  change(app.settings);
  await saveSettings(db, app.settings);
}

/** Aggiorna "oggi" e l'ora attuale; a mezzanotte, se stavi guardando oggi, passi al giorno nuovo. */
export function tickNow(): void {
  const now = new Date();
  app.nowMinutes = minutesOfDay(now);
  const today = todayKey(now);
  if (today === app.today) return;
  if (app.cursor === app.today) app.cursor = today;
  app.today = today;
}

// ---------- Navigazione ----------

export function setView(view: ViewId): void {
  app.view = view;
  app.drawer = false;
  if (app.settings.view !== view) void updateSettings((s) => (s.view = view)).catch((e: unknown) => reportError(e));
}

export function selectDay(day: DateKey): void {
  app.cursor = day;
}

export function goToday(): void {
  tickNow();
  app.cursor = app.today;
}

/** Avanti (+1) o indietro (-1) di un anno, un mese, una settimana o un giorno, secondo la vista. */
export function shiftView(dir: 1 | -1): void {
  if (app.view === 'year') app.cursor = addMonths(app.cursor, 12 * dir);
  else if (app.view === 'month') app.cursor = addMonths(app.cursor, dir);
  else if (app.view === 'week') app.cursor = addDays(app.cursor, 7 * dir);
  else app.cursor = addDays(app.cursor, dir);
}

export function openPage(page: PageId): void {
  app.drawer = false;
  app.page = page;
}

export function closePage(): void {
  app.page = null;
}

/** Mostra o nasconde una categoria nel calendario. */
export async function toggleHidden(id: string): Promise<void> {
  app.hidden = app.hidden.includes(id) ? app.hidden.filter((h) => h !== id) : [...app.hidden, id];
  await db.kv.put({ key: 'hiddenCategories', value: [...app.hidden] });
}

// ---------- Fogli che si aprono da più schermate ----------

export interface EditorRequest {
  event: CalEvent;
  isNew: boolean;
}

export const sheets = $state({
  editor: null as EditorRequest | null,
  /** Dettaglio di un'occorrenza: id dell'evento e giorno. */
  detail: null as { id: string; date: DateKey } | null,
});
