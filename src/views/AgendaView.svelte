<script lang="ts">
  import { run, startNewEvent, toggleDone } from '../lib/actions';
  import { addDays, capitalize, fmtDayShort, fmtTime, parseKey } from '../lib/logic/dates';
  import { holidayName } from '../lib/logic/holidays';
  import { partsByDay, type DayPart } from '../lib/logic/occurrences';
  import { app, colorOf, data, sheets } from '../lib/state/app.svelte';
  import Icon from '../lib/ui/Icon.svelte';

  /** Quanti giorni mostrare per volta. */
  const STEP = 45;
  const MAX_DAYS = 400;
  let span = $state(STEP);

  const from = $derived(app.cursor);
  const to = $derived(addDays(from, span - 1));
  const year = $derived(parseKey(app.today).y);

  const groups = $derived.by(() => {
    const parts = partsByDay(data.visible, from, to);
    const out: { key: string; label: string; isToday: boolean; holiday: string | null; parts: DayPart[] }[] = [];
    for (const [key, list] of parts) {
      const holiday = app.settings.showHolidays ? holidayName(key) : null;
      // I giorni vuoti non si mostrano, tranne oggi e il giorno scelto.
      if (!list.length && !holiday && key !== app.today && key !== from) continue;
      out.push({ key, label: capitalize(fmtDayShort(key, year)), isToday: key === app.today, holiday, parts: list });
    }
    return out;
  });
  const empty = $derived(groups.every((g) => g.parts.length === 0));

  function timeText(p: DayPart): string {
    const ev = p.occ.event;
    if (p.allDay) return p.occ.endDate !== p.occ.date ? `Fino a ${fmtDayShort(p.occ.endDate, year)}` : 'Tutto il giorno';
    if (ev.kind === 'reminder') return 'Promemoria';
    return `${fmtTime(p.start)} – ${fmtTime(p.end)}`;
  }
</script>

<div class="list">
  {#each groups as g (g.key)}
    <section>
      <header>
        {#if g.isToday}<span class="badge">Oggi</span>{/if}
        <h2 class:today={g.isToday}>{g.label}</h2>
        {#if g.holiday}<span class="holiday">{g.holiday}</span>{/if}
      </header>
      {#if g.parts.length === 0}
        <button class="nothing" onclick={() => startNewEvent(g.key)}>
          <Icon name="plus" size={18} />
          <span>Nessun impegno: aggiungine uno</span>
        </button>
      {/if}
      {#each g.parts as p (p.occ.key)}
        {@const ev = p.occ.event}
        {@const done = ev.kind === 'reminder' && ev.done.includes(p.occ.date)}
        <div class="item">
          <button class="main" onclick={() => (sheets.detail = { id: ev.id, date: p.occ.date })}>
            <span class="time num">{p.allDay ? '' : fmtTime(p.start)}</span>
            <span class="bar" style:background={colorOf(ev)}></span>
            <span class="text">
              <span class="title" class:done>{ev.title || 'Senza titolo'}</span>
              <span class="when num">{timeText(p)}{ev.location ? ` · ${ev.location}` : ''}</span>
            </span>
          </button>
          {#if ev.kind === 'reminder'}
            <button
              class="check"
              class:on={done}
              role="checkbox"
              aria-checked={done}
              aria-label={`${ev.title || 'Promemoria'}: fatto`}
              onclick={() => run(() => toggleDone(ev, p.occ.date))}
            >
              {#if done}<Icon name="check" size={16} stroke={3} />{/if}
            </button>
          {/if}
        </div>
      {/each}
    </section>
  {/each}

  {#if empty}
    <p class="hint">Nessun impegno da {fmtDayShort(from, year)} a {fmtDayShort(to, year)}.</p>
  {/if}
  {#if span < MAX_DAYS}
    <button class="btn more" onclick={() => (span = Math.min(MAX_DAYS, span + STEP))}>Mostra altri giorni</button>
  {/if}
</div>

<style>
  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  section {
    display: flex;
    flex-direction: column;
  }
  header {
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 4px;
  }
  h2 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-muted);
  }
  h2.today {
    color: var(--text);
  }
  .badge {
    height: 24px;
    padding: 0 8px;
    border-radius: 8px;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 0.8125rem;
    font-weight: 700;
    display: flex;
    align-items: center;
  }
  .holiday {
    font-size: 0.8125rem;
    color: var(--sunday);
  }
  .item {
    display: flex;
    align-items: center;
    background: var(--surface);
  }
  .item:first-of-type {
    border-radius: 16px 16px 0 0;
  }
  .item:last-of-type {
    border-radius: 0 0 16px 16px;
  }
  .item:first-of-type:last-of-type {
    border-radius: 16px;
  }
  .item + .item {
    box-shadow: inset 0 1px 0 var(--border);
  }
  .main {
    flex: 1;
    min-width: 0;
    min-height: 60px;
    padding: 8px 14px 8px 0;
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
  }
  .time {
    width: 56px;
    flex: none;
    text-align: right;
    font-size: 0.875rem;
    font-weight: 600;
  }
  .bar {
    width: 4px;
    height: 34px;
    border-radius: 2px;
    flex: none;
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .title {
    font-size: 1rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .title.done {
    text-decoration: line-through;
    color: var(--text-dim);
  }
  .when {
    font-size: 0.8125rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .check {
    position: relative;
    width: 48px;
    height: 48px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-ink);
  }
  .check::before {
    content: '';
    position: absolute;
    width: 24px;
    height: 24px;
    border-radius: 8px;
    box-shadow: inset 0 0 0 2px var(--text-muted);
  }
  .check.on::before {
    background: var(--accent);
    box-shadow: none;
  }
  .check :global(svg) {
    position: relative;
  }
  .nothing {
    min-height: 48px;
    padding: 0 14px;
    border-radius: 16px;
    background: var(--surface);
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.875rem;
    color: var(--text-muted);
    text-align: left;
  }
  .hint {
    margin: 12px 4px;
    font-size: 0.875rem;
    color: var(--text-muted);
    text-align: center;
  }
  .more {
    margin-top: 8px;
    align-self: center;
  }
</style>
