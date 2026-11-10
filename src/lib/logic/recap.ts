// Recap mensile: ore fatte e programmate per categoria, obiettivi, compenso stimato.
import type { CalEvent, Category, DateKey } from '../types';
import { addDays, endOfMonth, fmtDayShort, fmtTime, parseKey, startOfMonth, startOfWeek, todayKey } from './dates';
import { DEFAULT_COLOR } from './model';
import { countedMinutes, occurrenceEnd, occurrencesStarting, plannedMinutes, type Occurrence } from './occurrences';

export const NO_CATEGORY = 'none';

export interface RecapRow {
  /** Id della categoria, oppure 'none' per gli eventi senza categoria. */
  id: string;
  name: string;
  color: string;
  /** Minuti già fatti (eventi finiti). */
  doneMin: number;
  /** Minuti in tutto il mese: già fatti più ancora da fare. */
  plannedMin: number;
  /** Tetto di ore del mese, in minuti (null = nessuno). */
  goalMin: number | null;
  rate: number | null;
  /** Compenso stimato su tutto il mese e su quanto già fatto (null senza tariffa). */
  pay: number | null;
  payDone: number | null;
}

export interface RecapEntry {
  occ: Occurrence;
  categoryId: string;
  minutes: number;
  done: boolean;
}

export interface RecapWeek {
  from: DateKey;
  to: DateKey;
  /** "2–8" (giorni del mese). */
  label: string;
  current: boolean;
  total: number;
  parts: { id: string; color: string; minutes: number }[];
}

export interface Recap {
  month: DateKey;
  rows: RecapRow[];
  doneMin: number;
  plannedMin: number;
  weeks: RecapWeek[];
  entries: RecapEntry[];
  /** Eventi finiti di cui confermare le ore (solo categorie con tetto o tariffa), dal più recente. */
  toConfirm: Occurrence[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Calcola il recap del mese che contiene `monthKey`. Contano solo gli eventi con orario. */
export function monthRecap(events: readonly CalEvent[], categories: readonly Category[], monthKey: DateKey, now: Date): Recap {
  const from = startOfMonth(monthKey);
  const to = endOfMonth(monthKey);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const timed = events.filter((e) => e.kind === 'event' && !e.allDay && !e.deletedAt);
  const nowMs = now.getTime();

  const entries: RecapEntry[] = occurrencesStarting(timed, from, to).map((occ) => {
    const cat = occ.event.categoryId && byId.has(occ.event.categoryId) ? occ.event.categoryId : NO_CATEGORY;
    return { occ, categoryId: cat, minutes: countedMinutes(occ), done: occurrenceEnd(occ).getTime() <= nowMs };
  });

  const totals = new Map<string, { done: number; planned: number }>();
  for (const e of entries) {
    const t = totals.get(e.categoryId) ?? { done: 0, planned: 0 };
    t.planned += e.minutes;
    if (e.done) t.done += e.minutes;
    totals.set(e.categoryId, t);
  }

  const ordered = [...categories].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'it'));
  const rows: RecapRow[] = [];
  for (const cat of ordered) {
    const t = totals.get(cat.id);
    if (!t && cat.goalHours === null) continue;
    const done = t?.done ?? 0;
    const planned = t?.planned ?? 0;
    rows.push({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      doneMin: done,
      plannedMin: planned,
      goalMin: cat.goalHours === null ? null : Math.round(cat.goalHours * 60),
      rate: cat.hourlyRate,
      pay: cat.hourlyRate === null ? null : round2((planned / 60) * cat.hourlyRate),
      payDone: cat.hourlyRate === null ? null : round2((done / 60) * cat.hourlyRate),
    });
  }
  const none = totals.get(NO_CATEGORY);
  if (none && none.planned > 0) {
    rows.push({
      id: NO_CATEGORY,
      name: 'Senza categoria',
      color: DEFAULT_COLOR,
      doneMin: none.done,
      plannedMin: none.planned,
      goalMin: null,
      rate: null,
      pay: null,
      payDone: null,
    });
  }

