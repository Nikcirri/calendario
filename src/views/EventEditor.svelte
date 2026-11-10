<script lang="ts">
  import { onMount } from 'svelte';
  import { removeTemplate, run, saveAsTemplate, saveEvent } from '../lib/actions';
  import { reportError } from '../lib/errors';
  import { addDays, capitalize, diffDays, fmtDayShort, fmtTime, isDateKey, parseKey, parseTime } from '../lib/logic/dates';
  import { alertOptions, alertsSummary, convertAlerts, newId, PALETTE } from '../lib/logic/model';
  import { findOverlaps } from '../lib/logic/occurrences';
  import { parseQuickAdd } from '../lib/logic/quickadd';
  import { normalizeRepeat, repeatSummary } from '../lib/logic/recurrence';
  import { app, colorOf, data, sheets, type EditorRequest } from '../lib/state/app.svelte';
  import { confirmDialog, registerOverlay, showToast } from '../lib/state/ui.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import PickerField from '../lib/ui/PickerField.svelte';
  import Sheet from '../lib/ui/Sheet.svelte';
  import Switch from '../lib/ui/Switch.svelte';
  import type { CalEvent, EventKind, Template } from '../lib/types';
  import RepeatSheet from './RepeatSheet.svelte';

  let { request }: { request: EditorRequest } = $props();

  // L'evento com'era all'apertura (per capire se ci sono modifiche da salvare).
  const original = (() => JSON.stringify(request.event))();
  // Copia di lavoro: nel database arriva solo con "Salva".
  let ev = $state<CalEvent>(JSON.parse(original) as CalEvent);
  let quick = $state('');
  let newItem = $state('');
  let saving = $state(false);
  let picker = $state<'category' | 'alerts' | 'repeat' | 'color' | null>(null);
  let editTemplates = $state(false);
  let titleInput = $state<HTMLInputElement | null>(null);

  const isReminder = $derived(ev.kind === 'reminder');
  const year = $derived(parseKey(app.today).y);
  const category = $derived(ev.categoryId ? data.categoryById.get(ev.categoryId) : undefined);
  const color = $derived(colorOf(ev));
  const overlaps = $derived(findOverlaps(data.events, $state.snapshot(ev) as CalEvent));
  const dirty = $derived(JSON.stringify($state.snapshot(ev)) !== original);

  function close() {
    sheets.editor = null;
  }

  async function cancel() {
    if (dirty) {
      const leave = await confirmDialog({
        title: 'Uscire senza salvare?',
        message: 'Le modifiche che hai fatto andranno perse.',
        confirmLabel: 'Esci',
        cancelLabel: 'Resta',
      });
      if (!leave) return;
    }
    close();
  }

  onMount(() => {
    if (request.isNew) titleInput?.focus();
    return registerOverlay(() => void cancel());
  });

  // ---------- Evento / Promemoria ----------

  function setKind(kind: EventKind) {
    if (ev.kind === kind) return;
    ev.kind = kind;
    if (kind === 'reminder') {
      ev.endDate = ev.date;
      ev.end = ev.start;
      ev.alerts = ev.allDay ? [-540] : [0];
    } else {
      ev.end = Math.min(1439, ev.start + 60);
      ev.alerts = ev.allDay ? [] : [...app.settings.defaultAlerts];
    }
  }

  // ---------- Inserimento rapido ----------

  function applyQuick() {
    const text = quick.trim();
    if (!text) return;
    const parsed = parseQuickAdd(text, ev.date, app.today);
    if (parsed.title) ev.title = parsed.title;
    if (parsed.hasDate || parsed.hasTime) {
      const wasAllDay = ev.allDay;
      ev.date = parsed.date;
      ev.endDate = isReminder ? parsed.date : parsed.endDate;
      if (parsed.hasTime) {
        ev.allDay = false;
        ev.start = parsed.start;
        ev.end = isReminder ? parsed.start : parsed.end;
        if (wasAllDay) ev.alerts = convertAlerts(ev.alerts, false);
      }
      if (ev.repeat) ev.repeat = normalizeRepeat($state.snapshot(ev.repeat), ev.date);
    }
    quick = '';
  }

  // ---------- Modelli ----------

  function applyTemplate(t: Template) {
    ev.title = t.title;
    ev.allDay = t.allDay;
    ev.start = t.start;
    ev.end = isReminder ? t.start : t.end;
    ev.endDate = ev.date;
    ev.location = t.location;
    ev.categoryId = t.categoryId && data.categoryById.has(t.categoryId) ? t.categoryId : null;
    ev.color = t.color;
    ev.alerts = [...t.alerts];
  }

  function templateLabel(t: Template): string {
    return t.allDay ? t.title : `${t.title} ${fmtTime(t.start).replace(/^0/, '')}–${fmtTime(t.end).replace(/^0/, '')}`;
  }

  // ---------- Giorno e orario ----------

  function setAllDay(value: boolean) {
    ev.allDay = value;
    ev.alerts = convertAlerts(ev.alerts, value);
  }

  function setStartDate(value: string) {
    if (!isDateKey(value)) return;
    const shift = diffDays(ev.date, value);
    ev.date = value;
    ev.endDate = isReminder ? value : addDays(ev.endDate, shift);
    if (ev.repeat) ev.repeat = normalizeRepeat($state.snapshot(ev.repeat), value);
  }

  function setStartTime(value: string) {
    const minutes = parseTime(value);
    if (minutes === null) return;
    if (isReminder) {
      ev.start = minutes;
      ev.end = minutes;
      return;
    }
    // La durata resta la stessa: la fine si sposta insieme all'inizio.
    const duration = diffDays(ev.date, ev.endDate) * 1440 + ev.end - ev.start;
    ev.start = minutes;
    const total = minutes + Math.max(0, duration);
    ev.endDate = addDays(ev.date, Math.floor(total / 1440));
    ev.end = total % 1440;
  }

  function setEndDate(value: string) {
    if (isDateKey(value)) ev.endDate = value < ev.date ? ev.date : value;
  }

  function setEndTime(value: string) {
    const minutes = parseTime(value);
    if (minutes === null) return;
    ev.end = minutes;
    // Fine prima dell'inizio nello stesso giorno: si intende il giorno dopo (es. turno di notte).
    if (ev.endDate === ev.date && minutes <= ev.start) ev.endDate = addDays(ev.date, 1);
  }

  // ---------- Avvisi ----------

  function toggleAlert(value: number) {
    if (ev.alerts.includes(value)) ev.alerts = ev.alerts.filter((a) => a !== value);
    else if (ev.alerts.length >= 3) showToast('Puoi scegliere al massimo 3 avvisi.');
    else ev.alerts = [...ev.alerts, value];
  }

  // ---------- Checklist ----------

  function addItem() {
    const text = newItem.trim();
    if (!text) return;
    ev.checklist.push({ id: newId(), text, done: false });
    newItem = '';
  }

  // ---------- Salvataggio ----------

  async function save() {
    if (saving) return;
    const out = $state.snapshot(ev) as CalEvent;
    out.title = out.title.trim();
    out.location = out.location.trim();
    out.notes = out.notes.trim();
    out.checklist = out.checklist.map((i) => ({ ...i, text: i.text.trim() })).filter((i) => i.text);
    if (!out.title) {
      showToast(isReminder ? 'Scrivi cosa devi ricordare.' : 'Scrivi un titolo per l’evento.');
      titleInput?.focus();
      return;
    }
    if (out.kind === 'reminder') {
      out.endDate = out.date;
      out.end = out.start;
    } else if (out.allDay) {
      if (out.endDate < out.date) out.endDate = out.date;
    } else if (out.endDate < out.date || (out.endDate === out.date && out.end <= out.start)) {
      showToast('La fine deve essere dopo l’inizio.');
      return;
    }
    if (out.repeat) out.repeat = normalizeRepeat(out.repeat, out.date);
    saving = true;
    try {
      await saveEvent(out, request.isNew);
      app.cursor = out.date;
      close();
    } catch (e) {
      reportError(e, 'Non riesco a salvare.');
    } finally {
      saving = false;
    }
  }
