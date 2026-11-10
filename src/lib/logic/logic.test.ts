import { describe, expect, it } from 'vitest';
import type { CalEvent, Category, Repeat } from '../types';
import { BackupError, makeBackup, parseBackup } from './backup';
import {
  addDays,
  addMonths,
  diffDays,
  fmtDayLong,
  fmtDayShort,
  fmtDuration,
  fmtMonthYear,
  fmtTime,
  isDateKey,
  monthGrid,
  nthWeekdayOfMonth,
  parseTime,
  startOfWeek,
  weekday,
  weekdayOrdinal,
} from './dates';
import { easterSunday, holidayName } from './holidays';
import { alertLabel, alertsSummary, blankEvent, defaultCategories, sanitizeEvent, suggestedStart } from './model';
import { hashId, planAlerts } from './notify';
import { findOverlaps, layoutTimed, matchesQuery, partsByDay, plannedMinutes } from './occurrences';
import { parseQuickAdd } from './quickadd';
import { fmtEuro, monthRecap, recapCsv, stripRow } from './recap';
import { defaultRepeat, nextOccurrenceDate, normalizeRepeat, occurrenceDates, repeatSummary } from './recurrence';
import { defaultSettings, sanitizeSettings } from './settings';
import { isNewer, parseRelease, releaseNotes, shouldAutoCheck } from './updates';

const TODAY = '2026-11-10'; // martedì

function ev(over: Partial<CalEvent> = {}): CalEvent {
  return { ...blankEvent('event', TODAY, 9 * 60, new Date(2026, 10, 1)), title: 'Prova', ...over };
}

function rep(over: Partial<Repeat>, start = TODAY): Repeat {
  return { ...defaultRepeat(over.freq ?? 'day', start), ...over };
}

describe('date', () => {
  it('conosce i giorni della settimana', () => {
    expect(weekday('2026-11-10')).toBe(2);
    expect(weekday('2026-11-15')).toBe(7);
    expect(weekday('1970-01-01')).toBe(4);
    expect(weekday('2024-02-29')).toBe(4);
    expect(startOfWeek('2026-11-15')).toBe('2026-11-09');
    expect(startOfWeek('2026-11-09')).toBe('2026-11-09');
  });

  it('somma giorni e mesi', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30'); // cambio dell'ora: nessun giorno saltato
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(diffDays('2026-11-10', '2026-12-25')).toBe(45);
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-10', 2)).toBe('2027-01-10');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('costruisce la griglia del mese da lunedì', () => {
    const grid = monthGrid('2026-11-10');
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-10-26');
    expect(grid[6]).toBe('2026-11-01');
    expect(grid[41]).toBe('2026-12-06');
  });

  it('scrive date e orari in italiano', () => {
    expect(fmtTime(510)).toBe('08:30');
    expect(fmtTime(0)).toBe('00:00');
    expect(parseTime('08:30')).toBe(510);
    expect(parseTime('25:00')).toBeNull();
    expect(fmtDuration(375)).toBe('6 h 15 min');
    expect(fmtDuration(360)).toBe('6 h');
    expect(fmtDuration(45)).toBe('45 min');
    expect(fmtDayLong('2026-11-10')).toBe('martedì 10 novembre');
    expect(fmtDayShort('2026-11-10')).toBe('mar 10 nov');
    expect(fmtDayShort('2027-01-05', 2026)).toBe('mar 5 gen 2027');
    expect(fmtMonthYear('2026-11-10')).toBe('Novembre 2026');
  });

  it('riconosce le date valide', () => {
    expect(isDateKey('2026-02-28')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-2-3')).toBe(false);
    expect(isDateKey(20261110)).toBe(false);
  });

  it('trova il n-esimo giorno della settimana nel mese', () => {
    expect(weekdayOrdinal('2026-11-10')).toBe(2);
    expect(nthWeekdayOfMonth(2026, 11, 2, 2)).toBe('2026-11-10');
    expect(nthWeekdayOfMonth(2026, 12, 2, 2)).toBe('2026-12-08');
    expect(nthWeekdayOfMonth(2026, 11, 1, 5)).toBe('2026-11-30'); // 5° lunedì
    expect(nthWeekdayOfMonth(2026, 12, 1, 5)).toBe('2026-12-28'); // dicembre ha solo 4 lunedì: l'ultimo
  });
});

