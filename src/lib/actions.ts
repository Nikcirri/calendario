// Azioni dell'utente su eventi, promemoria e modelli (salva, elimina con "Annulla", inserimento rapido…).
import { db } from './db';
import { reportError } from './errors';
import { fmtRelativeDay, fmtTime } from './logic/dates';
import { blankEvent, newId, suggestedStart } from './logic/model';
import { parseQuickAdd } from './logic/quickadd';
import { tapFeedback } from './platform';
import {
  deleteTemplate,
  putEvent,
  putTemplate,
  restoreEvent,
  setActual,
  setDone,
  skipOccurrence,
  toggleChecklistItem,
  trashEvent,
  unskipOccurrence,
} from './repo';
import { askNotificationPermission, forgetNotificationPlan } from './services/notifications';
import { app, data, sheets } from './state/app.svelte';
import { showToast, showUndoToast } from './state/ui.svelte';
import type { CalEvent, DateKey, EventKind, Template } from './types';

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Apre la schermata per creare un evento (o promemoria) nel giorno e all'ora indicati. */
export function startNewEvent(date: DateKey = app.cursor, start?: number, kind: EventKind = 'event'): void {
  const ev = blankEvent(kind, date, start ?? suggestedStart(date, app.today, app.nowMinutes));
  ev.alerts = kind === 'reminder' ? [0] : [...app.settings.defaultAlerts];
  sheets.detail = null;
  sheets.editor = { event: ev, isNew: true };
}

export function startEdit(ev: CalEvent): void {
  sheets.detail = null;
  sheets.editor = { event: copy(ev), isNew: false };
}

/** Con il primo avviso si chiede ad Android il permesso delle notifiche. */
async function permissionForAlerts(ev: CalEvent): Promise<void> {
  if (!ev.alerts.length || !app.settings.notifications) return;
  try {
    const before = await askNotificationPermission();
    if (before) forgetNotificationPlan();
  } catch {
    // Nel browser o se Android non risponde: l'evento resta salvato lo stesso.
  }
}

export async function saveEvent(ev: CalEvent, isNew: boolean): Promise<void> {
  await putEvent(db, ev);
  void tapFeedback();
  showToast(ev.kind === 'reminder' ? (isNew ? 'Promemoria creato' : 'Promemoria salvato') : isNew ? 'Evento creato' : 'Evento salvato');
  void permissionForAlerts(ev);
}

/** Inserimento rapido: crea subito l'evento dalla frase scritta. false se la frase è vuota. */
export async function quickCreate(text: string): Promise<boolean> {
  if (!text.trim()) return false;
  const parsed = parseQuickAdd(text, app.cursor, app.today);
  const ev = blankEvent('event', parsed.date, parsed.start);
  ev.title = parsed.title || 'Senza titolo';
  ev.allDay = parsed.allDay;
  ev.endDate = parsed.endDate;
  ev.end = parsed.end;
  ev.alerts = parsed.allDay ? [] : [...app.settings.defaultAlerts];
  const saved = await putEvent(db, ev);
  void tapFeedback();
  const when = parsed.allDay
    ? fmtRelativeDay(parsed.date, app.today)
    : `${fmtRelativeDay(parsed.date, app.today)} alle ${fmtTime(parsed.start)}`;
  if (parsed.hasDate) app.cursor = parsed.date;
  showToast(`Creato: ${saved.title}, ${when}`, {
    actionLabel: 'Modifica',
    onAction: () => startEdit(saved),
    duration: 5000,
  });
  void permissionForAlerts(saved);
  return true;
}

/** Sposta l'evento (tutta la serie, se si ripete) nel cestino, con "Annulla". */
export async function removeEvent(ev: CalEvent): Promise<void> {
  await trashEvent(db, ev.id);
  sheets.detail = null;
  showUndoToast(ev.kind === 'reminder' ? 'Promemoria nel cestino' : 'Evento nel cestino', async () => {
    await restoreEvent(db, ev.id);
  });
}

/** Elimina una sola occorrenza di un evento che si ripete, con "Annulla". */
export async function removeOccurrence(ev: CalEvent, date: DateKey): Promise<void> {
  await skipOccurrence(db, ev.id, date);
  sheets.detail = null;
  showUndoToast('Eliminato solo questo giorno', async () => {
    await unskipOccurrence(db, ev.id, date);
  });
}

/** Conferma o corregge le ore effettive di un'occorrenza (null = torna a quelle programmate). */
export async function saveActual(ev: CalEvent, date: DateKey, minutes: number | null): Promise<void> {
  await setActual(db, ev.id, date, minutes);
}

export async function toggleDone(ev: CalEvent, date: DateKey): Promise<void> {
  const done = !ev.done.includes(date);
  await setDone(db, ev.id, date, done);
  if (done) void tapFeedback();
}

export async function toggleChecklist(ev: CalEvent, itemId: string): Promise<void> {
  await toggleChecklistItem(db, ev.id, itemId);
}

// ---------- Modelli ----------

/** Salva l'evento come modello da riusare con un tocco. */
export async function saveAsTemplate(ev: CalEvent): Promise<void> {
  const title = ev.title.trim();
  if (!title) {
    showToast('Scrivi prima un titolo: diventa il nome del modello.');
    return;
  }
  const template: Template = {
    id: newId(),
    title,
    allDay: ev.allDay,
    start: ev.start,
    end: ev.endDate === ev.date ? ev.end : 1439,
    location: ev.location,
    categoryId: ev.categoryId,
    color: ev.color,
    alerts: [...ev.alerts],
    order: data.templates.length,
  };
  await putTemplate(db, template);
  showToast(`Modello “${title}” salvato`);
}

export async function removeTemplate(template: Template): Promise<void> {
  await deleteTemplate(db, template.id);
  showUndoToast(`Modello “${template.title}” eliminato`, async () => {
    await putTemplate(db, template);
  });
}

/** Esegue un'azione e mostra un messaggio se qualcosa va storto. */
export function run(action: () => Promise<unknown>, message?: string): void {
  action().catch((e: unknown) => reportError(e, message));
}
