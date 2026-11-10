<script lang="ts">
  import { removeEvent, removeOccurrence, run, saveActual, saveAsTemplate, startEdit, toggleChecklist, toggleDone } from '../lib/actions';
  import { capitalize, diffDays, fmtDayLong, fmtDayShort, fmtDuration, fmtTime, parseKey } from '../lib/logic/dates';
  import { alertsSummary } from '../lib/logic/model';
  import { makeOccurrence, occurrenceEnd, plannedMinutes } from '../lib/logic/occurrences';
  import { repeatSummary } from '../lib/logic/recurrence';
  import { openExternal } from '../lib/platform';
  import { app, colorOf, data, findEvent, sheets } from '../lib/state/app.svelte';
  import { showToast } from '../lib/state/ui.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Sheet from '../lib/ui/Sheet.svelte';

  let { id, date }: { id: string; date: string } = $props();

  const ev = $derived(findEvent(id));
  let askDelete = $state(false);
  let fixing = $state(false);
  let fixHours = $state(0);
  let fixMinutes = $state(0);

  function close() {
    sheets.detail = null;
  }

  // Se l'evento sparisce (eliminato altrove) il foglio si chiude.
  $effect(() => {
    if (!ev || ev.deletedAt) close();
  });

  const year = $derived(parseKey(app.today).y);
  const occ = $derived(ev ? makeOccurrence(ev, date) : null);
  const category = $derived(ev?.categoryId ? data.categoryById.get(ev.categoryId) : undefined);
  const isReminder = $derived(ev?.kind === 'reminder');
  const done = $derived(!!ev && ev.done.includes(date));
  const planned = $derived(ev ? plannedMinutes(ev) : 0);
  const actual = $derived(ev ? ev.actual[date] : undefined);
  const ended = $derived.by(() => {
    void app.nowMinutes;
    return occ ? occurrenceEnd(occ).getTime() <= Date.now() : false;
  });

  const whenLines = $derived.by(() => {
    if (!ev || !occ) return [] as string[];
    const day = capitalize(fmtDayLong(occ.date, year));
    if (occ.endDate !== occ.date) {
      const a = ev.allDay ? capitalize(fmtDayShort(occ.date, year)) : `${capitalize(fmtDayShort(occ.date, year))}, ${fmtTime(ev.start)}`;
      const b = ev.allDay ? fmtDayShort(occ.endDate, year) : `${fmtDayShort(occ.endDate, year)}, ${fmtTime(ev.end)}`;
      return [`${a} → ${b}`];
    }
    if (ev.allDay) return [day, 'Tutto il giorno'];
    if (ev.kind === 'reminder') return [day, `alle ${fmtTime(ev.start)}`];
    return [day, `${fmtTime(ev.start)} – ${fmtTime(ev.end)} · ${fmtDuration(planned)}`];
  });

  /** "Oggi", "Domani", "Tra 12 giorni", "3 giorni fa". */
  const countdown = $derived.by(() => {
    const diff = diffDays(app.today, date);
    if (diff === 0) return 'Oggi';
    if (diff === 1) return 'Domani';
    if (diff === -1) return 'Ieri';
    return diff > 0 ? `Tra ${diff} giorni` : `${-diff} giorni fa`;
  });

  function startFix() {
    const base = actual ?? planned;
    fixHours = Math.floor(base / 60);
    fixMinutes = base % 60;
    fixing = true;
  }

  function saveFix() {
    if (!ev) return;
    const total = Math.max(0, Math.round(Number(fixHours) || 0)) * 60 + Math.min(59, Math.max(0, Math.round(Number(fixMinutes) || 0)));
    fixing = false;
    run(() => saveActual(ev, date, total));
    showToast(`Ore segnate: ${fmtDuration(total)}`);
  }

  function openMap() {
    if (ev?.location) openExternal(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`);
  }

  function onDelete() {
    if (!ev) return;
    if (ev.repeat) askDelete = true;
    else run(() => removeEvent(ev));
  }
</script>

{#if ev && occ}
  <Sheet title={isReminder ? 'Promemoria' : 'Evento'} onclose={close}>
    <div class="headline">
      <span class="swatch" style:background={colorOf(ev)}></span>
      <h3 class="display" class:done={isReminder && done}>{ev.title || 'Senza titolo'}</h3>
    </div>

    <div class="rows">
      <div class="line">
        <Icon name="clock" size={22} />
        <div class="text">
          {#each whenLines as l, i (i)}
            <span class:strong={i === 0}>{l}</span>
          {/each}
        </div>
        <span class="badge">{countdown}</span>
      </div>

      {#if ev.repeat}
        <div class="line">
          <Icon name="repeat" size={22} />
          <div class="text"><span>{repeatSummary(ev.repeat, ev.date)}</span></div>
        </div>
      {/if}

      {#if ev.location}
        <div class="line">
          <Icon name="pin" size={22} />
          <div class="text"><span>{ev.location}</span></div>
          <button class="link" onclick={openMap}>Mappa</button>
        </div>
      {/if}

      {#if category}
        <div class="line">
          <Icon name="tag" size={22} />
          <div class="text cat"><span class="dot" style:background={category.color}></span><span>{category.name}</span></div>
        </div>
      {/if}

      {#if ev.alerts.length}
        <div class="line">
          <Icon name="bell" size={22} />
          <div class="text"><span>{alertsSummary(ev.alerts, ev.allDay)}</span></div>
        </div>
      {/if}

      {#if ev.notes}
        <div class="line">
          <Icon name="note" size={22} />
          <div class="text"><span class="notes">{ev.notes}</span></div>
        </div>
      {/if}
    </div>

    {#if ev.checklist.length}
      <div class="box">
        <h4 class="caps">Checklist</h4>
        {#each ev.checklist as item (item.id)}
          <button class="check" role="checkbox" aria-checked={item.done} onclick={() => run(() => toggleChecklist(ev, item.id))}>
            <span class="tick" class:on={item.done}>{#if item.done}<Icon name="check" size={14} stroke={3} />{/if}</span>
            <span class="ctext" class:done={item.done}>{item.text}</span>
          </button>
        {/each}
      </div>
    {/if}

    {#if isReminder}
      <button class="btn btn-block" class:btn-primary={!done} onclick={() => run(() => toggleDone(ev, date))}>
        <Icon name={done ? 'undo' : 'check'} size={20} />
        <span>{done ? 'Segna come da fare' : 'Segna come fatto'}</span>
      </button>
    {:else if !ev.allDay && ended}
      <div class="box">
        <h4 class="caps">Ore effettive</h4>
        {#if fixing}
          <div class="fix">
            <label><input class="input num" type="number" inputmode="numeric" min="0" max="240" bind:value={fixHours} /><span>ore</span></label>
            <label><input class="input num" type="number" inputmode="numeric" min="0" max="59" bind:value={fixMinutes} /><span>minuti</span></label>
          </div>
          <div class="pair">
            <button class="btn" onclick={() => (fixing = false)}>Annulla</button>
            <button class="btn btn-primary" onclick={saveFix}>Salva</button>
          </div>
        {:else if actual !== undefined}
          <p class="state">
            Segnate <strong>{fmtDuration(actual)}</strong>{actual !== planned ? ` (programmate ${fmtDuration(planned)})` : ''}.
          </p>
          <div class="pair">
            <button class="btn" onclick={startFix}>Correggi</button>
            <button class="btn" onclick={() => run(() => saveActual(ev, date, null))}>Togli</button>
          </div>
        {:else}
          <p class="state">Hai fatto davvero {fmtDuration(planned)}? Conferma o correggi: il recap sarà preciso.</p>
          <div class="pair">
            <button class="btn btn-primary" onclick={() => run(() => saveActual(ev, date, planned))}>Conferma {fmtDuration(planned)}</button>
            <button class="btn" onclick={startFix}>Correggi</button>
          </div>
        {/if}
      </div>
    {/if}

    {#if askDelete}
      <div class="box" role="group" aria-label="Cosa eliminare">
        <p class="state">Questo impegno si ripete. Cosa vuoi eliminare?</p>
        <button class="btn btn-block" onclick={() => run(() => removeOccurrence(ev, date))}>Solo {fmtDayShort(date, year)}</button>
        <button class="btn btn-danger btn-block" onclick={() => run(() => removeEvent(ev))}>Tutti i giorni della ripetizione</button>
        <button class="btn btn-ghost btn-block" onclick={() => (askDelete = false)}>Annulla</button>
      </div>
    {/if}

    {#if !isReminder}
      <button class="link wide" onclick={() => run(() => saveAsTemplate(ev))}>
        <Icon name="star" size={18} />
        <span>Salva come modello</span>
      </button>
    {/if}

    {#snippet footer()}
      <button class="btn" onclick={onDelete}>
        <Icon name="trash" size={20} />
        <span>Elimina</span>
      </button>
      <button class="btn btn-primary" onclick={() => startEdit(ev)}>
        <Icon name="edit" size={20} />
        <span>Modifica</span>
      </button>
    {/snippet}
  </Sheet>
{/if}

<style>
  .headline {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 4px 0 14px;
  }
  .swatch {
    width: 14px;
    height: 14px;
    margin-top: 9px;
    border-radius: 5px;
    flex: none;
  }
  h3 {
    margin: 0;
    font-size: 1.5rem;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  h3.done {
    text-decoration: line-through;
    color: var(--text-dim);
  }
  .rows {
    display: flex;
    flex-direction: column;
  }
  .line {
    min-height: 48px;
    padding: 10px 0;
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }
  .line :global(svg) {
    color: var(--text-muted);
    margin-top: 1px;
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.9375rem;
    line-height: 1.45;
    color: var(--text-muted);
  }
  .text .strong,
  .text.cat,
  .text .notes {
    color: var(--text);
  }
  .text.cat {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }
  .notes {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .badge {
    flex: none;
    height: 26px;
    padding: 0 10px;
    border-radius: 9px;
    background: var(--border);
    font-size: 0.8125rem;
    font-weight: 600;
    display: flex;
    align-items: center;
  }
  .link {
    flex: none;
    min-height: 44px;
    padding: 0 8px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--accent);
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .link.wide {
    margin-top: 6px;
  }
  .box {
    margin-top: 10px;
    padding: 14px;
    border-radius: 16px;
    background: var(--surface-2);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .state {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.45;
    color: var(--text-muted);
  }
  .state strong {
    color: var(--text);
    font-weight: 600;
  }
  .pair {
    display: flex;
    gap: 8px;
  }
  .pair .btn {
    flex: 1;
    min-height: 44px;
    padding: 0 12px;
    font-size: 0.9375rem;
  }
  .fix {
    display: flex;
    gap: 10px;
  }
  .fix label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9375rem;
    color: var(--text-muted);
  }
  .fix .input {
    background: var(--border);
    text-align: center;
  }
  .check {
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
  }
  .tick {
    width: 22px;
    height: 22px;
    flex: none;
    border-radius: 7px;
    box-shadow: inset 0 0 0 2px var(--text-dim);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-ink);
  }
  .tick.on {
    background: var(--accent);
    box-shadow: none;
  }
  .ctext {
    flex: 1;
    font-size: 0.9375rem;
    line-height: 1.4;
  }
  .ctext.done {
    text-decoration: line-through;
    color: var(--text-dim);
  }
  .rows + :global(.btn-block) {
    margin-top: 10px;
  }
</style>
