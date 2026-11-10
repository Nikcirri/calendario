<script lang="ts">
  import { onMount } from 'svelte';
  import { quickCreate, run, startNewEvent } from './lib/actions';
  import { reportError } from './lib/errors';
  import { capitalize, fmtDayShort, isDateKey, monthName, parseKey, startOfWeek } from './lib/logic/dates';
  import { useNotificationSync } from './lib/notifySync.svelte';
  import { onBackButton, onResume, tapFeedback } from './lib/platform';
  import { forgetNotificationPlan, onNotificationTap } from './lib/services/notifications';
  import { app, closePage, findEvent, goToday, initApp, openPage, selectDay, sheets, shiftView, tickNow } from './lib/state/app.svelte';
  import { closeTopOverlay } from './lib/state/ui.svelte';
  import { announceNewVersion, refreshUpdate, resumeUpdate, update } from './lib/state/update.svelte';
  import BusyOverlay from './lib/ui/BusyOverlay.svelte';
  import DialogHost from './lib/ui/DialogHost.svelte';
  import Icon from './lib/ui/Icon.svelte';
  import Toast from './lib/ui/Toast.svelte';
  import AgendaView from './views/AgendaView.svelte';
  import Categories from './views/Categories.svelte';
  import Drawer from './views/Drawer.svelte';
  import EventDetail from './views/EventDetail.svelte';
  import EventEditor from './views/EventEditor.svelte';
  import MonthView from './views/MonthView.svelte';
  import Recap from './views/Recap.svelte';
  import Search from './views/Search.svelte';
  import Settings from './views/Settings.svelte';
  import TimeGridView from './views/TimeGridView.svelte';
  import Trash from './views/Trash.svelte';
  import UpdateSheet from './views/UpdateSheet.svelte';
  import YearView from './views/YearView.svelte';

  // Le notifiche del telefono seguono gli avvisi degli eventi.
  useNotificationSync();

  let quickText = $state('');
  let dateInput = $state<HTMLInputElement | null>(null);

  const title = $derived.by(() => {
    const { y } = parseKey(app.cursor);
    if (app.view === 'year') return { main: String(y), sub: '' };
    if (app.view === 'agenda') return { main: 'Programma', sub: '' };
    if (app.view === 'day') return { main: capitalize(fmtDayShort(app.cursor)), sub: String(y) };
    const ref = app.view === 'week' ? startOfWeek(app.cursor) : app.cursor;
    return { main: monthName(ref), sub: String(parseKey(ref).y) };
  });
  const todayNumber = $derived(parseKey(app.today).d);

  // ---------- Scorrimento laterale: mese / settimana / giorno / anno precedente o successivo ----------
  let swipeStart: { x: number; y: number } | null = null;

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    swipeStart = t && e.touches.length === 1 && app.view !== 'agenda' ? { x: t.clientX, y: t.clientY } : null;
  }

  function onTouchEnd(e: TouchEvent) {
    const start = swipeStart;
    swipeStart = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
    shiftView(dx < 0 ? 1 : -1);
  }

  function pickDate() {
    const input = dateInput;
    if (!input) return;
    input.value = app.cursor;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  }

  function onDatePicked() {
    const value = dateInput?.value;
    if (isDateKey(value)) selectDay(value);
  }

  async function submitQuick(e: SubmitEvent) {
    e.preventDefault();
    const text = quickText;
    if (!text.trim()) {
      startNewEvent(app.cursor);
      return;
    }
    try {
      if (await quickCreate(text)) quickText = '';
    } catch (err) {
      reportError(err, 'Non riesco a creare l’evento.');
    }
  }

  onMount(() => {
    initApp()
      .then(async () => {
        await announceNewVersion().catch(() => undefined);
        await refreshUpdate();
      })
      .catch((e: unknown) => reportError(e, 'Non riesco a leggere i dati dell’app.'));

    onBackButton(() => {
      if (closeTopOverlay()) return true;
      if (app.cursor !== app.today) {
        goToday();
        return true;
      }
      return false;
    });
    onResume(() => {
      tickNow();
      forgetNotificationPlan();
      void resumeUpdate();
      void refreshUpdate();
    });
    onNotificationTap((eventId, date) => {
      const open = () => {
        if (!findEvent(eventId)) return;
        closePage();
        app.drawer = false;
        sheets.editor = null;
        selectDay(date);
        sheets.detail = { id: eventId, date };
      };
      // Se l'app si sta ancora aprendo, i dati arrivano un attimo dopo.
      if (app.ready) open();
      else setTimeout(open, 900);
    });
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') tickNow();
    }, 30_000);
    return () => clearInterval(timer);
  });
</script>

