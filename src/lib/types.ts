// Tipi dei dati dell'app. Le date sono stringhe 'AAAA-MM-GG', gli orari minuti da mezzanotte.

export type DateKey = string;

export type RepeatFreq = 'day' | 'week' | 'month' | 'year';

export type RepeatEnd = { type: 'never' } | { type: 'count'; count: number } | { type: 'until'; date: DateKey };

/** Regola di ripetizione di un evento o promemoria. */
export interface Repeat {
  freq: RepeatFreq;
  /** Ogni quanti giorni / settimane / mesi / anni. */
  interval: number;
  /** Ripetizione settimanale: giorni della settimana (1 = lunedì … 7 = domenica). */
  weekdays: number[];
  /** Mensile: 'day' = stesso giorno del mese, 'weekday' = es. 2° martedì, 'dates' = giorni scelti a mano. */
  monthMode: 'day' | 'weekday' | 'dates';
  monthDays: number[];
  /** Annuale: 'date' = stessa data, 'weekday' = es. 2° martedì di novembre, 'months' = stesso giorno nei mesi scelti. */
  yearMode: 'date' | 'weekday' | 'months';
  yearMonths: number[];
  end: RepeatEnd;
}

export type EventKind = 'event' | 'reminder';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface CalEvent {
  id: string;
  kind: EventKind;
  title: string;
  /** Giorno di inizio (della prima occorrenza, se si ripete). */
  date: DateKey;
  /** Giorno di fine (uguale a `date` se l'evento finisce lo stesso giorno). */
  endDate: DateKey;
  allDay: boolean;
  /** Minuti da mezzanotte (ignorati se `allDay`). Per i promemoria `end` è uguale a `start`. */
  start: number;
  end: number;
  location: string;
  categoryId: string | null;
  /** Colore scelto a mano; se manca si usa quello della categoria. */
  color: string | null;
  /**
   * Avvisi. Eventi con orario: minuti prima dell'inizio (0 = all'ora dell'evento).
   * Tutto il giorno: minuti prima della mezzanotte del giorno (-540 = il giorno stesso alle 9:00).
   */
  alerts: number[];
  repeat: Repeat | null;
  /** Occorrenze eliminate una per una. */
  exdates: DateKey[];
  notes: string;
  checklist: ChecklistItem[];
  /** Ore effettive (in minuti) confermate o corrette, per giorno dell'occorrenza. */
  actual: Record<DateKey, number>;
  /** Promemoria: giorni delle occorrenze segnate come fatte. */
  done: DateKey[];
  /** Nel cestino da questo momento (null = non eliminato). */
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  /** Tetto di ore al mese (null = nessuno). */
  goalHours: number | null;
  /** Tariffa oraria in euro (null = nessuna). */
  hourlyRate: number | null;
  order: number;
}

/** Modello di evento: si inserisce con un tocco. */
export interface Template {
  id: string;
  title: string;
  allDay: boolean;
  start: number;
  end: number;
  location: string;
  categoryId: string | null;
  color: string | null;
  alerts: number[];
  order: number;
}

export type ViewId = 'year' | 'month' | 'week' | 'day' | 'agenda';

export interface UpdateState {
  lastCheck: string | null;
  latestVersion: string | null;
  apkUrl: string | null;
  pageUrl: string | null;
}

export interface Settings {
  view: ViewId;
  /** Avviso predefinito dei nuovi eventi con orario (minuti prima; vuoto = nessuno). */
  defaultAlerts: number[];
  /** Mostra le festività italiane. */
  showHolidays: boolean;
  /** Notifiche degli avvisi attive. */
  notifications: boolean;
  /** Categoria mostrata nella striscia in cima al mese (null = quella con più ore). */
  stripCategoryId: string | null;
  updates: UpdateState;
}