describe('ripetizioni', () => {
  it('senza ripetizione restituisce solo il giorno di inizio', () => {
    expect(occurrenceDates(TODAY, null, '2026-11-01', '2026-11-30')).toEqual([TODAY]);
    expect(occurrenceDates(TODAY, null, '2026-11-11', '2026-11-30')).toEqual([]);
  });

  it('ogni N giorni', () => {
    expect(occurrenceDates(TODAY, rep({ freq: 'day' }), '2026-11-10', '2026-11-13')).toEqual([
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
    ]);
    expect(occurrenceDates(TODAY, rep({ freq: 'day', interval: 3 }), '2026-11-01', '2026-11-20')).toEqual([
      '2026-11-10',
      '2026-11-13',
      '2026-11-16',
      '2026-11-19',
    ]);
    // Molto avanti nel tempo: il calcolo salta direttamente vicino all'intervallo.
    expect(occurrenceDates(TODAY, rep({ freq: 'day', interval: 3 }), '2036-11-01', '2036-11-05')).toEqual(['2036-11-02', '2036-11-05']);
  });

  it('ogni settimana in più giorni', () => {
    const r = rep({ freq: 'week', weekdays: [1, 2, 3, 4] });
    expect(occurrenceDates(TODAY, r, '2026-11-09', '2026-11-22')).toEqual([
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
    ]);
  });

  it('ogni 2 settimane', () => {
    const r = rep({ freq: 'week', interval: 2 });
    expect(occurrenceDates(TODAY, r, '2026-11-01', '2026-12-31')).toEqual(['2026-11-10', '2026-11-24', '2026-12-08', '2026-12-22']);
  });

  it('ogni mese lo stesso giorno, saltando i mesi che non ce l’hanno', () => {
    const r = rep({ freq: 'month' }, '2026-01-31');
    expect(occurrenceDates('2026-01-31', r, '2026-01-01', '2026-06-30')).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
  });

  it('ogni mese il 2° martedì', () => {
    const r = rep({ freq: 'month', monthMode: 'weekday' });
    expect(occurrenceDates(TODAY, r, '2026-11-01', '2027-02-28')).toEqual(['2026-11-10', '2026-12-08', '2027-01-12', '2027-02-09']);
  });

  it('ogni mese in date scelte', () => {
    const r = rep({ freq: 'month', monthMode: 'dates', monthDays: [1, 10, 20] });
    expect(occurrenceDates(TODAY, r, '2026-11-01', '2026-12-15')).toEqual(['2026-11-10', '2026-11-20', '2026-12-01', '2026-12-10']);
  });

  it('ogni anno: stessa data, 29 febbraio, giorno della settimana, mesi scelti', () => {
    expect(occurrenceDates(TODAY, rep({ freq: 'year' }), '2026-01-01', '2028-12-31')).toEqual(['2026-11-10', '2027-11-10', '2028-11-10']);
    const leap = rep({ freq: 'year' }, '2024-02-29');
    expect(occurrenceDates('2024-02-29', leap, '2024-01-01', '2032-12-31')).toEqual(['2024-02-29', '2028-02-29', '2032-02-29']);
    const wd = rep({ freq: 'year', yearMode: 'weekday' });
    expect(occurrenceDates(TODAY, wd, '2026-01-01', '2028-12-31')).toEqual(['2026-11-10', '2027-11-09', '2028-11-14']);
    const months = rep({ freq: 'year', yearMode: 'months', yearMonths: [1, 6, 11] });
    expect(occurrenceDates(TODAY, months, '2026-01-01', '2027-12-31')).toEqual(['2026-11-10', '2027-01-10', '2027-06-10', '2027-11-10']);
  });

  it('rispetta "numero di volte" e "fino al"', () => {
    const count = rep({ freq: 'day', end: { type: 'count', count: 3 } });
    expect(occurrenceDates(TODAY, count, '2026-11-01', '2026-12-31')).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
    expect(occurrenceDates(TODAY, count, '2026-11-12', '2026-12-31')).toEqual(['2026-11-12']);
    expect(occurrenceDates(TODAY, count, '2026-11-13', '2026-12-31')).toEqual([]);
    const until = rep({ freq: 'week', end: { type: 'until', date: '2026-11-24' } });
    expect(occurrenceDates(TODAY, until, '2026-11-01', '2026-12-31')).toEqual(['2026-11-10', '2026-11-17', '2026-11-24']);
  });

  it('salta le occorrenze eliminate, che però contano nel numero di volte', () => {
    const count = rep({ freq: 'day', end: { type: 'count', count: 3 } });
    expect(occurrenceDates(TODAY, count, '2026-11-01', '2026-12-31', ['2026-11-11'])).toEqual(['2026-11-10', '2026-11-12']);
  });

  it('trova la prossima occorrenza', () => {
    expect(nextOccurrenceDate(TODAY, rep({ freq: 'year' }), '2026-11-11')).toBe('2027-11-10');
    expect(nextOccurrenceDate(TODAY, null, '2026-11-11')).toBeNull();
    const ended = rep({ freq: 'day', end: { type: 'count', count: 2 } });
    expect(nextOccurrenceDate(TODAY, ended, '2026-11-12')).toBeNull();
  });

  it('tiene sempre il giorno di inizio tra quelli scelti', () => {
    const r = normalizeRepeat(rep({ freq: 'week', weekdays: [5], interval: 0 }), TODAY);
    expect(r.weekdays).toEqual([2, 5]);
    expect(r.interval).toBe(1);
  });

  it('descrive la ripetizione', () => {
    expect(repeatSummary(null, TODAY)).toBe('Non ripetere');
    expect(repeatSummary(rep({ freq: 'day' }), TODAY)).toBe('Ogni giorno');
    expect(repeatSummary(rep({ freq: 'week', weekdays: [1, 3] }), TODAY)).toBe('Ogni settimana, lun e mer');
    expect(repeatSummary(rep({ freq: 'month', monthMode: 'weekday' }), TODAY)).toBe('Ogni mese, 2° martedì');
    expect(repeatSummary(rep({ freq: 'year' }), TODAY)).toBe('Ogni anno, il 10 novembre');
    expect(repeatSummary(rep({ freq: 'day', interval: 2, end: { type: 'count', count: 5 } }), TODAY)).toBe('Ogni 2 giorni, 5 volte');
    expect(repeatSummary(rep({ freq: 'week', end: { type: 'until', date: '2026-12-24' } }), TODAY)).toBe('Ogni settimana, mar, fino al 24 dic 2026');
  });
});