</script>

<div class="page editor" role="dialog" aria-modal="true" aria-label={request.isNew ? 'Nuovo evento o promemoria' : 'Modifica'}>
  <div class="page-body">
    <div class="segment" role="group" aria-label="Tipo">
      <button aria-pressed={!isReminder} class:on={!isReminder} onclick={() => setKind('event')}>Evento</button>
      <button aria-pressed={isReminder} class:on={isReminder} onclick={() => setKind('reminder')}>Promemoria</button>
    </div>

    {#if request.isNew}
      <div class="section">
        <label class="caps" for="ed-quick">Inserimento rapido</label>
        <form
          class="quick"
          onsubmit={(e) => {
            e.preventDefault();
            applyQuick();
          }}
        >
          <Icon name="bolt" size={20} />
          <input id="ed-quick" type="text" bind:value={quick} placeholder="Cena con Marco domani alle 20" enterkeyhint="done" autocomplete="off" onblur={applyQuick} />
        </form>
      </div>

      {#if !isReminder}
        <div class="section">
          <div class="caps-row">
            <h2 class="caps">Modelli</h2>
            {#if data.templates.length}
              <button class="link" onclick={() => (editTemplates = !editTemplates)}>{editTemplates ? 'Fatto' : 'Modifica'}</button>
            {/if}
          </div>
          <div class="templates">
            {#each data.templates as t (t.id)}
              {#if editTemplates}
                <button class="chip del" aria-label={`Elimina il modello ${t.title}`} onclick={() => run(() => removeTemplate(t))}>
                  <Icon name="close" size={16} />
                  <span>{t.title}</span>
                </button>
              {:else}
                <button class="chip" onclick={() => applyTemplate(t)}>
                  <span class="dot" style:background={colorOf(t)}></span>
                  <span>{templateLabel(t)}</span>
                </button>
              {/if}
            {/each}
            <button class="chip add" onclick={() => run(() => saveAsTemplate($state.snapshot(ev) as CalEvent))}>
              <Icon name="plus" size={18} />
              <span>{data.templates.length ? 'Salva come modello' : 'Salva questo evento come modello'}</span>
            </button>
          </div>
        </div>
      {/if}
    {/if}

    <div class="card">
      <div class="titlerow">
        <label class="titlefield">
          <span>{isReminder ? 'Cosa ricordare' : 'Titolo'}</span>
          <input
            type="text"
            class="display"
            bind:value={ev.title}
            bind:this={titleInput}
            placeholder={isReminder ? 'Es. Pagare la bolletta' : 'Nome dell’evento'}
            maxlength="200"
            autocomplete="off"
            enterkeyhint="done"
          />
        </label>
        <button class="icon-btn" aria-label="Scegli il colore" onclick={() => (picker = 'color')}>
          <span class="swatch" style:background={color}></span>
        </button>
      </div>

      <div class="row">
        <Icon name="clock" size={22} />
        <span class="label grow" id="ed-allday">Tutto il giorno</span>
        <Switch checked={ev.allDay} onchange={setAllDay} labelledby="ed-allday" />
      </div>

      <div class="times" class:one={isReminder}>
        <div class="timebox">
          <PickerField type="date" value={ev.date} text={capitalize(fmtDayShort(ev.date, year))} label={isReminder ? 'Giorno' : 'Giorno di inizio'} onchange={setStartDate} />
          {#if !ev.allDay}
            <PickerField type="time" variant="big" value={fmtTime(ev.start)} text={fmtTime(ev.start)} label={isReminder ? 'Ora' : 'Ora di inizio'} onchange={setStartTime} />
          {/if}
        </div>
        {#if !isReminder}
          <span class="arrow" role="img" aria-label="fino a"><Icon name="arrowRight" size={20} /></span>
          <div class="timebox">
            <PickerField type="date" value={ev.endDate} min={ev.date} text={capitalize(fmtDayShort(ev.endDate, year))} label="Giorno di fine" onchange={setEndDate} />
            {#if !ev.allDay}
              <PickerField type="time" variant="big" value={fmtTime(ev.end)} text={fmtTime(ev.end)} label="Ora di fine" onchange={setEndTime} />
            {/if}
          </div>
        {/if}
      </div>

      {#if overlaps.length}
        {@const first = overlaps[0]!}
        <div class="warn" role="status">
          <Icon name="warning" size={20} />
          <span>
            Si sovrappone a <strong>{first.event.title || 'un altro evento'}</strong>, {fmtTime(first.event.start)} – {fmtTime(first.event.end)}{overlaps.length > 1
              ? ` (e ${overlaps.length - 1} ${overlaps.length === 2 ? 'altro' : 'altri'})`
              : ''}.
          </span>
        </div>
      {/if}

      {#if ev.repeat && !request.isNew}
        <p class="note">Le modifiche valgono per tutti i giorni di questa ripetizione.</p>
      {/if}

      <label class="row">
        <Icon name="pin" size={22} />
        <span class="label">Luogo</span>
        <input class="inline" type="text" bind:value={ev.location} placeholder="Aggiungi" maxlength="300" autocomplete="off" enterkeyhint="done" />
      </label>

      {#if !isReminder}
        <button class="row" onclick={() => (picker = 'category')}>
          <Icon name="tag" size={22} />
          <span class="label">Categoria</span>
          {#if category}
            <span class="value cat"><span class="dot" style:background={category.color}></span>{category.name}</span>
          {:else}
            <span class="value empty">Nessuna</span>
          {/if}
          <Icon name="chevronRight" size={18} />
        </button>
      {/if}

      <button class="row" onclick={() => (picker = 'alerts')}>
        <Icon name="bell" size={22} />
        <span class="label">Avviso</span>
        <span class="value" class:empty={!ev.alerts.length}>{alertsSummary(ev.alerts, ev.allDay)}</span>
        <Icon name="chevronRight" size={18} />
      </button>

      <button class="row" onclick={() => (picker = 'repeat')}>
        <Icon name="repeat" size={22} />
        <span class="label">Ripeti</span>
        <span class="value" class:empty={!ev.repeat}>{repeatSummary(ev.repeat, ev.date)}</span>
        <Icon name="chevronRight" size={18} />
      </button>

      <label class="row top">
        <Icon name="note" size={22} />
        <span class="label">Note</span>
        <textarea class="inline" rows={ev.notes.includes('\n') || ev.notes.length > 30 ? 3 : 1} bind:value={ev.notes} placeholder="Aggiungi" maxlength="5000"></textarea>
      </label>

      <div class="row top">
        <Icon name="checklist" size={22} />
        <div class="checklist">
          <span class="label">Checklist</span>
          {#each ev.checklist as item, i (item.id)}
            <div class="citem">
              <input type="text" bind:value={item.text} aria-label={`Voce ${i + 1}`} maxlength="300" />
              <button class="icon-btn" aria-label={`Togli la voce ${item.text}`} onclick={() => ev.checklist.splice(i, 1)}>
                <Icon name="close" size={18} />
              </button>
            </div>
          {/each}
          <form
            class="citem"
            onsubmit={(e) => {
              e.preventDefault();
              addItem();
            }}
          >
            <input type="text" bind:value={newItem} placeholder="Aggiungi una voce" aria-label="Nuova voce della checklist" maxlength="300" enterkeyhint="done" onblur={addItem} />
          </form>
        </div>
      </div>
    </div>
  </div>

  <div class="actions">
    <button class="btn" onclick={cancel}>Annulla</button>
    <button class="btn btn-primary" disabled={saving} onclick={save}>Salva</button>
  </div>
</div>

{#if picker === 'category'}
  <Sheet title="Categoria" onclose={() => (picker = null)}>
    <div class="options">
      <button
        class="option"
        aria-pressed={ev.categoryId === null}
        onclick={() => {
          ev.categoryId = null;
          picker = null;
        }}
      >
        <span class="dot" style:background="#7d8799"></span>
        <span class="grow">Nessuna</span>
        {#if ev.categoryId === null}<Icon name="check" size={20} />{/if}
      </button>
      {#each data.categories as c (c.id)}
        <button
          class="option"
          aria-pressed={ev.categoryId === c.id}
          onclick={() => {
            ev.categoryId = c.id;
            picker = null;
          }}
        >
          <span class="dot" style:background={c.color}></span>
          <span class="grow">{c.name}</span>
          {#if ev.categoryId === c.id}<Icon name="check" size={20} />{/if}
        </button>
      {/each}
    </div>
    <p class="hint">Le categorie servono per il recap delle ore. Puoi crearne altre dal menu, in “Gestisci categorie”.</p>
  </Sheet>
{/if}

{#if picker === 'alerts'}
  <Sheet title="Avviso" onclose={() => (picker = null)}>
    <div class="options">
      {#each alertOptions(ev.allDay) as o (o.value)}
        {@const on = ev.alerts.includes(o.value)}
        <button class="option" role="checkbox" aria-checked={on} onclick={() => toggleAlert(o.value)}>
          <span class="tick" class:on>{#if on}<Icon name="check" size={14} stroke={3} />{/if}</span>
          <span class="grow">{o.label}</span>
        </button>
      {/each}
    </div>
    {#if !app.settings.notifications}
      <p class="hint">Le notifiche sono spente nelle impostazioni dell’app: gli avvisi non arriveranno finché non le riaccendi.</p>
    {/if}
    {#snippet footer()}
      <button class="btn btn-primary" onclick={() => (picker = null)}>Fatto</button>
    {/snippet}
  </Sheet>
{/if}

{#if picker === 'color'}
  <Sheet title="Colore" onclose={() => (picker = null)}>
    <div class="colors">
      {#each PALETTE as c (c)}
        <button
          class="colorbtn"
          aria-label={`Colore ${c}`}
          aria-pressed={ev.color === c}
          style:background={c}
          onclick={() => {
            ev.color = c;
            picker = null;
          }}
        >
          {#if ev.color === c}<Icon name="check" stroke={3} />{/if}
        </button>
      {/each}
    </div>
    <button
      class="btn btn-block"
      onclick={() => {
        ev.color = null;
        picker = null;
      }}
    >
      {isReminder ? 'Colore normale' : 'Usa il colore della categoria'}
    </button>
  </Sheet>
{/if}

{#if picker === 'repeat'}
  <RepeatSheet repeat={ev.repeat ? ($state.snapshot(ev.repeat) as NonNullable<CalEvent['repeat']>) : null} start={ev.date} onsave={(r) => (ev.repeat = r)} onclose={() => (picker = null)} />
{/if}

<style>
  .editor {
    z-index: 38;
  }
  .editor .page-body {
    padding-top: 12px;
    gap: 14px;
  }
  .segment {
    height: 52px;
    flex: none;
    padding: 4px;
    border-radius: 16px;
    background: var(--surface);
    display: flex;
    gap: 4px;
  }
  .segment button {
    flex: 1;
    border-radius: 12px;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-muted);
  }
  .segment button.on {
    background: var(--border);
    color: var(--text);
    font-weight: 600;
  }
  .section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .section > .caps,
  .caps-row .caps {
    padding-left: 4px;
  }
  .caps-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 24px;
  }
  .link {
    min-height: 32px;
    padding: 0 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--accent);
  }
  .quick {
    height: 48px;
    padding: 0 14px;
    border-radius: 14px;
    background: var(--surface-2);
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text-muted);
  }
  .quick:focus-within {
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }
  .quick input {
    flex: 1;
    min-width: 0;
    height: 44px;
    border: 0;
    background: none;
    outline: none;
    font-size: 0.9375rem;
  }
  .templates {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip.add {
    color: var(--text-muted);
  }
  .chip.del {
    box-shadow: inset 0 0 0 1.5px var(--danger);
    color: var(--danger);
  }
  .titlerow {
    min-height: 64px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .card > .row {
    border-top: 1px solid var(--border);
  }
  .titlefield {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 0;
  }
  .titlefield span {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .titlefield input {
    width: 100%;
    height: 30px;
    padding: 0;
    border: 0;
    background: none;
    outline: none;
    font-size: 1.25rem;
    font-weight: 500;
  }
  .swatch {
    width: 22px;
    height: 22px;
    border-radius: 50%;
  }
  .row :global(svg) {
    color: var(--text-muted);
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .row.top {
    align-items: flex-start;
    padding: 13px 0;
  }
  .row.top :global(svg) {
    margin-top: 1px;
  }
  .value.cat {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }
  .inline {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: 0;
    background: none;
    outline: none;
    text-align: right;
    font-size: 0.9375rem;
    line-height: 1.45;
    resize: none;
  }
  textarea.inline {
    text-align: left;
    padding-left: 8px;
  }
  .times {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0 12px;
  }
  .timebox {
    flex: 1;
    min-width: 0;
    min-height: 60px;
    padding: 6px 4px;
    border-radius: 14px;
    background: var(--surface-2);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .arrow {
    flex: none;
    color: var(--text-muted);
  }
  .warn {
    min-height: 44px;
    margin: 0 0 8px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--border);
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.8125rem;
    line-height: 1.4;
  }
  .warn strong {
    font-weight: 600;
  }
  .note {
    margin: 0 0 8px;
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-muted);
  }
  .checklist {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .citem {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .citem input {
    flex: 1;
    min-width: 0;
    height: 44px;
    padding: 0 12px;
    border: 0;
    border-radius: 12px;
    background: var(--surface-2);
    outline: none;
    font-size: 0.9375rem;
  }
  .citem input:focus {
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }
  .actions {
    flex: none;
    display: flex;
    gap: 10px;
    padding: 10px 12px calc(14px + var(--safe-bottom));
  }
  .actions .btn {
    flex: 1;
    min-height: 52px;
    background: var(--surface-2);
  }
  .actions .btn-primary {
    background: var(--accent);
  }
  .options {
    display: flex;
    flex-direction: column;
  }
  .option {
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
    font-size: 1rem;
  }
  .option + .option {
    border-top: 1px solid var(--border);
  }
  .option :global(svg) {
    color: var(--accent);
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
  }
  .tick.on {
    background: var(--accent);
    box-shadow: none;
  }
  .tick.on :global(svg) {
    color: var(--accent-ink);
  }
  .hint {
    margin: 14px 0 0;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: var(--text-muted);
  }
  .colors {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    padding: 4px 0 16px;
  }
  .colorbtn {
    height: 56px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #0b0d14;
  }
</style>
