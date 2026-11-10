<script lang="ts">
  import { onMount } from 'svelte';
  import { capitalize, fmtDayShort, fmtTime, parseKey } from '../lib/logic/dates';
  import { matchesQuery } from '../lib/logic/occurrences';
  import { nextOccurrenceDate } from '../lib/logic/recurrence';
  import { app, closePage, colorOf, data, sheets } from '../lib/state/app.svelte';
  import { registerOverlay } from '../lib/state/ui.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import type { CalEvent } from '../lib/types';

  const LIMIT = 80;

  let query = $state('');
  let input = $state<HTMLInputElement | null>(null);

  const year = $derived(parseKey(app.today).y);

  interface Hit {
    ev: CalEvent;
    /** Il giorno da aprire: la prossima volta, oppure la prima se è tutto passato. */
    date: string;
    past: boolean;
  }

  const hits = $derived.by(() => {
    const q = query.trim();
    if (q.length < 2) return [] as Hit[];
    const found: Hit[] = [];
    for (const ev of data.events) {
      if (!matchesQuery(ev, q)) continue;
      const next = nextOccurrenceDate(ev.date, ev.repeat, app.today, ev.exdates);
      found.push({ ev, date: next ?? ev.date, past: next === null });
    }
    // Prima quelli in arrivo (dal più vicino), poi i passati (dal più recente).
    found.sort((a, b) => {
      if (a.past !== b.past) return a.past ? 1 : -1;
      return a.past ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date) || a.ev.start - b.ev.start;
    });
    return found.slice(0, LIMIT);
  });

  function open(hit: Hit) {
    sheets.detail = { id: hit.ev.id, date: hit.date };
  }

  onMount(() => {
    input?.focus();
    return registerOverlay(closePage);
  });
</script>

<div class="page">
  <div class="page-head">
    <button class="icon-btn" aria-label="Indietro" onclick={closePage}><Icon name="back" /></button>
    <div class="searchbox">
      <Icon name="search" size={20} />
      <input type="search" bind:value={query} bind:this={input} placeholder="Cerca titolo, luogo o note" aria-label="Cerca tra gli impegni" autocomplete="off" enterkeyhint="search" />
      {#if query}
        <button class="clear" aria-label="Cancella la ricerca" onclick={() => { query = ''; input?.focus(); }}>
          <Icon name="close" size={18} />
        </button>
      {/if}
    </div>
  </div>
  <div class="page-body">
    {#if query.trim().length < 2}
      <p class="hint">Scrivi almeno due lettere.</p>
    {:else if hits.length === 0}
      <p class="hint">Nessun impegno trovato per “{query.trim()}”.</p>
    {:else}
      <p class="count" aria-live="polite">{hits.length === 1 ? '1 impegno trovato' : `${hits.length}${hits.length === LIMIT ? '+' : ''} impegni trovati`}</p>
      <div class="card">
        {#each hits as hit (hit.ev.id)}
          <button class="row" class:past={hit.past} onclick={() => open(hit)}>
            <span class="dot" style:background={colorOf(hit.ev)}></span>
            <span class="text">
              <span class="title">{hit.ev.title || 'Senza titolo'}</span>
              <span class="sub">
                {capitalize(fmtDayShort(hit.date, year))}{hit.ev.allDay ? '' : `, ${fmtTime(hit.ev.start)}`}{hit.ev.repeat ? ' · si ripete' : ''}{hit.ev.location ? ` · ${hit.ev.location}` : ''}
              </span>
            </span>
            <Icon name="chevronRight" size={18} />
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .searchbox {
    flex: 1;
    min-width: 0;
    height: 48px;
    margin-right: 4px;
    padding: 0 6px 0 14px;
    border-radius: 14px;
    background: var(--surface-2);
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text-muted);
  }
  .searchbox:focus-within {
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }
  .searchbox input {
    flex: 1;
    min-width: 0;
    height: 44px;
    border: 0;
    background: none;
    outline: none;
    font-size: 1rem;
  }
  .searchbox input::-webkit-search-cancel-button {
    display: none;
  }
  .clear {
    width: 40px;
    height: 40px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
  }
  .hint,
  .count {
    margin: 8px 4px 0;
    font-size: 0.875rem;
    color: var(--text-muted);
  }
  .card {
    flex: none;
  }
  .row {
    min-height: 60px;
  }
  .row :global(svg) {
    color: var(--text-dim);
  }
  .row.past .title {
    color: var(--text-muted);
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 0;
  }
  .title {
    font-size: 1rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub {
    font-size: 0.8125rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