  const today = todayKey(now);
  const weeks: RecapWeek[] = [];
  for (let monday = startOfWeek(from); monday <= to; monday = addDays(monday, 7)) {
    const wFrom = monday < from ? from : monday;
    const sunday = addDays(monday, 6);
    const wTo = sunday > to ? to : sunday;
    const perCat = new Map<string, number>();
    for (const e of entries) {
      if (e.occ.date < wFrom || e.occ.date > wTo) continue;
      perCat.set(e.categoryId, (perCat.get(e.categoryId) ?? 0) + e.minutes);
    }
    const parts = rows
      .map((r) => ({ id: r.id, color: r.color, minutes: perCat.get(r.id) ?? 0 }))
      .filter((p) => p.minutes > 0);
    const d1 = parseKey(wFrom).d;
    const d2 = parseKey(wTo).d;
    weeks.push({
      from: wFrom,
      to: wTo,
      label: d1 === d2 ? String(d1) : `${d1}–${d2}`,
      current: today >= wFrom && today <= wTo,
      total: parts.reduce((s, p) => s + p.minutes, 0),
      parts,
    });
  }

  const toConfirm = entries
    .filter((e) => {
      if (!e.done || e.categoryId === NO_CATEGORY) return false;
      if (typeof e.occ.event.actual[e.occ.date] === 'number') return false;
      const cat = byId.get(e.categoryId);
      return !!cat && (cat.goalHours !== null || cat.hourlyRate !== null);
    })
    .map((e) => e.occ)
    .reverse();

  return {
    month: from,
    rows,
    doneMin: entries.reduce((s, e) => s + (e.done ? e.minutes : 0), 0),
    plannedMin: entries.reduce((s, e) => s + e.minutes, 0),
    weeks,
    entries,
    toConfirm,
  };
}

/** La riga da mostrare nella striscia in cima al mese: quella scelta, altrimenti quella con più ore. */
export function stripRow(recap: Recap, preferredId: string | null): RecapRow | null {
  const real = recap.rows.filter((r) => r.id !== NO_CATEGORY && r.plannedMin > 0);
  if (!real.length) return null;
  const chosen = preferredId ? real.find((r) => r.id === preferredId) : undefined;
  return chosen ?? real.reduce((best, r) => (r.plannedMin > best.plannedMin ? r : best));
}

/** Avanzamento da 0 a 1 di una riga: rispetto al tetto se c'è, altrimenti rispetto al totale del mese. */
export function rowProgress(row: RecapRow): number {
  const base = row.goalMin ?? row.plannedMin;
  return base > 0 ? Math.min(1, row.doneMin / base) : 0;
}

/** 96.5 → "96,50 €", 960 → "960 €". */
export function fmtEuro(value: number): string {
  const rounded = round2(value);
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace('.', ',');
  return `${text} €`;
}

function hoursCell(minutes: number): string {
  return (Math.round((minutes / 60) * 100) / 100).toString().replace('.', ',');
}

function csvCell(text: string): string {
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Il recap come tabella per Excel (file CSV con il punto e virgola, come lo apre Excel in italiano):
 * prima il riepilogo per categoria, poi l'elenco di tutti gli eventi del mese.
 */
export function recapCsv(recap: Recap): string {
  const lines: string[] = [];
  lines.push(['Categoria', 'Ore fatte', 'Ore nel mese', 'Tetto ore', 'Tariffa (€/h)', 'Compenso stimato (€)'].join(';'));
  for (const r of recap.rows) {
    lines.push(
      [
        csvCell(r.name),
        hoursCell(r.doneMin),
        hoursCell(r.plannedMin),
        r.goalMin === null ? '' : hoursCell(r.goalMin),
        r.rate === null ? '' : String(r.rate).replace('.', ','),
        r.pay === null ? '' : String(r.pay).replace('.', ','),
      ].join(';'),
    );
  }
  lines.push('');
  lines.push(['Giorno', 'Evento', 'Categoria', 'Inizio', 'Fine', 'Ore', 'Stato'].join(';'));
  const names = new Map(recap.rows.map((r) => [r.id, r.name]));
  const year = parseKey(recap.month).y;
  for (const e of recap.entries) {
    const ev = e.occ.event;
    lines.push(
      [
        fmtDayShort(e.occ.date, year - 1),
        csvCell(ev.title || 'Senza titolo'),
        csvCell(names.get(e.categoryId) ?? ''),
        fmtTime(ev.start),
        fmtTime(ev.end),
        hoursCell(e.minutes),
        e.done ? (plannedMinutes(ev) !== e.minutes ? 'fatto (ore corrette)' : 'fatto') : 'programmato',
      ].join(';'),
    );
  }
  // Il segno iniziale dice a Excel che il file usa le lettere accentate (UTF-8).
  return `﻿${lines.join('\r\n')}\r\n`;
}