describe('occorrenze', () => {
  it('distribuisce gli eventi sui giorni, in ordine', () => {
    const events = [
      ev({ id: 'a', title: 'Tirocinio', start: 510, end: 870, repeat: rep({ freq: 'week', weekdays: [1, 2, 3, 4] }) }),
      ev({ id: 'b', title: 'Pulizia strade', allDay: true, date: '2026-11-09', endDate: '2026-11-09' }),
      ev({ id: 'c', title: 'Calcetto', date: '2026-11-12', endDate: '2026-11-12', start: 1080, end: 1140 }),
      ev({ id: 'd', title: 'Cestinato', deletedAt: '2026-11-01T00:00:00.000Z' }),
    ];
    const map = partsByDay(events, '2026-11-09', '2026-11-15');
    expect([...map.keys()]).toHaveLength(7);
    expect(map.get('2026-11-09')!.map((p) => p.occ.event.title)).toEqual(['Pulizia strade']);
    expect(map.get('2026-11-10')!.map((p) => p.occ.event.title)).toEqual(['Tirocinio']);
    expect(map.get('2026-11-12')!.map((p) => p.occ.event.title)).toEqual(['Tirocinio', 'Calcetto']);
    expect(map.get('2026-11-13')).toEqual([]);
  });

  it('spezza gli eventi di più giorni', () => {
    const trip = ev({ id: 't', title: 'Viaggio', date: '2026-11-13', endDate: '2026-11-15', start: 600, end: 1080 });
    const map = partsByDay([trip], '2026-11-09', '2026-11-15');
    const fri = map.get('2026-11-13')![0]!;
    const sat = map.get('2026-11-14')![0]!;
    const sun = map.get('2026-11-15')![0]!;
    expect([fri.start, fri.end, fri.allDay]).toEqual([600, 1440, false]);
    expect([sat.start, sat.end, sat.allDay]).toEqual([0, 1440, true]);
    expect([sun.start, sun.end, sun.allDay]).toEqual([0, 1080, false]);
    expect(plannedMinutes(trip)).toBe(2 * 1440 + 480);
    // Un evento iniziato prima dell'intervallo compare lo stesso nei giorni che tocca.
    expect(partsByDay([trip], '2026-11-14', '2026-11-14').get('2026-11-14')).toHaveLength(1);
  });

  it('un evento che finisce a mezzanotte non occupa il giorno dopo', () => {
    const night = ev({ id: 'n', date: '2026-11-13', endDate: '2026-11-14', start: 1320, end: 0 });
    const map = partsByDay([night], '2026-11-13', '2026-11-14');
    expect(map.get('2026-11-13')).toHaveLength(1);
    expect(map.get('2026-11-14')).toHaveLength(0);
  });

  it('affianca gli eventi che si sovrappongono', () => {
    const events = [
      ev({ id: 'a', start: 540, end: 660 }),
      ev({ id: 'b', start: 600, end: 720 }),
      ev({ id: 'c', start: 780, end: 840 }),
    ];
    const blocks = layoutTimed(partsByDay(events, TODAY, TODAY).get(TODAY)!);
    const byId = new Map(blocks.map((b) => [b.part.occ.event.id, b]));
    expect([byId.get('a')!.col, byId.get('a')!.cols]).toEqual([0, 2]);
    expect([byId.get('b')!.col, byId.get('b')!.cols]).toEqual([1, 2]);
    expect([byId.get('c')!.col, byId.get('c')!.cols]).toEqual([0, 1]);
  });

  it('trova le sovrapposizioni', () => {
    const work = ev({ id: 'w', title: 'Tirocinio', start: 510, end: 870, repeat: rep({ freq: 'week', weekdays: [1, 2, 3, 4] }) });
    const others = [work, ev({ id: 'x', title: 'Tutto il giorno', allDay: true }), ev({ id: 'r', kind: 'reminder', start: 840, end: 840 })];
    const candidate = ev({ id: 'new', start: 840, end: 900 });
    expect(findOverlaps(others, candidate).map((o) => o.event.title)).toEqual(['Tirocinio']);
    expect(findOverlaps(others, ev({ id: 'new', start: 870, end: 930 }))).toEqual([]);
    expect(findOverlaps(others, ev({ id: 'new', date: '2026-11-13', endDate: '2026-11-13', start: 840, end: 900 }))).toEqual([]);
  });

  it('cerca senza badare a maiuscole e accenti', () => {
    const e = ev({ title: 'Caffè con Marta', location: 'Bar Centrale' });
    expect(matchesQuery(e, 'caffe')).toBe(true);
    expect(matchesQuery(e, 'CENTRALE')).toBe(true);
    expect(matchesQuery(e, 'pizza')).toBe(false);
    expect(matchesQuery(e, '  ')).toBe(false);
  });
});

