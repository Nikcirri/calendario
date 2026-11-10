// Backup: tutti i dati dell'app in un file, da salvare dove si vuole e da ripristinare.
import type { CalEvent, Category, Settings, Template } from '../types';
import { todayKey } from './dates';
import { sanitizeCategory, sanitizeEvent, sanitizeTemplate } from './model';
import { sanitizeSettings } from './settings';

export const BACKUP_APP = 'calendario';
export const BACKUP_FORMAT = 1;

/** Errore con un messaggio già pensato per chi usa l'app. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export interface BackupData {
  events: CalEvent[];
  categories: Category[];
  templates: Template[];
  settings: Settings | null;
}

export function backupFileName(now: Date = new Date()): string {
  return `calendario-backup-${todayKey(now)}.json`;
}

export function makeBackup(data: BackupData, appVersion: string, now: Date = new Date()): string {
  return JSON.stringify({
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    appVersion,
    exportedAt: now.toISOString(),
    events: data.events,
    categories: data.categories,
    templates: data.templates,
    settings: data.settings,
  });
}

function keepValid<T>(list: unknown, check: (raw: unknown, index: number) => T | null): T[] {
  if (!Array.isArray(list)) return [];
  const out: T[] = [];
  list.forEach((item, i) => {
    const ok = check(item, i);
    if (ok) out.push(ok);
  });
  return out;
}

/** Legge un file di backup. Lancia `BackupError` se il file non è un backup di questa app. */
export function parseBackup(text: string): BackupData {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('Questo file non è un backup del calendario.');
  }
  if (typeof json !== 'object' || json === null) throw new BackupError('Questo file non è un backup del calendario.');
  const r = json as Record<string, unknown>;
  if (r.app !== BACKUP_APP || !Array.isArray(r.events)) throw new BackupError('Questo file non è un backup del calendario.');
  if (typeof r.format === 'number' && r.format > BACKUP_FORMAT) {
    throw new BackupError('Questo backup è stato fatto con una versione più nuova dell’app: aggiorna l’app e riprova.');
  }
  const categories = keepValid(r.categories, sanitizeCategory);
  const known = new Set(categories.map((c) => c.id));
  const events = keepValid(r.events, (raw) => sanitizeEvent(raw)).map((e) =>
    e.categoryId && !known.has(e.categoryId) ? { ...e, categoryId: null } : e,
  );
  const templates = keepValid(r.templates, sanitizeTemplate).map((t) =>
    t.categoryId && !known.has(t.categoryId) ? { ...t, categoryId: null } : t,
  );
  return {
    events,
    categories,
    templates,
    settings: typeof r.settings === 'object' && r.settings !== null ? sanitizeSettings(r.settings) : null,
  };
}
