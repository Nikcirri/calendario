<script lang="ts">
  import { capitalize, daysInMonth, MONTHS, parseKey, toKey, weekday, WEEKDAYS_LETTER } from '../lib/logic/dates';
  import { partsByDay } from '../lib/logic/occurrences';
  import { app, data, selectDay, setView } from '../lib/state/app.svelte';

  const year = $derived(parseKey(app.cursor).y);
  const busy = $derived.by(() => {
    const parts = partsByDay(data.visible, toKey(year, 1, 1), toKey(year, 12, 31));
    const set = new Set<string>();
    for (const [key, list] of parts) if (list.length) set.add(key);
    return set;
  });

  const months = $derived(
    MONTHS.map((name, i) => {
      const m = i + 1;
      const offset = weekday(toKey(year, m, 1)) - 1;
      const count = daysInMonth(year, m);
      const cells: ({ d: number; key: string } | null)[] = [];
      for (let k = 0; k < offset; k++) cells.push(null);
      for (let d = 1; d <= count; d++) cells.push({ d, key: toKey(year, m, d) });
      const today = parseKey(app.today);
      return { m, name: capitalize(name), cells, current: today.y === year && today.m === m };
    }),
  );

  function openMonth(m: number) {
    const today = parseKey(app.today);
    // Se è il mese di oggi si resta su oggi, altrimenti sul primo del mese.
    selectDay(today.y === year && today.m === m ? app.today : toKey(year, m, 1));
    setView('month');
  }
</script>

<div class="year">
  {#each months as mo (mo.m)}
    <button class="month" class:current={mo.current} aria-label={`${mo.name} ${year}`} onclick={() => openMonth(mo.m)}>
      <span class="name display">{mo.name}</span>
      <span class="mini" aria-hidden="true">
        {#each WEEKDAYS_LETTER as letter, i (i)}
          <span class="wd" class:red={i === 6}>{letter}</span>
        {/each}
        {#each mo.cells as c, i (i)}
          {#if c}
            <span class="d" class:busy={busy.has(c.key)} class:today={c.key === app.today}>{c.d}</span>
          {:else}
            <span></span>
          {/if}
        {/each}
      </span>
    </button>
  {/each}
</div>

<style>
  .year {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 10px 12px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    align-content: start;
  }
  .month {
    min-width: 0;
    padding: 8px 6px 10px;
    border-radius: 14px;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
  }
  .month.current {
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }
  .name {
    padding-left: 3px;
    font-size: 0.9375rem;
    font-weight: 600;
  }
  .mini {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    row-gap: 2px;
    text-align: center;
  }
  .wd {
    font-size: 0.5rem;
    line-height: 12px;
    color: var(--text-dim);
  }
  .wd.red {
    color: var(--sunday);
  }
  .d {
    height: 15px;
    border-radius: 5px;
    font-size: 0.5625rem;
    line-height: 15px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .d.busy {
    background: var(--border);
    color: var(--text);
    font-weight: 600;
  }
  .d.today {
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 700;
  }
</style>