describe('recap', () => {
  const cats: Category[] = [
    { id: 'lav', name: 'Lavoro', color: '#3987e5', goalHours: 100, hourlyRate: 10, order: 0 },
    { id: 'spo', name: 'Sport', color: '#199e70', goalHours: null, hourlyRate: null, order: 1 },
  ];
  const events = [
    // Tirocinio 08:30–14:30 da lunedì a giovedì per tutto novembre: 16 giorni da 6 ore.
    ev({
      id: 'tir',
      title: 'Tirocinio',
      categoryId: 'lav',
      date: '2026-11-02',
      endDate: '2026-11-02',
      start: 510,
      end: 870,
      repeat: rep({ freq: 'week', weekdays: [1, 2, 3, 4], end: { type: 'until', date: '2026-11-30' } }, '2026-11-02'),
    }),
    ev({ id: 'cal', title: 'Calcetto', categoryId: 'spo', date: '2026-11-05', endDate: '2026-11-05', start: 1080, end: 1140, repeat: rep({ freq: 'week' }, '2026-11-05') }),
    ev({ id: 'free', title: 'Dentista', date: '2026-11-20', endDate: '2026-11-20', start: 600, end: 660 }),
    ev({ id: 'all', title: 'Ferie', categoryId: 'lav', allDay: true }),
  ];
  // Martedì 10 novembre alle 13:00: il tirocinio di oggi non è ancora finito.
  const now = new Date(2026, 10, 10, 13, 0);

  it('somma ore fatte e programmate per categoria', () => {
    const recap = monthRecap(events, cats, TODAY, now);
    const lav = recap.rows.find((r) => r.id === 'lav')!;
    expect(lav.plannedMin).toBe(17 * 360);
    expect(lav.doneMin).toBe(5 * 360);
    expect(lav.goalMin).toBe(6000);
    expect(lav.pay).toBe(1020);
    expect(lav.payDone).toBe(300);
    const spo = recap.rows.find((r) => r.id === 'spo')!;
    expect(spo.plannedMin).toBe(4 * 60);
    expect(spo.doneMin).toBe(60);
    expect(recap.rows.at(-1)!.name).toBe('Senza categoria');
    expect(recap.plannedMin).toBe(17 * 360 + 240 + 60);
    expect(stripRow(recap, null)!.id).toBe('lav');
    expect(stripRow(recap, 'spo')!.id).toBe('spo');
  });

  it('divide il mese in settimane', () => {
    const recap = monthRecap(events, cats, TODAY, now);
    expect(recap.weeks.map((w) => w.label)).toEqual(['1', '2–8', '9–15', '16–22', '23–29', '30']);
    expect(recap.weeks[2]!.current).toBe(true);
    expect(recap.weeks[1]!.total).toBe(4 * 360 + 60);
    expect(recap.weeks[5]!.total).toBe(360);
  });

  it('usa le ore corrette a mano e chiede conferma di quelle finite', () => {
    const recap = monthRecap(events, cats, TODAY, now);
    expect(recap.toConfirm.map((o) => o.date)).toEqual(['2026-11-09', '2026-11-05', '2026-11-04', '2026-11-03', '2026-11-02']);
    const fixed = events.map((e) => (e.id === 'tir' ? { ...e, actual: { '2026-11-09': 300 } } : e));
    const again = monthRecap(fixed, cats, TODAY, now);
    expect(again.rows.find((r) => r.id === 'lav')!.doneMin).toBe(4 * 360 + 300);
    expect(again.toConfirm.map((o) => o.date)).not.toContain('2026-11-09');
  });

  it('prepara la tabella per Excel', () => {
    const csv = recapCsv(monthRecap(events, cats, TODAY, now));
    expect(csv.startsWith('﻿Categoria;Ore fatte;Ore nel mese')).toBe(true);
    expect(csv).toContain('Lavoro;30;102;100;10;1020');
    expect(csv).toContain('lun 2 nov 2026;Tirocinio;Lavoro;08:30;14:30;6;fatto');
    expect(fmtEuro(960)).toBe('960 €');
    expect(fmtEuro(96.5)).toBe('96,50 €');
  });
});

