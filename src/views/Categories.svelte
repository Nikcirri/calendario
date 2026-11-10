<script lang="ts">
  import { onMount } from 'svelte';
  import { run } from '../lib/actions';
  import { db } from '../lib/db';
  import { newId, PALETTE } from '../lib/logic/model';
  import { fmtEuro } from '../lib/logic/recap';
  import { deleteCategory, putCategory } from '../lib/repo';
  import { closePage, data } from '../lib/state/app.svelte';
  import { confirmDialog, registerOverlay, showToast } from '../lib/state/ui.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Sheet from '../lib/ui/Sheet.svelte';
  import type { Category } from '../lib/types';

  interface Draft {
    id: string | null;
    name: string;
    color: string;
    goal: string;
    rate: string;
    order: number;
  }

  let draft = $state<Draft | null>(null);

  function edit(c: Category) {
    draft = {
      id: c.id,
      name: c.name,
      color: c.color,
      goal: c.goalHours === null ? '' : String(c.goalHours).replace('.', ','),
      rate: c.hourlyRate === null ? '' : String(c.hourlyRate).replace('.', ','),
      order: c.order,
    };
  }

  function create() {
    const used = new Set(data.categories.map((c) => c.color));
    const color = PALETTE.find((p) => !used.has(p)) ?? PALETTE[0];
    draft = { id: null, name: '', color, goal: '', rate: '', order: data.categories.reduce((m, c) => Math.max(m, c.order + 1), 0) };
  }

  /** "12,5" → 12.5; vuoto → null; non valido → undefined. */
  function parseNumber(text: string, max: number): number | null | undefined {
    const t = text.trim().replace(',', '.');
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 100) / 100 : undefined;
  }

  function details(c: Category): string {
    const bits: string[] = [];
    if (c.goalHours !== null) bits.push(`Tetto ${String(c.goalHours).replace('.', ',')} h al mese`);
    if (c.hourlyRate !== null) bits.push(`${fmtEuro(c.hourlyRate)}/h`);
    return bits.join(' · ');
  }

  function save() {
    const d = draft;
    if (!d) return;
    const name = d.name.trim();
    if (!name) {
      showToast('Scrivi il nome della categoria.');
      return;
    }
    if (data.categories.some((c) => c.id !== d.id && c.name.toLowerCase() === name.toLowerCase())) {
      showToast('Esiste già una categoria con questo nome.');
      return;
    }
    const goal = parseNumber(d.goal, 744);
    const rate = parseNumber(d.rate, 10_000);
    if (goal === undefined) {
      showToast('Il tetto deve essere un numero di ore, ad esempio 100.');
      return;
    }
    if (rate === undefined) {
      showToast('La tariffa deve essere un numero, ad esempio 10 oppure 12,50.');
      return;
    }
    const category: Category = { id: d.id ?? newId(), name, color: d.color, goalHours: goal, hourlyRate: rate, order: d.order };
    draft = null;
    run(() => putCategory(db, category));
  }

  async function remove() {
    const d = draft;
    if (!d?.id) return;
    const id = d.id;
    const count = data.events.filter((e) => e.categoryId === id).length;
    const ok = await confirmDialog({
      title: `Eliminare “${d.name}”?`,
      message: count
        ? `${count === 1 ? 'Un evento resta' : `${count} eventi restano`} nel calendario, senza categoria.`
        : 'Nessun evento usa questa categoria.',
      confirmLabel: 'Elimina',
      danger: true,
    });
    if (!ok) return;
    draft = null;
    run(() => deleteCategory(db, id));
  }

  onMount(() => registerOverlay(closePage));
</script>

<div class="page">
  <div class="page-head">
    <button class="icon-btn" aria-label="Indietro" onclick={closePage}><Icon name="back" /></button>
    <h1>Categorie</h1>
  </div>
  <div class="page-body">
    <p class="intro">Le categorie raggruppano gli impegni (ad esempio “Lavoro”). Nel recap vedi le ore di ogni categoria; se vuoi, aggiungi un tetto di ore al mese e una tariffa oraria.</p>
    {#if data.categories.length}
      <div class="card">
        {#each data.categories as c (c.id)}
          <button class="row" onclick={() => edit(c)}>
            <span class="dot" style:background={c.color}></span>
            <span class="names">
              <span class="name">{c.name}</span>
              {#if details(c)}<span class="sub">{details(c)}</span>{/if}
            </span>
            <Icon name="chevronRight" size={18} />
          </button>
        {/each}
      </div>
    {/if}
    <button class="btn" onclick={create}>
      <Icon name="plus" size={20} />
      <span>Nuova categoria</span>
    </button>
  </div>
</div>

{#if draft}
  <Sheet title={draft.id ? 'Modifica categoria' : 'Nuova categoria'} onclose={() => (draft = null)}>
    <div class="form">
      <label class="field">
        <span>Nome</span>
        <input class="input" type="text" bind:value={draft.name} maxlength="40" placeholder="Es. Lavoro" autocomplete="off" />
      </label>
      <div class="field">
        <span id="cat-color">Colore</span>
        <div class="colors" role="group" aria-labelledby="cat-color">
          {#each PALETTE as c (c)}
            <button class="colorbtn" aria-label={`Colore ${c}`} aria-pressed={draft.color === c} style:background={c} onclick={() => draft && (draft.color = c)}>
              {#if draft.color === c}<Icon name="check" size={20} stroke={3} />{/if}
            </button>
          {/each}
        </div>
      </div>
      <label class="field">
        <span>Tetto di ore al mese (facoltativo)</span>
        <input class="input num" type="text" inputmode="decimal" bind:value={draft.goal} placeholder="Es. 100" autocomplete="off" />
      </label>
      <label class="field">
        <span>Tariffa oraria in euro (facoltativa)</span>
        <input class="input num" type="text" inputmode="decimal" bind:value={draft.rate} placeholder="Es. 10" autocomplete="off" />
      </label>
      {#if draft.id}
        <button class="btn btn-ghost danger" onclick={remove}>
          <Icon name="trash" size={20} />
          <span>Elimina categoria</span>
        </button>
      {/if}
    </div>
    {#snippet footer()}
      <button class="btn" onclick={() => (draft = null)}>Annulla</button>
      <button class="btn btn-primary" onclick={save}>Salva</button>
    {/snippet}
  </Sheet>
{/if}

<style>
  .intro {
    margin: 0 4px;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--text-muted);
  }
  .card {
    flex: none;
  }
  .row {
    min-height: 56px;
  }
  .row :global(svg) {
    color: var(--text-dim);
  }
  .names {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 0;
  }
  .name {
    font-size: 1rem;
    font-weight: 500;
  }
  .sub {
    font-size: 0.8125rem;
    color: var(--text-muted);
  }
  .page-body > .btn {
    flex: none;
    background: var(--surface-2);
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .colors {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 6px;
  }
  .colorbtn {
    aspect-ratio: 1;
    min-height: 36px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #0b0d14;
  }
  .danger {
    color: var(--danger);
    align-self: flex-start;
    padding: 0 8px;
  }
</style>