{#if !app.ready}
  <div class="loading" role="status" aria-label="Caricamento"></div>
{:else}
  <div class="shell">
    <header class="top">
      <button class="icon-btn" aria-label="Apri il menu" onclick={() => (app.drawer = true)}>
        <Icon name="menu" />
      </button>
      <button class="title" onclick={pickDate} aria-label={`${title.main} ${title.sub}: vai a una data`}>
        <span class="display main">{title.main}</span>
        {#if title.sub}<span class="sub">{title.sub}</span>{/if}
      </button>
      <input class="date-jump" type="date" tabindex="-1" aria-hidden="true" bind:this={dateInput} onchange={onDatePicked} />
      <button class="icon-btn" aria-label="Cerca" onclick={() => openPage('search')}>
        <Icon name="search" />
      </button>
      <button
        class="icon-btn"
        aria-label={`Torna a oggi, ${fmtDayShort(app.today)}`}
        onclick={() => {
          void tapFeedback();
          goToday();
        }}
      >
        <span class="today-box display" class:off={app.cursor !== app.today}>{todayNumber}</span>
      </button>
    </header>

    <main ontouchstart={onTouchStart} ontouchend={onTouchEnd}>
      {#if app.view === 'month'}
        <MonthView />
      {:else if app.view === 'week'}
        <TimeGridView mode="week" />
      {:else if app.view === 'day'}
        <TimeGridView mode="day" />
      {:else if app.view === 'agenda'}
        <AgendaView />
      {:else}
        <YearView />
      {/if}
    </main>

    <footer class="bottom">
      <form class="quick" onsubmit={submitQuick}>
        <Icon name="bolt" size={20} />
        <input
          type="text"
          bind:value={quickText}
          placeholder={`Scrivi un impegno per ${fmtDayShort(app.cursor)}`}
          aria-label="Inserimento rapido: scrivi un impegno, anche con giorno e ora"
          enterkeyhint="done"
          autocomplete="off"
          maxlength="200"
        />
        {#if quickText.trim()}
          <button class="send" type="submit" aria-label="Crea l’evento">
            <Icon name="send" size={20} stroke={2.2} />
          </button>
        {/if}
      </form>
      <button class="add" aria-label={`Nuovo evento o promemoria per ${fmtDayShort(app.cursor)}`} onclick={() => startNewEvent(app.cursor)}>
        <Icon name="plus" stroke={2.2} />
      </button>
    </footer>
  </div>

  {#if app.drawer}<Drawer />{/if}
  {#if app.page === 'recap'}<Recap />{/if}
  {#if app.page === 'settings'}<Settings />{/if}
  {#if app.page === 'trash'}<Trash />{/if}
  {#if app.page === 'search'}<Search />{/if}
  {#if app.page === 'categories'}<Categories />{/if}
  {#if sheets.detail}
    {#key `${sheets.detail.id}@${sheets.detail.date}`}
      <EventDetail id={sheets.detail.id} date={sheets.detail.date} />
    {/key}
  {/if}
  {#if sheets.editor}
    {#key sheets.editor.event.id}
      <EventEditor request={sheets.editor} />
    {/key}
  {/if}
  {#if update.available && !update.dismissed}<UpdateSheet />{/if}
{/if}

<DialogHost />
<BusyOverlay />
<Toast />

<style>
  .loading {
    height: 100%;
    background: var(--bg);
  }
  .shell {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding-top: var(--safe-top);
    overflow: hidden;
  }
  .top {
    height: 64px;
    flex: none;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px;
    position: relative;
  }
  .title {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding-left: 4px;
    text-align: left;
  }
  .title .main {
    font-size: 1.625rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .title .sub {
    font-size: 0.9375rem;
    color: var(--text-muted);
  }
  /* Il campo data resta invisibile: serve solo ad aprire il calendario del telefono. */
  .date-jump {
    position: absolute;
    left: 56px;
    bottom: 0;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
    border: 0;
    padding: 0;
  }
  .today-box {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 700;
    background: var(--accent);
    color: var(--accent-ink);
  }
  .today-box.off {
    background: none;
    color: var(--text);
    box-shadow: inset 0 0 0 1.5px var(--text-muted);
    font-weight: 600;
  }
  main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .bottom {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px calc(14px + var(--safe-bottom));
  }
  .quick {
    flex: 1;
    min-width: 0;
    height: 52px;
    padding: 0 6px 0 16px;
    border-radius: 16px;
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
    color: var(--text);
  }
  .quick input::placeholder {
    color: var(--text-muted);
  }
  .send {
    width: 40px;
    height: 40px;
    flex: none;
    border-radius: 12px;
    background: var(--accent);
    color: var(--accent-ink);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .add {
    width: 52px;
    height: 52px;
    flex: none;
    border-radius: 16px;
    background: var(--accent);
    color: var(--accent-ink);
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
