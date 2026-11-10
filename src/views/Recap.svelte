<script lang="ts">
  import { onMount } from 'svelte';
  import { run, saveActual } from '../lib/actions';
  import { reportError } from '../lib/errors';
  import { addMonths, fmtDayShort, fmtDuration, fmtHours, fmtMonthYear, fmtTime, parseKey, startOfMonth } from '../lib/logic/dates';
  import { plannedMinutes } from '../lib/logic/occurrences';
  import { fmtEuro, monthRecap, NO_CATEGORY, recapCsv, rowProgress, type RecapRow } from '../lib/logic/recap';
  import { shareTextFile } from '../lib/services/files';
  import { app, closePage, data, openPage, sheets } from '../lib/state/app.svelte';
  import { registerOverlay, showToast } from '../lib/state/ui.svelte';
  import Icon from '../lib/ui/Icon.svelte';

  /** Altezza dell'area delle barre, in pixel. */
  const PLOT = 120;

  let month = $state(startOfMonth(app.cursor));

  const recap = $derived.by(() => {
    void app.nowMinutes;
    return monthRecap(data.events, data.categories, month, new Date());
  });
  const isPast = $derived(addMonths(month, 1) <= startOfMonth(app.today));
  const isFuture = $derived(month > startOfMonth(app.today));
  const year = $derived(parseKey(app.today).y);

  // Scala del grafico: il valore più alto arrotondato in su a un numero comodo di ore.
  const scale = $derived.by(() => {
    const maxHours = Math.max(1, ...recap.weeks.map((w) => w.total / 60));
    const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => s * 3 >= maxHours) ?? Math.ceil(maxHours / 3);
    return { max: step * 3, ticks: [step * 3, step * 2, step, 0] };
  });
  const legend = $derived(recap.rows.filter((r) => r.plannedMin > 0));
  const chartLabel = $derived(
    `Ore per settimana: ${recap.weeks.map((w) => `dal ${w.label.replace('–', ' al ')}, ${fmtDuration(w.total)}`).join('; ')}`,
  );
  const next = $derived(recap.toConfirm[0]);

  function rowDetails(r: RecapRow): string {
    const bits: string[] = [];
    if (r.goalMin !== null) bits.push(`Tetto ${fmtHours(r.goalMin)} h`);
    if (r.rate !== null) bits.push(`${fmtEuro(r.rate)}/h`);
    if (r.pay !== null) bits.push(`compenso stimato ${fmtEuro(r.pay)}`);
    return bits.join(' · ');
  }

  function overGoal(r: RecapRow): string | null {
    if (r.goalMin === null || r.plannedMin <= r.goalMin) return null;
    return `Nel mese ci sono ${fmtDuration(r.plannedMin - r.goalMin)} oltre il tetto.`;
  }

  async function exportCsv() {
    const { y, m } = parseKey(month);
    try {
      const ok = await shareTextFile(`recap-${y}-${String(m).padStart(2, '0')}.csv`, recapCsv(recap), 'text/csv', 'Salva il recap');
      if (ok) showToast('Tabella pronta: si apre con Excel o Fogli Google.');
    } catch (e) {
      reportError(e, 'Non riesco a creare la tabella.');
    }
  }

  onMount(() => registerOverlay(closePage));
</script>

