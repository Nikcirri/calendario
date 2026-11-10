<script lang="ts">
  import { onMount } from 'svelte';
  import { APP_VERSION } from '../lib/platform';
  import { registerOverlay } from '../lib/state/ui.svelte';
  import { installUpdate, update } from '../lib/state/update.svelte';
  import Icon from '../lib/ui/Icon.svelte';

  const release = $derived(update.available);
  const busy = $derived(update.phase === 'download');

  function later() {
    if (!busy) update.dismissed = true;
  }

  onMount(() => registerOverlay(later));
</script>

{#if release}
  <div class="backdrop" role="presentation" onclick={later}></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="upd-title">
    <div class="handle" aria-hidden="true"></div>
    <div class="head">
      <span class="tile"><Icon name="download" stroke={2} /></span>
      <div class="titles">
        <h2 id="upd-title" class="display">Nuova versione disponibile</h2>
        <p class="num">Versione {release.version} · installata {APP_VERSION}</p>
      </div>
    </div>

    {#if release.notes.length}
      <div class="news">
        <h3 class="caps">Novità</h3>
        <ul>
          {#each release.notes as note, i (i)}
            <li>{note}</li>
          {/each}
        </ul>
      </div>
    {/if}

    <div class="buttons">
      <button class="btn btn-primary" disabled={busy} onclick={() => void installUpdate()}>
        {#if busy}
          Scarico… {update.percent}%
        {:else if update.phase === 'install'}
          Apri l’installazione
        {:else}
          Aggiorna ora
        {/if}
      </button>
      <button class="btn" disabled={busy} onclick={later}>Più tardi</button>
    </div>
    <p class="foot">Puoi controllare quando vuoi da Impostazioni, sezione Aggiornamenti. I tuoi dati restano.</p>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 44;
    background: rgb(6 7 12 / 0.74);
    animation: fade 160ms ease-out;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 45;
    padding: 12px 20px calc(24px + var(--safe-bottom));
    border-radius: 28px 28px 0 0;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: up 200ms ease-out;
  }
  .handle {
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    align-self: center;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .tile {
    width: 48px;
    height: 48px;
    flex: none;
    border-radius: 14px;
    background: var(--accent);
    color: var(--accent-ink);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  h2 {
    margin: 0;
    font-size: 1.375rem;
  }
  .titles p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-muted);
  }
  .news {
    padding: 12px 16px 14px;
    border-radius: 16px;
    background: var(--surface-2);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  ul {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.9375rem;
    line-height: 1.45;
  }
  .buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .buttons .btn {
    min-height: 52px;
  }
  .foot {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-muted);
    text-align: center;
  }
  @keyframes up {
    from {
      transform: translateY(100%);
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>
