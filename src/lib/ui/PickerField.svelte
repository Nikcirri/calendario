<script lang="ts">
  // Campo data o ora: mostra il testo scritto dall'app (sempre in italiano) e, al tocco,
  // apre il selettore del telefono. Il campo vero è invisibile sopra al testo.
  let {
    type,
    value,
    text,
    label,
    variant = 'small',
    min,
    onchange,
    onfocus,
  }: {
    type: 'date' | 'time';
    value: string;
    text: string;
    label: string;
    variant?: 'small' | 'big' | 'pill';
    min?: string;
    onchange: (value: string) => void;
    onfocus?: () => void;
  } = $props();

  function open(e: MouseEvent) {
    try {
      (e.currentTarget as HTMLInputElement).showPicker();
    } catch {
      // Il telefono apre comunque il suo selettore.
    }
  }
</script>

<label class={`pf ${variant}`}>
  <span class:display={variant === 'big'} aria-hidden="true">{text}</span>
  <input {type} {value} {min} aria-label={label} onclick={open} {onfocus} onchange={(e) => onchange(e.currentTarget.value)} />
</label>

<style>
  .pf {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    border-radius: 8px;
    cursor: pointer;
  }
  .pf:focus-within {
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }
  .pf input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    opacity: 0;
    cursor: pointer;
  }
  .small {
    min-height: 22px;
    padding: 0 8px;
    font-size: 0.8125rem;
    color: var(--text-muted);
  }
  .big {
    min-height: 30px;
    padding: 0 8px;
    font-size: 1.25rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .pill {
    flex: 1;
    height: 40px;
    padding: 0 12px;
    border-radius: 10px;
    background: var(--border);
    justify-content: flex-start;
  }
</style>
