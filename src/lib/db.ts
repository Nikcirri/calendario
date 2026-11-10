import Dexie, { type EntityTable } from 'dexie';
import type { CalEvent, Category, Template } from './types';

export interface KV {
  key: string;
  value: unknown;
}

/** Tutti i dati restano sul telefono, in IndexedDB. */
export class CalendarDB extends Dexie {
  events!: EntityTable<CalEvent, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  templates!: EntityTable<Template, 'id'>;
  kv!: EntityTable<KV, 'key'>;

  constructor(name = 'calendario') {
    super(name);
    this.version(1).stores({
      events: 'id, date',
      categories: 'id',
      templates: 'id',
      kv: 'key',
    });
  }
}

export const db = new CalendarDB();
