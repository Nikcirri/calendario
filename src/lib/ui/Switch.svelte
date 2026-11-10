<script lang="ts">
  // Interruttore acceso/spento. `labelledby` è l'id del testo che lo descrive.
  let { checked, onchange, labelledby, disabled = false }: { checked: boolean; onchange: (value: boolean) => void; labelledby: string; disabled?: boolean } =
    $props();
</script>

<button class="switch" role="switch" aria-checked={checked} aria-labelledby={labelledby} {disabled} onclick={() => onchange(!checked)}>
  <span class="track" class:on={checked}><span class="thumb"></span></span>
</button>

<style>
  .switch {
    width: 52px;
    height: 44px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .track {
    width: 46px;
    height: 26px;
    padding: 3px;
    border-radius: 13px;
    background: var(--border);
    display: flex;
    justify-content: flex-start;
    transition: background 120ms ease;
  }
  .thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--text-muted);
    transition: transform 120ms ease;
  }
  .track.on {
    background: var(--accent);
  }
  .track.on .thumb {
    background: var(--accent-ink);
    transform: translateX(20px);
  }
</style>
