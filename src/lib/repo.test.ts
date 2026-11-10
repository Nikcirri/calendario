import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { CalendarDB } from './db';
import { blankEvent } from './logic/model';
import { defaultSettings } from './logic/settings';
import {
  deleteCategory,
  emptyTrash,
  ensureSeed,
  exportAll,
  importAll,
  loadSettings,
  purgeOldTrash,
  putEvent,
  restoreEvent,
  saveSettings,
  setActual,
  setDone,
  skipOccurrence,
  toggleChecklistItem,
  trashEvent,
} from './repo';

let db: CalendarDB;
let n = 0;

beforeEach(() => {
  db = new CalendarDB(`test-${n++}`);
});

describe('database', () => {
  it('crea le categorie di partenza una volta sola', async () => {
    await ensureSeed(db);
    const first = await db.categories.toArray();
    expect(first.map((c) => c.name)).toEqual(expect.arrayContaining(['Lavoro', 'Studio', 'Sport', 'Personale', 'Famiglia']));
    await db.categories.clear();
    await ensureSeed(db);
    expect(await db.categories.count()).toBe(0);
  });

  it('salva e rilegge le impostazioni', async () => {
    expect(await loadSettings(db)).toEqual(defaultSettings());
    await saveSettings(db, { ...defaultSettings(), view: 'week', defaultAlerts: [] });
    expect(await loadSettings(db)).toMatchObject({ view: 'week', defaultAlerts: [] });
  });

  it('sposta nel cestino, ripristina ed elimina dopo 30 giorni', async () => {
    const ev = await putEvent(db, { ...blankEvent('event', '2026-11-10', 540), title: 'Prova' });
    await trashEvent(db, ev.id, new Date('2026-11-10T10:00:00Z'));
    expect((await db.events.get(ev.id))!.deletedAt).toBe('2026-11-10T10:00:00.000Z');
    expect(await purgeOldTrash(db, new Date('2026-12-01T10:00:00Z'))).toBe(0);
    await restoreEvent(db, ev.id);
    expect((await db.events.get(ev.id))!.deletedAt).toBeNull();
    await trashEvent(db, ev.id, new Date('2026-11-10T10:00:00Z'));
    expect(await purgeOldTrash(db, new Date('2026-12-11T10:00:00Z'))).toBe(1);
    expect(await db.events.count()).toBe(0);
    const other = await putEvent(db, blankEvent('event', '2026-11-10', 540));
    await trashEvent(db, other.id);
    expect(await emptyTrash(db)).toBe(1);
  });

  it('modifica le singole occorrenze', async () => {
    const base = blankEvent('event', '2026-11-10', 540);
    base.checklist = [{ id: 'k1', text: 'Documenti', done: false }];
    const ev = await putEvent(db, base);
    await skipOccurrence(db, ev.id, '2026-11-17');
    await skipOccurrence(db, ev.id, '2026-11-17');
    await setActual(db, ev.id, '2026-11-10', 300);
    await setDone(db, ev.id, '2026-11-10', true);
    await toggleChecklistItem(db, ev.id, 'k1');
    let saved = (await db.events.get(ev.id))!;
    expect(saved.exdates).toEqual(['2026-11-17']);
    expect(saved.actual).toEqual({ '2026-11-10': 300 });
    expect(saved.done).toEqual(['2026-11-10']);
    expect(saved.checklist[0]!.done).toBe(true);
    await setActual(db, ev.id, '2026-11-10', null);
    await setDone(db, ev.id, '2026-11-10', false);
    saved = (await db.events.get(ev.id))!;
    expect(saved.actual).toEqual({});
    expect(saved.done).toEqual([]);
  });

  it('eliminando una categoria gli eventi restano', async () => {
    await ensureSeed(db);
    const cat = (await db.categories.toArray())[0]!;
    const ev = await putEvent(db, { ...blankEvent('event', '2026-11-10', 540), categoryId: cat.id });
    await deleteCategory(db, cat.id);
    expect((await db.events.get(ev.id))!.categoryId).toBeNull();
    expect(await db.categories.get(cat.id)).toBeUndefined();
  });

  it('esporta e importa tutto', async () => {
    await ensureSeed(db);
    await putEvent(db, { ...blankEvent('event', '2026-11-10', 540), title: 'Uno' });
    await saveSettings(db, { ...defaultSettings(), view: 'agenda', updates: { lastCheck: 'x', latestVersion: '9.9.9', apkUrl: null, pageUrl: null } });
    const data = await exportAll(db);
    const copy = new CalendarDB(`test-${n++}`);
    await importAll(copy, data);
    expect((await copy.events.toArray()).map((e) => e.title)).toEqual(['Uno']);
    expect(await copy.categories.count()).toBe(5);
    const settings = await loadSettings(copy);
    expect(settings.view).toBe('agenda');
    // Lo stato degli aggiornamenti non arriva dal backup.
    expect(settings.updates.latestVersion).toBeNull();
  });
});