describe('inserimento rapido', () => {
  const q = (text: string, base = TODAY) => parseQuickAdd(text, base, TODAY);

  it('capisce giorno e orario', () => {
    expect(q('Cena con Marco domani alle 20')).toMatchObject({ title: 'Cena con Marco', date: '2026-11-11', allDay: false, start: 1200, end: 1260 });
    expect(q('dentista giovedì ore 9:30')).toMatchObject({ title: 'Dentista', date: '2026-11-12', start: 570, end: 630 });
    expect(q('Calcetto dalle 18 alle 19:30')).toMatchObject({ title: 'Calcetto', date: TODAY, start: 1080, end: 1170, hasDate: false });
    expect(q('riunione 12/11 15:00-16:30')).toMatchObject({ title: 'Riunione', date: '2026-11-12', start: 900, end: 990 });
    expect(q('Alle 8 e mezza colazione')).toMatchObject({ title: 'Colazione', start: 510 });
    expect(q('pranzo a mezzogiorno')).toMatchObject({ title: 'Pranzo', start: 720 });
  });

  it('capisce le date scritte in tanti modi', () => {
    expect(q('Compleanno di Marta il 22')).toMatchObject({ title: 'Compleanno di Marta', date: '2026-11-22', allDay: true });
    expect(q('Visita il 5')).toMatchObject({ date: '2026-12-05' });
    expect(q('Revisione auto 7 novembre')).toMatchObject({ title: 'Revisione auto', date: '2027-11-07' });
    expect(q('Esame 15 gen 2027')).toMatchObject({ title: 'Esame', date: '2027-01-15' });
    expect(q('Saldi tra 2 settimane')).toMatchObject({ title: 'Saldi', date: '2026-11-24' });
    expect(q('spesa dopodomani')).toMatchObject({ title: 'Spesa', date: '2026-11-12' });
    expect(q('pilates martedì')).toMatchObject({ date: TODAY });
    expect(q('pilates martedì prossimo')).toMatchObject({ date: '2026-11-17' });
    expect(q('Lezione lunedi alle 10')).toMatchObject({ title: 'Lezione', date: '2026-11-16', start: 600 });
  });

  it('capisce sera, pomeriggio e durata', () => {
    expect(q('pizza stasera alle 8')).toMatchObject({ title: 'Pizza', date: TODAY, start: 1200 });
    expect(q('studio domani pomeriggio dalle 3 alle 5')).toMatchObject({ title: 'Studio', date: '2026-11-11', start: 900, end: 1020 });
    expect(q('palestra alle 18 per 2 ore')).toMatchObject({ title: 'Palestra', start: 1080, end: 1200 });
    expect(q('Turno di notte dalle 22 alle 6')).toMatchObject({ title: 'Turno di notte', start: 1320, end: 360, endDate: '2026-11-11' });
    expect(q('aperitivo alle 7 di sera')).toMatchObject({ title: 'Aperitivo', start: 1140, end: 1200 });
    expect(q('corsa alle 7 di mattina')).toMatchObject({ title: 'Corsa', start: 420 });
  });

  it('senza giorno usa quello scelto, senza orario è tutto il giorno', () => {
    expect(q('Comprare il latte', '2026-11-20')).toMatchObject({ title: 'Comprare il latte', date: '2026-11-20', allDay: true, hasDate: false, hasTime: false });
    expect(q('domani alle 20').title).toBe('');
    expect(q('Volo 30/02')).toMatchObject({ title: 'Volo 30/02', allDay: true });
  });
});

