<script lang="ts">
  import { addMonths, capitalize, fmtDayLong, fmtDayShort, isDateKey, MONTHS, MONTHS_SHORT, parseKey, weekday, WEEKDAYS, WEEKDAYS_LETTER } from '../lib/logic/dates';
  import { defaultRepeat, MAX_COUNT, normalizeRepeat, repeatSummary, weekdaySlotLabel } from '../lib/logic/recurrence';
  import PickerField from '../lib/ui/PickerField.svelte';
  import Sheet from '../lib/ui/Sheet.svelte';
  import type { DateKey, Repeat, RepeatFreq } from '../lib/types';

  let {
    repeat,
    start,
    onsave,
    onclose,
  }: { repeat: Repeat | null; start: DateKey; onsave: (repeat: Repeat | null) => void; onclose: () => void } = $props();

  type Choice = 'none' | RepeatFreq;
  const FREQS: { id: RepeatFreq; one: string; many: string }[] = [
    { id: 'day', one: 'giorno', many: 'giorni' },
    { id: 'week', one: 'settimana', many: 'settimane' },
    { id: 'month', one: 'mese', many: 'mesi' },
    { id: 'year', one: 'anno', many: 'anni' },
  ];

  // Copia di lavoro presa all'apertura: si salva solo con "Fatto".
  function initialChoice(): Choice {
    return repeat ? repeat.freq : 'none';
  }
  function initialDraft(): Repeat {
    return repeat ? (JSON.parse(JSON.stringify(repeat)) as Repeat) : defaultRepeat('week', start);
  }
  let choice = $state<Choice>(initialChoice());
  let draft = $state<Repeat>(initialDraft());

  const s = $derived(parseKey(start));
  const startWeekday = $derived(weekday(start));
  const current = $derived(choice === 'none' ? null : normalizeRepeat({ ...$state.snapshot(draft), freq: choice }, start));
  const summary = $derived(repeatSummary(current, start));
  const untilDefault = $derived(addMonths(start, 3));

  function choose(c: Choice) {
    choice = c;
    if (c !== 'none') draft.freq = c;
  }

  function setInterval_(value: string) {
    const n = Math.round(Number(value));
    draft.interval = Number.isFinite(n) ? Math.min(99, Math.max(1, n)) : 1;
  }

  function toggle(list: number[], value: number, locked: number): number[] {
    if (value === locked) return list.includes(value) ? list : [...list, value];
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value].sort((a, b) => a - b);
  }

  function setCount(value: string) {
    const n = Math.round(Number(value));
    draft.end = { type: 'count', count: Number.isFinite(n) ? Math.min(MAX_COUNT, Math.max(1, n)) : 1 };
  }

  function setUntil(value: string) {
    if (isDateKey(value) && value >= start) draft.end = { type: 'until', date: value };
  }

  function done() {
    onsave(current);
    onclose();
  }
</script>

