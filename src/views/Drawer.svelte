<script lang="ts">
  import { onMount } from 'svelte';
  import { run } from '../lib/actions';
  import { NO_CATEGORY } from '../lib/logic/recap';
  import { app, data, openPage, setView, toggleHidden } from '../lib/state/app.svelte';
  import { registerOverlay } from '../lib/state/ui.svelte';
  import Icon, { type IconName } from '../lib/ui/Icon.svelte';
  import type { ViewId } from '../lib/types';

  const VIEWS: { id: ViewId; label: string; icon: IconName }[] = [
    { id: 'year', label: 'Anno', icon: 'viewYear' },
    { id: 'month', label: 'Mese', icon: 'calendar' },
    { id: 'week', label: 'Settimana', icon: 'viewWeek' },
    { id: 'day', label: 'Giorno', icon: 'viewDay' },
    { id: 'agenda', label: 'Programma', icon: 'viewAgenda' },
  ];

  const filters = $derived([
    ...data.categories.map((c) => ({ id: c.id, name: c.name, color: c.color })),
    { id: NO_CATEGORY, name: 'Senza categoria', color: '#7d8799' },
  ]);

  function close() {
    app.drawer = false;
  }

  onMount(() => registerOverlay(close));
</script>

<div class="backdrop" role="presentation" onclick={close}></div>
<nav class="drawer" aria-label="Menu principale">
  <div class="top">
    <span class="app display">Calendario</span>
    <button class="icon-btn" aria-label="Impostazioni" onclick={() => openPage('settings')}>
      <Icon name="settings" />
    </button>
  </div>

  <div class="scroll">
    {#each VIEWS as v (v.id)}
      <button class="item" class:on={app.view === v.id} aria-current={app.view === v.id ? 'page' : undefined} onclick={() => setView(v.id)}>
        <Icon name={v.icon} size={22} />
        <span>{v.label}</span>
      </button>
    {/each}

    <div class="sep"></div>

    <button class="item" onclick={() => openPage('recap')}>
      <Icon name="chart" size={22} />
      <span>Recap del mese</span>
    </button>

    <div class="sep"></div>

    <h2 class="caps">Categorie</h2>
    {#each filters as f (f.id)}
      {@const shown = !app.hidden.includes(f.id)}
      <button class="filter" role="checkbox" aria-checked={shown} onclick={() => run(() => toggleHidden(f.id))}>
        <span class="box" style:background={shown ? f.color : 'transparent'} style:box-shadow={shown ? 'none' : `inset 0 0 0 2px ${f.color}`}>
          {#if shown}<Icon name="check" size={13} stroke={3} />{/if}
        </span>
        <span class="fname">{f.name}</span>
      </button>
    {/each}

    <div class="sep"></div>

    <button class="item" onclick={() => openPage('trash')}>
      <Icon name="trash" size={22} />
      <span>Cestino</span>
      {#if data.trash.length}<span class="count num">{data.trash.length}</span>{/if}
    </button>
  </div>

  <button class="btn manage" onclick={() => openPage('categories')}>Gestisci categorie</button>
</nav>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: rgb(4 5 9 / 0.72);
    animation: fade 160ms ease-out;
  }
  .drawer {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 31;
    width: min(318px, calc(100% - 56px));
    padding: calc(8px + var(--safe-top)) 12px calc(14px + var(--safe-bottom));
    background: var(--surface);
    border-radius: 0 24px 24px 0;
    display: flex;
    flex-direction: column;
    animation: slide 180ms ease-out;
  }
  .top {
    height: 56px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: 12px;
  }
  .app {
    font-size: 1.125rem;
    font-weight: 600;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .item {
    height: 46px;
    flex: none;
    padding: 0 12px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 14px;
    text-align: left;
    font-size: 1rem;
    color: var(--text);
  }
  .item :global(svg) {
    color: var(--text-muted);
  }
  .item.on {
    background: var(--border);
    font-weight: 600;
  }
  .item.on :global(svg) {
    color: var(--accent);
  }
  .count {
    margin-left: auto;
    font-size: 0.8125rem;
    color: var(--text-muted);
  }
  .sep {
    height: 1px;
    flex: none;
    margin: 6px 12px;
    background: var(--border);
  }
  .caps {
    height: 28px;
    flex: none;
    padding: 0 12px;
    display: flex;
    align-items: center;
  }
  .filter {
    height: 44px;
    flex: none;
    padding: 0 8px 0 14px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 14px;
    text-align: left;
    font-size: 0.9375rem;
  }
  .box {
    width: 18px;
    height: 18px;
    flex: none;
    border-radius: 5px;
    color: #0b0d14;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .fname {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .manage {
    flex: none;
    margin-top: 8px;
    border-radius: 14px;
  }
  @keyframes slide {
    from {
      transform: translateX(-100%);
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>