describe('festività', () => {
  it('calcola Pasqua', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
    expect(easterSunday(2025)).toBe('2025-04-20');
  });

  it('conosce le feste italiane', () => {
    expect(holidayName('2026-04-06')).toBe('Lunedì dell’Angelo');
    expect(holidayName('2026-12-25')).toBe('Natale');
    expect(holidayName('2026-10-04')).toBe('San Francesco');
    expect(holidayName('2025-10-04')).toBeNull();
    expect(holidayName('2026-11-10')).toBeNull();
  });
});

describe('avvisi', () => {
  const now = new Date(2026, 10, 10, 13, 0);

  it('programma solo gli avvisi futuri, in ordine', () => {
    const events = [
      ev({ id: 'a', title: 'Calcetto', location: 'Campo 3', date: '2026-11-12', endDate: '2026-11-12', start: 1080, end: 1140, alerts: [30, 1440] }),
      ev({ id: 'b', title: 'Passato', start: 600, end: 660, alerts: [30] }),
      ev({ id: 'c', title: 'Bolletta', kind: 'reminder', start: 1020, end: 1020, alerts: [0] }),
      ev({ id: 'd', title: 'Compleanno Marta', allDay: true, date: '2026-11-22', endDate: '2026-11-22', alerts: [-540, 900] }),
      ev({ id: 'e', title: 'Cestinato', date: '2026-11-12', endDate: '2026-11-12', alerts: [0], deletedAt: 'x' }),
    ];
    const plan = planAlerts(events, now);
    expect(plan.map((p) => [p.title, new Date(p.at).toISOString()])).toEqual([
      ['Bolletta', new Date(2026, 10, 10, 17, 0).toISOString()],
      ['Calcetto', new Date(2026, 10, 11, 18, 0).toISOString()],
      ['Calcetto', new Date(2026, 10, 12, 17, 30).toISOString()],
      ['Compleanno Marta', new Date(2026, 10, 21, 9, 0).toISOString()],
      ['Compleanno Marta', new Date(2026, 10, 22, 9, 0).toISOString()],
    ]);
    expect(plan[0]!.body).toBe('Oggi alle 17:00');
    expect(plan[1]!.body).toBe('Domani, 18:00 – 19:00 · Campo 3');
    expect(plan[2]!.body).toBe('Oggi, 18:00 – 19:00 · Campo 3');
    expect(plan[3]!.body).toBe('Domani, tutto il giorno');
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });

  it('segue le ripetizioni, salta i promemoria fatti e rispetta il limite', () => {
    const daily = ev({ id: 'r', kind: 'reminder', title: 'Pastiglia', start: 480, end: 480, alerts: [0], repeat: rep({ freq: 'day' }), done: ['2026-11-11'] });
    const plan = planAlerts([daily], now, { horizonDays: 5 });
    expect(plan.map((p) => p.date)).toEqual(['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
    expect(planAlerts([daily], now, { max: 10 })).toHaveLength(10);
  });

  it('crea numeri di notifica validi per Android', () => {
    for (const text of ['a', 'evento|2026-11-10|30', 'x'.repeat(200)]) {
      const id = hashId(text);
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThan(0);
      expect(id).toBeLessThanOrEqual(2_147_483_647);
    }
    expect(hashId('a|2026-11-10|30')).not.toBe(hashId('a|2026-11-10|0'));
  });

  it('descrive gli avvisi', () => {
    expect(alertLabel(30, false)).toBe('30 minuti prima');
    expect(alertLabel(-540, true)).toBe('Il giorno stesso alle 9:00');
    expect(alertLabel(45, false)).toBe('45 minuti prima');
    expect(alertsSummary([1440, 30], false)).toBe('30 min prima, 1 giorno prima');
    expect(alertsSummary([], false)).toBe('Nessuno');
  });
});

describe('aggiornamenti', () => {
  it('confronta le versioni', () => {
    expect(isNewer('0.2.0', '0.1.9')).toBe(true);
    expect(isNewer('v1.0.0', '0.9.9')).toBe(true);
    expect(isNewer('0.1.0', '0.1.0')).toBe(false);
    expect(isNewer('abc', '0.1.0')).toBe(false);
  });

  it('legge la Release di GitHub', () => {
    const release = parseRelease({
      tag_name: 'v0.2.0',
      html_url: 'https://github.com/Nikcirri/calendario/releases/tag/v0.2.0',
      body: '- Novità **uno**\n- Novità due\n\n### Come installare\ntesto',
      assets: [{ name: 'Calendario-v0.2.0.apk', browser_download_url: 'https://github.com/Nikcirri/calendario/releases/download/v0.2.0/Calendario-v0.2.0.apk' }],
    });
    expect(release).toMatchObject({ version: '0.2.0', notes: ['Novità uno', 'Novità due'] });
    expect(release!.apkUrl).toContain('/releases/download/v0.2.0/');
    expect(parseRelease({ tag_name: 'boh' })).toBeNull();
    expect(releaseNotes('niente elenco')).toEqual([]);
  });

  it('controlla al massimo ogni 10 minuti', () => {
    const now = new Date('2026-11-10T12:00:00Z');
    expect(shouldAutoCheck(null, now)).toBe(true);
    expect(shouldAutoCheck('2026-11-10T11:55:00Z', now)).toBe(false);
    expect(shouldAutoCheck('2026-11-10T11:49:00Z', now)).toBe(true);
  });
});

describe('dati e backup', () => {
  it('propone un orario di partenza sensato', () => {
    expect(suggestedStart('2026-11-12', TODAY, 600)).toBe(540);
    expect(suggestedStart(TODAY, TODAY, 13 * 60 + 5)).toBe(14 * 60);
    expect(suggestedStart(TODAY, TODAY, 23 * 60 + 30)).toBe(23 * 60);
  });

  it('scarta o sistema i dati non validi', () => {
    expect(sanitizeEvent({ id: '', date: TODAY })).toBeNull();
    expect(sanitizeEvent({ id: 'x', date: '2026-13-01' })).toBeNull();
    const fixed = sanitizeEvent({ id: 'x', date: TODAY, endDate: '2026-11-01', start: 600, end: 500, color: 'rosso', alerts: [30, 'a', 30], kind: 'boh' })!;
    expect(fixed).toMatchObject({ kind: 'event', endDate: TODAY, start: 600, end: 600, color: null, alerts: [30], title: '' });
    const reminder = sanitizeEvent({ id: 'r', kind: 'reminder', date: TODAY, endDate: '2026-11-12', start: 600, end: 700 })!;
    expect(reminder).toMatchObject({ endDate: TODAY, end: 600 });
  });

  it('salva e rilegge un backup', () => {
    const categories = defaultCategories();
    const events = [
      ev({ id: 'a', categoryId: categories[0]!.id, repeat: rep({ freq: 'week', weekdays: [1, 2] }), checklist: [{ id: 'k', text: 'Portare i documenti', done: false }] }),
      ev({ id: 'b', categoryId: 'sparita' }),
    ];
    const text = makeBackup({ events, categories, templates: [], settings: defaultSettings() }, '0.1.0', new Date(2026, 10, 10));
    const back = parseBackup(text);
    expect(back.events).toHaveLength(2);
    expect(back.events[0]).toEqual(events[0]);
    expect(back.events[1]!.categoryId).toBeNull();
    expect(back.categories).toEqual(categories);
    expect(back.settings).toEqual(defaultSettings());
  });

  it('rifiuta i file che non sono backup', () => {
    expect(() => parseBackup('ciao')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"altro","events":[]}')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"calendario","format":99,"events":[]}')).toThrow(/più nuova/);
  });

  it('sistema le impostazioni salvate', () => {
    expect(sanitizeSettings(null)).toEqual(defaultSettings());
    expect(sanitizeSettings({ view: 'boh', defaultAlerts: [15, -3, 'x'], notifications: false })).toMatchObject({
      view: 'month',
      defaultAlerts: [15],
      notifications: false,
    });
  });
});