<Sheet title="Ripeti" {onclose}>
  <p class="summary" aria-live="polite">
    {current ? `${summary}.` : `Solo ${fmtDayLong(start)}, senza ripetizione.`}
  </p>

  <div class="card group" role="radiogroup" aria-label="Ogni quanto si ripete">
    <button class="opt" role="radio" aria-checked={choice === 'none'} onclick={() => choose('none')}>
      <span class="radio" class:on={choice === 'none'}></span>
      <span>Non ripetere</span>
    </button>
    {#each FREQS as f (f.id)}
      <div class="block">
        <div class="opt">
          <button class="pick" role="radio" aria-checked={choice === f.id} aria-label={`Ogni ${f.one}`} onclick={() => choose(f.id)}>
            <span class="radio" class:on={choice === f.id}></span>
            <span>Ogni</span>
          </button>
          <input
            class="n num"
            type="number"
            inputmode="numeric"
            min="1"
            max="99"
            aria-label={`Ogni quanti ${f.many}`}
            value={choice === f.id ? draft.interval : 1}
            onfocus={() => choose(f.id)}
            onchange={(e) => {
              choose(f.id);
              setInterval_(e.currentTarget.value);
            }}
          />
          <button class="unit" tabindex="-1" aria-hidden="true" onclick={() => choose(f.id)}>
            {choice === f.id && draft.interval > 1 ? f.many : f.one}
          </button>
        </div>

        {#if choice === 'week' && f.id === 'week'}
          <div class="days" role="group" aria-label="Giorni della settimana">
            {#each WEEKDAYS_LETTER as letter, i (i)}
              {@const wd = i + 1}
              {@const on = draft.weekdays.includes(wd) || wd === startWeekday}
              <button
                class="day"
                class:on
                class:red={wd === 7}
                aria-pressed={on}
                aria-label={WEEKDAYS[i]}
                onclick={() => (draft.weekdays = toggle(draft.weekdays, wd, startWeekday))}
              >
                {letter}
              </button>
            {/each}
          </div>
        {/if}

        {#if choice === 'month' && f.id === 'month'}
          <div class="modes">
            <button class="mode" class:on={draft.monthMode === 'day'} aria-pressed={draft.monthMode === 'day'} onclick={() => (draft.monthMode = 'day')}>
              Il giorno {s.d}
            </button>
            <button class="mode" class:on={draft.monthMode === 'weekday'} aria-pressed={draft.monthMode === 'weekday'} onclick={() => (draft.monthMode = 'weekday')}>
              {capitalize(weekdaySlotLabel(start))}
            </button>
            <button class="mode" class:on={draft.monthMode === 'dates'} aria-pressed={draft.monthMode === 'dates'} onclick={() => (draft.monthMode = 'dates')}>
              Scegli i giorni
            </button>
          </div>
          {#if draft.monthMode === 'dates'}
            <div class="dates" role="group" aria-label="Giorni del mese">
              {#each Array.from({ length: 31 }, (_, i) => i + 1) as d (d)}
                {@const on = draft.monthDays.includes(d) || d === s.d}
                <button class="date num" class:on aria-pressed={on} onclick={() => (draft.monthDays = toggle(draft.monthDays, d, s.d))}>{d}</button>
              {/each}
            </div>
          {/if}
        {/if}

        {#if choice === 'year' && f.id === 'year'}
          <div class="modes">
            <button class="mode" class:on={draft.yearMode === 'date'} aria-pressed={draft.yearMode === 'date'} onclick={() => (draft.yearMode = 'date')}>
              Il {s.d} {MONTHS[s.m - 1]}
            </button>
            <button class="mode" class:on={draft.yearMode === 'weekday'} aria-pressed={draft.yearMode === 'weekday'} onclick={() => (draft.yearMode = 'weekday')}>
              {capitalize(weekdaySlotLabel(start))} di {MONTHS[s.m - 1]}
            </button>
            <button class="mode" class:on={draft.yearMode === 'months'} aria-pressed={draft.yearMode === 'months'} onclick={() => (draft.yearMode = 'months')}>
              Scegli i mesi (giorno {s.d})
            </button>
          </div>
          {#if draft.yearMode === 'months'}
            <div class="months" role="group" aria-label="Mesi">
              {#each MONTHS_SHORT as name, i (name)}
                {@const m = i + 1}
                {@const on = draft.yearMonths.includes(m) || m === s.m}
                <button class="date" class:on aria-pressed={on} aria-label={MONTHS[i]} onclick={() => (draft.yearMonths = toggle(draft.yearMonths, m, s.m))}>{name}</button>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>

  {#if choice !== 'none'}
    <h3 class="caps">Durata</h3>
    <div class="card group" role="radiogroup" aria-label="Fino a quando si ripete">
      <button class="opt" role="radio" aria-checked={draft.end.type === 'never'} onclick={() => (draft.end = { type: 'never' })}>
        <span class="radio" class:on={draft.end.type === 'never'}></span>
        <span>Per sempre</span>
      </button>
      <div class="opt">
        <button class="pick" role="radio" aria-checked={draft.end.type === 'count'} aria-label="Numero di volte" onclick={() => setCount(draft.end.type === 'count' ? String(draft.end.count) : '10')}>
          <span class="radio" class:on={draft.end.type === 'count'}></span>
          <span>Per</span>
        </button>
        <input
          class="n num"
          type="number"
          inputmode="numeric"
          min="1"
          max={MAX_COUNT}
          aria-label="Quante volte"
          value={draft.end.type === 'count' ? draft.end.count : 10}
          onfocus={() => {
            if (draft.end.type !== 'count') setCount('10');
          }}
          onchange={(e) => setCount(e.currentTarget.value)}
        />
        <span class="unit">volte</span>
      </div>
      <div class="opt">
        <button class="pick" role="radio" aria-checked={draft.end.type === 'until'} aria-label="Fino a una data" onclick={() => setUntil(draft.end.type === 'until' ? draft.end.date : untilDefault)}>
          <span class="radio" class:on={draft.end.type === 'until'}></span>
          <span>Fino al</span>
        </button>
        <PickerField
          type="date"
          variant="pill"
          min={start}
          label="Ultimo giorno"
          value={draft.end.type === 'until' ? draft.end.date : untilDefault}
          text={fmtDayShort(draft.end.type === 'until' ? draft.end.date : untilDefault, parseKey(start).y - 1)}
          onfocus={() => {
            if (draft.end.type !== 'until') setUntil(untilDefault);
          }}
          onchange={setUntil}
        />
      </div>
    </div>
  {/if}

  {#snippet footer()}
    <button class="btn btn-primary" onclick={done}>Fatto</button>
  {/snippet}
</Sheet>

<style>
  .summary {
    margin: 0 4px 12px;
    font-size: 0.9375rem;
    line-height: 1.45;
    color: var(--text-muted);
  }
  .group {
    background: var(--surface-2);
    padding: 2px 14px;
  }
  .block + .block,
  .group > .opt + .block,
  .group > .opt + .opt {
    border-top: 1px solid var(--border);
  }
  .opt {
    width: 100%;
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left;
    font-size: 1rem;
  }
  .pick {
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1rem;
  }
  .radio {
    width: 22px;
    height: 22px;
    flex: none;
    border-radius: 50%;
    box-shadow: inset 0 0 0 2px var(--text-dim);
    display: block;
  }
  .radio.on {
    box-shadow:
      inset 0 0 0 2px var(--accent),
      inset 0 0 0 6px var(--surface-2);
    background: var(--accent);
  }
  .n {
    width: 56px;
    height: 40px;
    border: 0;
    border-radius: 10px;
    background: var(--border);
    text-align: center;
    outline: none;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .n::-webkit-outer-spin-button,
  .n::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .n:focus {
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }
  .unit {
    flex: 1;
    min-height: 44px;
    text-align: left;
    font-size: 1rem;
    display: flex;
    align-items: center;
  }
  .days {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
    padding: 2px 0 12px;
  }
  .day {
    height: 44px;
    border-radius: 50%;
    font-weight: 600;
    justify-self: center;
    width: 44px;
  }
  .day.red {
    color: var(--sunday);
  }
  .day.on {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .modes {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 2px 0 12px;
  }
  .mode {
    min-height: 44px;
    padding: 6px 14px;
    border-radius: 22px;
    box-shadow: inset 0 0 0 1.5px var(--border);
    font-size: 0.9375rem;
    color: var(--text-muted);
  }
  .mode.on {
    box-shadow: inset 0 0 0 1.5px var(--accent);
    color: var(--accent);
    font-weight: 600;
  }
  .dates {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
    padding-bottom: 12px;
  }
  .months {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
    padding-bottom: 12px;
  }
  .date {
    height: 40px;
    border-radius: 10px;
    background: var(--border);
    font-size: 0.875rem;
  }
  .date.on {
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 700;
  }
  h3 {
    margin: 16px 4px 8px;
  }
</style>
