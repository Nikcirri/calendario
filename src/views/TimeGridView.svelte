<script lang="ts">
  import { onMount } from 'svelte';
  import { startNewEvent } from '../lib/actions';
  import { fmtDayLong, fmtTime, parseKey, weekDays, weekday, WEEKDAYS_SHORT } from '../lib/logic/dates';
  import { holidayName } from '../lib/logic/holidays';
  import { layoutTimed, partsByDay, type DayPart } from '../lib/logic/occurrences';
  import { app, colorOf, data, selectDay, setView, sheets } from '../lib/state/app.svelte';

  let { mode }: { mode: 'week' | 'day' } = $props();

  /** Altezza di un'ora nella griglia, in pixel. */
  const HOUR = 56;
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const MAX_ALLDAY = 3;

  let scroller = $state<HTMLElement | null>(null);

  const days = $derived(mode === 'week' ? weekDays(app.cursor) : [app.cursor]);
  const parts = $derived(partsByDay(data.visible, days[0]!, days[days.length - 1]!));

  const columns = $derived(
    days.map((key) => {
      const list = parts.get(key) ?? [];
      const allDay = list.filter((p) => p.allDay);
      const holiday = app.settings.showHolidays ? holidayName(key) : null;
      return {
        key,
        day: parseKey(key).d,
        name: WEEKDAYS_SHORT[weekday(key) - 1]!.toUpperCase(),
        isToday: key === app.today,
        selected: key === app.cursor,
        red: weekday(key) === 7 || holiday !== null,
        holiday,
        allDay: allDay.slice(0, allDay.length > MAX_ALLDAY ? MAX_ALLDAY - 1 : MAX_ALLDAY),
        allDayMore: allDay.length > MAX_ALLDAY ? allDay.length - (MAX_ALLDAY - 1) : 0,
        blocks: layoutTimed(list),
      };
    }),
  );
  const hasAllDay = $derived(columns.some((c) => c.allDay.length > 0 || c.holiday));
  const showsToday = $derived(days.includes(app.today));
  const nowTop = $derived((app.nowMinutes / 60) * HOUR);

  function open(p: DayPart) {
    sheets.detail = { id: p.occ.event.id, date: p.occ.date };
  }

  /** Tocco su un punto vuoto della giornata: nuovo evento a quell'ora (arrotondata alla mezz'ora). */
  function tapEmpty(e: MouseEvent, day: string) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const minutes = Math.floor((((e.clientY - rect.top) / HOUR) * 60) / 30) * 30;
    selectDay(day);
    startNewEvent(day, Math.min(23 * 60, Math.max(0, minutes)));
  }

  function tapHeader(day: string) {
    if (mode === 'week' && day === app.cursor) setView('day');
    else selectDay(day);
  }

  function blockLabel(p: DayPart): string {
    const ev = p.occ.event;
    const time = ev.kind === 'reminder' ? fmtTime(p.start) : `${fmtTime(p.start)} – ${fmtTime(p.end)}`;
    return `${ev.title || 'Senza titolo'}, ${time}`;
  }

  onMount(() => {
    // Si parte un'ora e mezza prima di adesso (oppure dalle 7:00 se non si guarda oggi).
    const from = days.includes(app.today) ? Math.max(0, app.nowMinutes - 90) : 7 * 60;
    scroller?.scrollTo({ top: (from / 60) * HOUR });
  });
</script>