<div class="page">
  <div class="page-head">
    <button class="icon-btn" aria-label="Torna al calendario" onclick={closePage}><Icon name="back" /></button>
    <h1>Recap</h1>
  </div>

  <div class="switch">
    <button class="icon-btn" aria-label="Mese precedente" onclick={() => (month = addMonths(month, -1))}><Icon name="back" size={22} /></button>
    <span class="monthname">{fmtMonthYear(month)}</span>
    <button class="icon-btn" aria-label="Mese successivo" onclick={() => (month = addMonths(month, 1))}><Icon name="chevronRight" size={22} /></button>
  </div>

  <div class="page-body">
    {#if recap.plannedMin === 0}
      <div class="emptybox">
        <p class="big display">Nessuna ora in questo mese</p>
        <p>Qui trovi le ore degli eventi con un orario, divise per categoria. Crea un evento e scegli la sua categoria (ad esempio “Lavoro”).</p>
      </div>
    {:else}
      <div class="hero">
        <span class="total display num">{fmtDuration(isFuture ? recap.plannedMin : recap.doneMin)}</span>
        <span class="sub">
          {#if isFuture}
            programmate
          {:else if isPast}
            fatte{recap.doneMin !== recap.plannedMin ? `, su ${fmtDuration(recap.plannedMin)} programmate` : ''}
          {:else}
            fatte finora, su {fmtDuration(recap.plannedMin)} programmate
          {/if}
        </span>
      </div>

      <section class="card chart">
        <h2>Ore per settimana</h2>
        <div class="legend">
          {#each legend as r (r.id)}
            <span><span class="dot" style:background={r.color}></span>{r.name}</span>
          {/each}
        </div>
        <div class="plotrow" role="img" aria-label={chartLabel}>
          <div class="axis" style:height={`${PLOT}px`}>
            {#each scale.ticks as t, i (t)}
              <span style:top={`${(i / 3) * PLOT}px`}>{t}</span>
            {/each}
          </div>
          <div class="plot" style:height={`${PLOT}px`}>
            {#each [0, 1, 2] as i (i)}
              <div class="gridline" style:top={`${(i / 3) * PLOT}px`}></div>
            {/each}
            <div class="bars" style:grid-template-columns={`repeat(${recap.weeks.length}, minmax(0, 1fr))`}>
              {#each recap.weeks as w (w.from)}
                <div class="barcol">
                  {#if w.total > 0}
                    <span class="value num" class:current={w.current}>{fmtHours(w.total)}</span>
                  {/if}
                  <div class="stack">
                    {#each w.parts as p (p.id)}
                      <div class="seg" style:height={`${Math.max(2, (p.minutes / 60 / scale.max) * (PLOT - 16))}px`} style:background={p.color}></div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
            <div class="baseline"></div>
          </div>
        </div>
        <div class="xlabels" style:grid-template-columns={`repeat(${recap.weeks.length}, minmax(0, 1fr))`}>
          {#each recap.weeks as w (w.from)}
            <span class:current={w.current}>{w.label}</span>
          {/each}
        </div>
      </section>

      <section class="card rows">
        {#each recap.rows as r (r.id)}
          <div class="catrow">
            <div class="catline">
              <span class="dot" style:background={r.color}></span>
              <span class="catname">{r.name}</span>
              <span class="cathours num">{fmtHours(r.doneMin)} di {fmtHours(r.plannedMin)} h</span>
            </div>
            <div class="track"><div class="fill" style:width={`${rowProgress(r) * 100}%`} style:background={r.color}></div></div>
            {#if rowDetails(r)}<span class="details">{rowDetails(r)}</span>{/if}
            {#if overGoal(r)}<span class="over"><Icon name="warning" size={16} />{overGoal(r)}</span>{/if}
          </div>
        {/each}
      </section>

      {#if next}
        {@const planned = plannedMinutes(next.event)}
        <section class="card confirm">
          <div>
            <h2>Ore da confermare</h2>
            <p>
              {next.event.title || 'Senza titolo'}, {fmtDayShort(next.date, year)}, {fmtTime(next.event.start)} – {fmtTime(next.event.end)}
              {#if recap.toConfirm.length > 1}<span class="others"> · e {recap.toConfirm.length - 1} {recap.toConfirm.length === 2 ? 'altro' : 'altri'}</span>{/if}
            </p>
          </div>
          <div class="pair">
            <button class="btn btn-primary" onclick={() => run(() => saveActual(next.event, next.date, planned))}>Conferma {fmtDuration(planned)}</button>
            <button class="btn" onclick={() => (sheets.detail = { id: next.event.id, date: next.date })}>Correggi</button>
          </div>
        </section>
      {/if}
    {/if}

    <button class="linkrow" onclick={() => openPage('categories')}>
      <Icon name="tag" size={20} />
      <span>Imposta tetto di ore e tariffa delle categorie</span>
      <Icon name="chevronRight" size={18} />
    </button>

    {#if recap.plannedMin > 0}
      <button class="btn export" onclick={exportCsv}>
        <Icon name="download" size={20} />
        <span>Esporta per Excel</span>
      </button>
    {/if}
    {#if recap.rows.some((r) => r.id === NO_CATEGORY)}
      <p class="foot">“Senza categoria” raccoglie gli eventi a cui non hai assegnato una categoria.</p>
    {/if}
  </div>
</div>

<style>
  .switch {
    height: 44px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    color: var(--text-muted);
  }
  .switch .icon-btn {
    color: var(--text-muted);
  }
  .monthname {
    font-weight: 600;
    color: var(--text);
  }
  .hero {
    padding: 8px 8px 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .total {
    font-size: 2.25rem;
    font-weight: 600;
    line-height: 1.17;
  }
  .sub {
    font-size: 0.875rem;
    color: var(--text-muted);
  }
  .card {
    flex: none;
  }
  h2 {
    margin: 0;
    font-size: 0.9375rem;
  }
  .chart {
    padding: 14px 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .legend span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .plotrow {
    display: flex;
    gap: 6px;
    margin-top: 16px;
  }
  .axis {
    width: 26px;
    flex: none;
    position: relative;
    font-size: 0.6875rem;
    color: var(--text-dim);
  }
  .axis span {
    position: absolute;
    right: 0;
    transform: translateY(-50%);
    line-height: 1;
  }
  .plot {
    flex: 1;
    min-width: 0;
    position: relative;
  }
  .gridline {
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--border);
  }
  .baseline {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1px;
    background: var(--text-dim);
  }
  .bars {
    position: absolute;
    inset: 0;
    display: grid;
  }
  .barcol {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
  }
  .value {
    font-size: 0.6875rem;
    line-height: 1;
    color: var(--text-muted);
  }
  .value.current {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text);
  }
  .stack {
    width: 24px;
    display: flex;
    flex-direction: column-reverse;
    gap: 2px;
  }
  .seg:last-child {
    border-radius: 4px 4px 0 0;
  }
  .xlabels {
    display: grid;
    margin-left: 32px;
    text-align: center;
    font-size: 0.6875rem;
    color: var(--text-dim);
  }
  .xlabels .current {
    color: var(--text);
    font-weight: 600;
  }
  .rows {
    padding: 6px 16px;
  }
  .catrow {
    padding: 12px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .catrow + .catrow {
    border-top: 1px solid var(--border);
  }
  .catline {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .catname {
    flex: 1;
    min-width: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cathours {
    flex: none;
    font-size: 0.875rem;
  }
  .track {
    height: 6px;
    background: var(--border);
    border-radius: 0 3px 3px 0;
    overflow: hidden;
  }
  .fill {
    height: 6px;
    border-radius: 0 3px 3px 0;
  }
  .details {
    font-size: 0.8125rem;
    color: var(--text-muted);
  }
  .over {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8125rem;
    color: var(--sunday);
  }
  .confirm {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .confirm p {
    margin: 2px 0 0;
    font-size: 0.8125rem;
    line-height: 1.45;
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
  .linkrow {
    flex: none;
    min-height: 52px;
    padding: 0 12px 0 16px;
    border-radius: 16px;
    background: var(--surface);
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
    font-size: 0.9375rem;
    color: var(--text-muted);
  }
  .linkrow span {
    flex: 1;
    color: var(--text);
  }
  .export {
    flex: none;
    background: var(--surface-2);
  }
  .emptybox {
    margin-top: 24px;
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
  .foot {
    margin: 0 4px;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: var(--text-dim);
  }
</style>
