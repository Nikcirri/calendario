<script lang="ts">
  import { onMount } from 'svelte';
  import { run } from '../lib/actions';
  import { db } from '../lib/db';
  import { capitalize, fmtDayShort, fmtTime, parseKey } from '../lib/logic/dates';
  import { repeatSummary } from '../lib/logic/recurrence';
  import { emptyTrash, purgeEvent, restoreEvent, TRASH_DAYS } from '../lib/repo';
  import { app, closePage, colorOf, data } from '../lib/state/app.svelte';
  import { confirmDialog, registerOverlay, showToast } from '../lib/state/ui.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import type { CalEvent } from '../lib/types';

  const year = $derived(parseKey(app.today).y);

  function when(ev: CalEvent): string {
    const day = capitalize(fmtDayShort(ev.date, year));
    const time = ev.allDay ? '' : `, ${fmtTime(ev.start)}`;
    return ev.repeat ? `${repeatSummary(ev.repeat, ev.date)}, dal ${fmtDayShort(ev.date, year)}` : `${day}${time}`;
  }

  /** Giorni che mancano prima che l'evento venga eliminato del tutto. */
  function daysLeft(ev: CalEvent): number {
    const deleted = ev.deletedAt ? new Date(ev.deletedAt).getTime() : Date.now();
    return Math.max(0, TRASH_DAYS - Math.floor((Date.now() - deleted) / 86_400_000));
  }

  function restore(ev: CalEvent) {
    run(async () => {
      await restoreEvent(db, ev.id);
      showToast('Ripristinato nel calendario');
    });
  }

  async function purge(ev: CalEvent) {
    const ok = await confirmDialog({
      title: 'Eliminare per sempre?',
      message: `“${ev.title || 'Senza titolo'}” non si potrà più recuperare.`,
      confirmLabel: 'Elimina',
      danger: true,
    });
    if (ok) run(() => purgeEvent(db, ev.id));
  }

  async function purgeAll() {
    const ok = await confirmDialog({
      title: 'Svuotare il cestino?',
      message: 'Tutti gli impegni nel cestino verranno eliminati per sempre.',
      confirmLabel: 'Svuota',
      danger: true,
    });
    if (ok) run(() => emptyTrash(db));
  }

  onMount(() => registerOverlay(closePage));
</script>

<div class="page">
  <div class="page-head">
    <button class="icon-btn" aria-label="Indietro" onclick={closePage}><Icon name="back" /></button>
    <h1>Cestino</h1>
  </div>
  <div class="page-body">
    {#if data.trash.length === 0}
      <div class="emptybox">
        <p class="big display">Il cestino è vuoto</p>
        <p>Gli impegni che elimini restano qui per {TRASH_DAYS} giorni, poi spariscono da soli.</p>
      </div>
    {:else}
      <p class="intro">Gli impegni eliminati restano qui per {TRASH_DAYS} giorni.</p>
      {#each data.trash as ev (ev.id)}
        <div class="card item">
          <div class="info">
            <span class="dot" style:background={colorOf(ev)}></span>
            <div class="text">
              <span class="title">{ev.title || 'Senza titolo'}</span>
              <span class="sub">{when(ev)}</span>
              <span class="sub">{daysLeft(ev) === 0 ? 'Verrà eliminato a breve' : `Ancora ${daysLeft(ev)} ${daysLeft(ev) === 1 ? 'giorno' : 'giorni'} nel cestino`}</span>
            </div>
          </div>
          <div class="pair">
            <button class="btn" onclick={() => restore(ev)}>
              <Icon name="undo" size={18} />
              <span>Ripristina</span>
            </button>
            <button class="btn danger" onclick={() => purge(ev)}>
              <Icon name="trash" size={18} />
              <span>Elimina</span>
            </button>
          </div>
        </div>
      {/each}
      <button class="btn btn-ghost all" onclick={purgeAll}>Svuota il cestino</button>
    {/if}
  </div>
</div>

<style>
  .intro {
    margin: 0 4px;
    font-size: 0.875rem;
    color: var(--text-muted);
  }
  .item {
    flex: none;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .info {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .info .dot {
    margin-top: 6px;
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
    overflow-wrap: anywhere;
  }
  .sub {
    font-size: 0.8125rem;
    color: var(--text-muted);
  }
  .pair {
    display: flex;
    gap: 8px;
  }
  .pair .btn {
    flex: 1;
    min-height: 44px;
    padding: 0 10px;
    border-radius: 12px;
    font-size: 0.875rem;
  }
  .pair .danger {
    color: var(--danger);
  }
  .all {
    flex: none;
    align-self: center;
    color: var(--danger);
  }
  .emptybox {
    margin-top: 32px;
    padding: 0 12px;
    text-align: center;
  }
  .emptybox .big {
    margin: 0 0 8px;
    font-size: 1.375rem;
    font-weight: 600;
  }
  .emptybox p {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--text-muted);
  }
</style>