<div class="head" class:single={mode === 'day'}>
  <div class="gutter"></div>
  {#each columns as c (c.key)}
    <button class="dayhead" class:selected={c.selected && mode === 'week'} aria-label={fmtDayLong(c.key)} aria-pressed={c.selected} onclick={() => tapHeader(c.key)}>
      <span class="name" class:red={c.red}>{c.name}</span>
      <span class="number display" class:today={c.isToday} class:red={c.red && !c.isToday}>{c.day}</span>
    </button>
  {/each}
</div>

{#if hasAllDay}
  <div class="allday" class:single={mode === 'day'}>
    <div class="gutter"></div>
    {#each columns as c (c.key)}
      <div class="col">
        {#if c.holiday}
          <span class="holiday">{c.holiday}</span>
        {/if}
        {#each c.allDay as p (p.occ.key)}
          <button class="adchip" style:--c={colorOf(p.occ.event)} onclick={() => open(p)}>
            {p.occ.event.title || 'Senza titolo'}
          </button>
        {/each}
        {#if c.allDayMore > 0}
          <button class="more" onclick={() => tapHeader(c.key)}>+{c.allDayMore}</button>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<div class="scroll" bind:this={scroller}>
  <div class="grid" class:single={mode === 'day'} style:height={`${24 * HOUR}px`}>
    <div class="hours" aria-hidden="true">
      {#each HOURS as h (h)}
        <!-- Vicino all'ora attuale il numero lascia il posto all'etichetta "13:04". -->
        {#if h > 0 && !(showsToday && Math.abs(app.nowMinutes - h * 60) < 22)}
          <span style:top={`${h * HOUR}px`}>{h}</span>
        {/if}
      {/each}
    </div>
    {#each columns as c (c.key)}
      <div class="daycol" class:today={c.isToday}>
        <button class="empty" aria-label={`Nuovo evento ${fmtDayLong(c.key)}: tocca l’ora`} onclick={(e) => tapEmpty(e, c.key)}></button>
        {#each c.blocks as b (b.part.occ.key)}
          {@const ev = b.part.occ.event}
          {@const height = ((b.bottom - b.top) / 60) * HOUR - 2}
          <button
            class="block"
            class:reminder={ev.kind === 'reminder'}
            class:done={ev.kind === 'reminder' && ev.done.includes(b.part.occ.date)}
            class:small={height < 36}
            style:top={`${(b.top / 60) * HOUR + 1}px`}
            style:height={`${height}px`}
            style:left={`calc(${(b.col / b.cols) * 100}% + 1px)`}
            style:width={`calc(${100 / b.cols}% - 2px)`}
            style:--c={colorOf(ev)}
            aria-label={blockLabel(b.part)}
            onclick={() => open(b.part)}
          >
            <span class="t">{ev.title || 'Senza titolo'}</span>
            {#if mode === 'day' && height >= 40}
              <span class="when num">
                {ev.kind === 'reminder' ? fmtTime(b.part.start) : `${fmtTime(b.part.start)} – ${fmtTime(b.part.end)}`}{ev.location ? ` · ${ev.location}` : ''}
              </span>
            {/if}
          </button>
        {/each}
        {#if c.isToday}
          <div class="now" style:top={`${nowTop}px`} aria-hidden="true"></div>
        {/if}
      </div>
    {/each}
    {#if showsToday}
      <span class="nowlabel num" style:top={`${nowTop}px`} aria-hidden="true">{fmtTime(app.nowMinutes)}</span>
    {/if}
  </div>
</div>

<style>
  .head,
  .allday,
  .grid {
    display: grid;
    grid-template-columns: 34px repeat(7, minmax(0, 1fr));
    column-gap: 2px;
    padding: 0 6px 0 2px;
  }
  .head.single,
  .allday.single,
  .grid.single {
    grid-template-columns: 34px minmax(0, 1fr);
  }
  .head {
    flex: none;
    padding-bottom: 4px;
  }
  .dayhead {
    min-width: 0;
    height: 52px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .head.single .dayhead {
    flex-direction: row;
    justify-content: flex-start;
    gap: 10px;
    padding-left: 8px;
  }
  .dayhead.selected {
    background: var(--surface);
  }
  .name {
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }
  .number {
    min-width: 28px;
    height: 26px;
    padding: 0 4px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    font-weight: 600;
  }
  .number.today {
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 700;
  }
  .red {
    color: var(--sunday);
  }
  .allday {
    flex: none;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border);
  }
  .allday .col {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .holiday {
    height: 16px;
    padding: 0 3px;
    font-size: 0.625rem;
    line-height: 16px;
    color: var(--sunday);
    white-space: nowrap;
    overflow: hidden;
  }
  .adchip {
    height: 22px;
    border-radius: 6px;
    padding: 0 5px;
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 22px;
    color: #0b0d14;
    background: var(--c);
    white-space: nowrap;
    overflow: hidden;
    text-align: left;
  }
  .allday.single .adchip {
    height: 30px;
    padding: 0 10px;
    font-size: 0.8125rem;
    line-height: 30px;
  }
  .allday .more {
    height: 18px;
    font-size: 0.6875rem;
    color: var(--text-muted);
    text-align: left;
    padding: 0 4px;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .grid {
    position: relative;
    margin: 8px 0 12px;
  }
  .hours {
    position: relative;
    font-size: 0.6875rem;
    color: var(--text-dim);
  }
  .hours span {
    position: absolute;
    right: 6px;
    transform: translateY(-50%);
    line-height: 1;
  }
  .daycol {
    position: relative;
    min-width: 0;
    /* Una riga per ogni ora. */
    background-image: linear-gradient(var(--border) 1px, transparent 1px);
    background-size: 100% 56px;
  }
  .daycol.today {
    background-color: rgb(198 242 78 / 0.04);
  }
  .empty {
    position: absolute;
    inset: 0;
    width: 100%;
    border-radius: 0;
  }
  .block {
    position: absolute;
    border-radius: 8px;
    padding: 3px 5px;
    /* "clip" taglia quello che esce senza bloccare il titolo, che resta visibile mentre si scorre. */
    overflow: hidden;
    overflow: clip;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    text-align: left;
    color: #fff;
    /* Il colore dell'evento scurito: il testo bianco sopra si legge sempre bene. */
    background: var(--c);
    background: color-mix(in srgb, var(--c) 58%, #12141d);
    box-shadow: 0 0 0 1px var(--bg);
  }
  .block.small {
    padding: 1px 5px;
    justify-content: center;
  }
  .block .t {
    position: sticky;
    top: 4px;
    max-width: 100%;
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.2;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  .block.small .t {
    white-space: nowrap;
  }
  .grid.single .block {
    padding: 6px 10px;
  }
  .grid.single .block.small {
    padding: 2px 10px;
  }
  .grid.single .block .t {
    font-size: 0.875rem;
  }
  .block .when {
    font-size: 0.75rem;
    opacity: 0.92;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  /* I promemoria non sono blocchi pieni: sfondo scuro con il bordo del loro colore. */
  .block.reminder {
    background: var(--surface-2);
    color: var(--text);
    box-shadow:
      inset 0 0 0 1.5px var(--c),
      0 0 0 1px var(--bg);
  }
  .block.reminder.done .t {
    text-decoration: line-through;
    color: var(--text-dim);
  }
  .now {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    margin-top: -1px;
    background: var(--sunday);
    pointer-events: none;
  }
  .now::before {
    content: '';
    position: absolute;
    left: -3px;
    top: -3px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--sunday);
  }
  .nowlabel {
    position: absolute;
    left: 0;
    width: 34px;
    transform: translateY(-50%);
    padding: 2px 0;
    font-size: 0.625rem;
    font-weight: 600;
    text-align: center;
    color: var(--sunday);
    background: var(--bg);
    pointer-events: none;
  }
</style>
