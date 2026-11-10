// Lettura e scrittura dei dati nel database del telefono.
import type { CalendarDB } from './db';
import type { BackupData } from './logic/backup';
import { defaultCategories } from './logic/model';
import { defaultSettings, sanitizeSettings } from './logic/settings';
import type { CalEvent, Category, DateKey, Settings, Template } from './types';

/** Gli eventi restano nel cestino per questi giorni, poi vengono eliminati del tutto. */
export const TRASH_DAYS = 30;

// ---------- Impostazioni ----------

export async function loadSettings(db: CalendarDB): Promise<Settings> {
  const row = await db.kv.get('settings');
  return row ? sanitizeSettings(row.value) : defaultSettings();
}

export async function saveSettings(db: CalendarDB, settings: Settings): Promise<void> {
  // Copia semplice: lo stato dell'app è un oggetto "vivo" che il database non sa salvare.
  await db.kv.put({ key: 'settings', value: JSON.parse(JSON.stringify(settings)) as unknown });
}

/** Alla prima apertura crea le categorie di partenza. */
export async function ensureSeed(db: CalendarDB): Promise<void> {
  const seeded = await db.kv.get('seeded');
  if (seeded) return;
  await db.transaction('rw', db.categories, db.kv, async () => {
    if ((await db.categories.count()) === 0) await db.categories.bulkPut(defaultCategories());
    await db.kv.put({ key: 'seeded', value: true });
  });
}

// ---------- Eventi e promemoria ----------

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function putEvent(db: CalendarDB, ev: CalEvent, now: Date = new Date()): Promise<CalEvent> {
  const saved: CalEvent = { ...plain(ev), updatedAt: now.toISOString() };
  await db.events.put(saved);
  return saved;
}

export async function putEvents(db: CalendarDB, events: readonly CalEvent[], now: Date = new Date()): Promise<void> {
  const stamp = now.toISOString();
  await db.events.bulkPut(events.map((e) => ({ ...plain(e), updatedAt: stamp })));
}

async function changeEvent(db: CalendarDB, id: string, change: (ev: CalEvent) => void, now: Date): Promise<CalEvent | null> {
  return db.transaction('rw', db.events, async () => {
    const ev = await db.events.get(id);
    if (!ev) return null;
    change(ev);
    ev.updatedAt = now.toISOString();
    await db.events.put(ev);
    return ev;
  });
}

/** Sposta nel cestino. */
export function trashEvent(db: CalendarDB, id: string, now: Date = new Date()): Promise<CalEvent | null> {
  return changeEvent(db, id, (ev) => (ev.deletedAt = now.toISOString()), now);
}

export function restoreEvent(db: CalendarDB, id: string, now: Date = new Date()): Promise<CalEvent | null> {
  return changeEvent(db, id, (ev) => (ev.deletedAt = null), now);
}

/** Elimina una sola occorrenza di un evento che si ripete. */
export function skipOccurrence(db: CalendarDB, id: string, date: DateKey, now: Date = new Date()): Promise<CalEvent | null> {
  return changeEvent(
    db,
    id,
    (ev) => {
      if (!ev.exdates.includes(date)) ev.exdates.push(date);
    },
    now,
  );
}

export function unskipOccurrence(db: CalendarDB, id: string, date: DateKey, now: Date = new Date()): Promise<CalEvent | null> {
  return changeEvent(db, id, (ev) => (ev.exdates = ev.exdates.filter((d) => d !== date)), now);
}

/** Ore effettive di un'occorrenza (null = torna a quelle programmate). */
export function setActual(db: CalendarDB, id: string, date: DateKey, minutes: number | null, now: Date = new Date()): Promise<CalEvent | null> {
  return changeEvent(
    db,
    id,
    (ev) => {
      if (minutes === null) delete ev.actual[date];
      else ev.actual[date] = Math.max(0, Math.round(minutes));
    },
    now,
  );
}

/** Promemoria fatto / da fare, per quel giorno. */
export function setDone(db: CalendarDB, id: string, date: DateKey, done: boolean, now: Date = new Date()): Promise<CalEvent | null> {
  return changeEvent(
    db,
    id,
    (ev) => {
      const has = ev.done.includes(date);
      if (done && !has) ev.done.push(date);
      else if (!done && has) ev.done = ev.done.filter((d) => d !== date);
    },
    now,
  );
}

export function toggleChecklistItem(db: CalendarDB, id: string, itemId: string, now: Date = new Date()): Promise<CalEvent | null> {
  return changeEvent(
    db,
    id,
    (ev) => {
      const item = ev.checklist.find((i) => i.id === itemId);
      if (item) item.done = !item.done;
    },
    now,
  );
}

export async function purgeEvent(db: CalendarDB, id: string): Promise<void> {
  await db.events.delete(id);
}

export async function emptyTrash(db: CalendarDB): Promise<number> {
  const ids = (await db.events.toArray()).filter((e) => e.deletedAt).map((e) => e.id);
  await db.events.bulkDelete(ids);
  return ids.length;
}

/** Elimina del tutto gli eventi nel cestino da più di 30 giorni. */
export async function purgeOldTrash(db: CalendarDB, now: Date = new Date()): Promise<number> {
  const limit = now.getTime() - TRASH_DAYS * 86_400_000;
  const ids = (await db.events.toArray())
    .filter((e) => e.deletedAt && new Date(e.deletedAt).getTime() < limit)
    .map((e) => e.id);
  await db.events.bulkDelete(ids);
  return ids.length;
}

// ---------- Categorie ----------

export async function putCategory(db: CalendarDB, category: Category): Promise<void> {
  await db.categories.put(plain(category));
}

/** Elimina la categoria: gli eventi che l'avevano restano, senza categoria. */
export async function deleteCategory(db: CalendarDB, id: string, now: Date = new Date()): Promise<void> {
  await db.transaction('rw', db.categories, db.events, db.templates, async () => {
    await db.categories.delete(id);
    const stamp = now.toISOString();
    await db.events
      .filter((e) => e.categoryId === id)
      .modify((e) => {
        e.categoryId = null;
        e.updatedAt = stamp;
      });
    await db.templates.filter((t) => t.categoryId === id).modify((t) => void (t.categoryId = null));
  });
}

// ---------- Modelli ----------

export async function putTemplate(db: CalendarDB, template: Template): Promise<void> {
  await db.templates.put(plain(template));
}

export async function deleteTemplate(db: CalendarDB, id: string): Promise<void> {
  await db.templates.delete(id);
}

// ---------- Backup ----------

export async function exportAll(db: CalendarDB): Promise<BackupData> {
  const [events, categories, templates, settings] = await Promise.all([
    db.events.toArray(),
    db.categories.toArray(),
    db.templates.toArray(),
    loadSettings(db),
  ]);
  return { events, categories, templates, settings };
}

/** Sostituisce tutti i dati con quelli del backup. Lo stato degli aggiornamenti resta quello attuale. */
export async function importAll(db: CalendarDB, data: BackupData): Promise<void> {
  await db.transaction('rw', db.events, db.categories, db.templates, db.kv, async () => {
    const current = await loadSettings(db);
    await Promise.all([db.events.clear(), db.categories.clear(), db.templates.clear()]);
    await db.events.bulkPut(data.events);
    await db.categories.bulkPut(data.categories);
    await db.templates.bulkPut(data.templates);
    if (data.settings) await saveSettings(db, { ...data.settings, updates: current.updates });
    await db.kv.put({ key: 'seeded', value: true });
  });
}
