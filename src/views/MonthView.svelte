<script lang="ts">
  import { fmtDayLong, fmtHours, monthGrid, monthName, parseKey, weekday, WEEKDAYS_SHORT } from '../lib/logic/dates';
  import { holidayName } from '../lib/logic/holidays';
  import { partsByDay, type DayPart } from '../lib/logic/occurrences';
  import { monthRecap, rowProgress, stripRow } from '../lib/logic/recap';
  import { app, colorOf, data, openPage, selectDay, setView } from '../lib/state/app.svelte';
  import Icon from '../lib/ui/Icon.svelte';

  const MAX_CHIPS = 4;

  const grid = $derived(monthGrid(app.cursor));
  // Se l'ultima riga è tutta del mese dopo non si mostra: le caselle diventano più alte.
  const days = $derived(parseKey(grid[35]!).m === parseKey(app.cursor).m ? grid : grid.slice(0, 35));
  const parts = $derived(partsByDay(data.visible, days[0]!, days[days.length - 1]!));
  const month = $derived(parseKey(app.cursor).m);

  const strip = $derived.by(() => {
    // L'ora attuale è tra le dipendenze: le ore "fatte" avanzano durante la giornata.
    void app.nowMinutes;
    return stripRow(monthRecap(data.events, data.categories, app.cursor, new Date()), app.settings.stripCategoryId);
  });

  interface Chip {
    key: string;
    title: string;
    color: string;
    solid: boolean;
    reminder: boolean;
    done: boolean;
  }

  function toChip(p: DayPart): Chip {
    const ev = p.occ.event;
    return {
      key: p.occ.key,
      title: ev.title || 'Senza titolo',
      color: colorOf(ev),
      solid: ev.allDay && ev.kind === 'event',
      reminder: ev.kind === 'reminder',
      done: ev.kind === 'reminder' && ev.done.includes(p.occ.date),
    };
  }

  const cells = $derived(
    days.map((key) => {
      const list = parts.get(key) ?? [];
      const holiday = app.settings.showHolidays ? holidayName(key) : null;
      const room = holiday ? MAX_CHIPS - 1 : MAX_CHIPS;
      const shown = list.length > room ? list.slice(0, room - 1) : list;
      const inMonth = parseKey(key).m === month;
      const names = list.map((p) => p.occ.event.title || 'Senza titolo');
      const label = [fmtDayLong(key), holiday, names.length ? names.join(', ') : 'nessun impegno'].filter(Boolean).join(', ');
      return {
        key,
        day: parseKey(key).d,
        inMonth,
        isToday: key === app.today,
        selected: key === app.cursor,
        red: weekday(key) === 7 || holiday !== null,
        holiday,
        chips: shown.map(toChip),
        more: list.length - shown.length,
        label,
      };
    }),
  );

  function tapDay(key: string) {
    // Secondo tocco sullo stesso giorno: si apre la giornata con gli orari.
    if (key === app.cursor) setView('day');
    else selectDay(key);
  }
</script>

{#if strip}
  <button class="strip" onclick={() => openPage('recap')}>
    <span class="dot" style:background={strip.color}></span>
    <span class="info">
      <span class="line">
        <span class="name">{strip.name} a {monthName(app.cursor).toLowerCase()}</span>
        <span class="hours num">{fmtHours(strip.doneMin)} di {fmtHours(strip.goalMin ?? strip.plannedMin)} h</span>
      </span>
      <span class="bar"><span class="fill" style:width={`${rowProgress(strip) * 100}%`} style:background={strip.color}></span></span>
    </span>
    <Icon name="chevronRight" size={20} />
  </button>
{/if}

<div class="weekdays" aria-hidden="true">
  {#each WEEKDAYS_SHORT as name, i (name)}
    <div class:red={i === 6}>{name.toUpperCase()}</div>
  {/each}
</div>

<div class="grid" style:grid-template-rows={`repeat(${days.length / 7}, minmax(0, 1fr))`}>
  {#each cells as c (c.key)}
    <button class="cell" class:out={!c.inMonth} class:today={c.isToday} class:selected={c.selected && !c.isToday} aria-label={c.label} aria-pressed={c.selected} onclick={() => tapDay(c.key)}>
      <span class="head">
        {#if c.isToday}
          <span class="number today-pill display">{c.day}</span>
        {:else}
          <span class="number display" class:red={c.red}>{c.day}</span>
        {/if}
      </span>
      {#if c.holiday}
        <span class="holiday">{c.holiday}</span>
      {/if}
      {#each c.chips as chip (chip.key)}
        {#if chip.solid}
          <span class="ev solid" style:background={chip.color}>{chip.title}</span>
        {:else if chip.reminder}
          <span class="ev reminder" class:done={chip.done}><span class="mark" style:background={chip.color}></span>{chip.title}</span>
        {:else}
          <span class="ev" style:background={`${chip.color}55`}>{chip.title}</span>
        {/if}
      {/each}
      {#if c.more > 0}
        <span class="more">+{c.more}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .strip {
    margin: 0 12px 10px;
    height: 52px;
    flex: none;
    padding: 0 10px 0 14px;
    border-radius: 14px;
    background: var(--surface);
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
    color: var(--text-muted);
  }
  .strip .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .strip .line {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    font-size: 0.8125rem;
  }
  .strip .name {
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .strip .hours {
    flex: none;
  }
  .bar {
    display: block;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 4px;
  }
  .weekdays {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 3px;
    padding: 0 8px;
    height: 22px;
    flex: none;
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    text-align: center;
  }
  .red {
    color: var(--sunday);
  }
  .grid {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 3px;
    padding: 0 8px;
  }
  .cell {
    min-width: 0;
    min-height: 0;
    padding: 4px 3px;
    border-radius: 10px;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 3px;
    overflow: hidden;
    text-align: left;
  }
  .cell.out {
    background: #11131c;
  }
  .cell.out .number,
  .cell.out .holiday {
    color: var(--text-dim);
  }
  .cell.out .ev,
  .cell.out .more {
    opacity: 0.45;
  }
  .cell.today {
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }
  .cell.selected {
    box-shadow: inset 0 0 0 1.5px var(--text-dim);
  }
  .head {
    height: 20px;
    flex: none;
    display: flex;
    align-items: center;
    padding: 0 2px;
  }
  .number {
    font-size: 0.8125rem;
    font-weight: 500;
  }
  .today-pill {
    min-width: 22px;
    height: 20px;
    padding: 0 4px;
    border-radius: 7px;
    background: var(--accent);
    color: var(--accent-ink);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
  }
  .holiday {
    flex: none;
    height: 14px;
    padding: 0 2px;
    font-size: 0.5625rem;
    line-height: 14px;
    color: var(--sunday);
    white-space: nowrap;
    overflow: hidden;
  }
  .ev {
    flex: none;
    height: 16px;
    border-radius: 4px;
    padding: 0 3px;
    font-size: 0.625rem;
    line-height: 16px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    color: var(--text);
  }
  .ev.solid {
    font-weight: 600;
    color: #0b0d14;
  }
  .ev.reminder {
    background: var(--surface-2);
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .ev.reminder .mark {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex: none;
  }
  .ev.reminder.done {
    text-decoration: line-through;
    color: var(--text-dim);
  }
  .more {
    flex: none;
    height: 14px;
    padding: 0 3px;
    font-size: 0.625rem;
    line-height: 14px;
    color: var(--text-muted);
  }
</style>
