<script lang="ts">
  import { onMount } from 'svelte';
  import { run } from '../lib/actions';
  import { reportError } from '../lib/errors';
  import { RELEASES_PAGE } from '../lib/logic/updates';
  import { alertLabel, TIMED_ALERTS } from '../lib/logic/model';
  import { APP_VERSION, isNative, openExternal } from '../lib/platform';
  import { readBackupFile, restoreBackup, shareBackup } from '../lib/services/files';
  import { askNotificationPermission, forgetNotificationPlan } from '../lib/services/notifications';
  import { app, closePage, data, openPage, updateSettings } from '../lib/state/app.svelte';
  import { confirmDialog, infoDialog, registerOverlay, showToast, withBusy } from '../lib/state/ui.svelte';
  import { checkUpdateNow, update } from '../lib/state/update.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import { pickFile } from '../lib/ui/pickFile';
  import Sheet from '../lib/ui/Sheet.svelte';
  import Switch from '../lib/ui/Switch.svelte';

  let picker = $state<'alert' | 'strip' | null>(null);
  let checking = $state(false);

  const defaultAlert = $derived(app.settings.defaultAlerts[0]);
  const stripName = $derived(
    app.settings.stripCategoryId ? (data.categoryById.get(app.settings.stripCategoryId)?.name ?? 'Automatica') : 'Automatica',
  );

  async function setNotifications(on: boolean) {
    if (on && isNative()) {
      const granted = await askNotificationPermission().catch(() => false);
      if (!granted) {
        await infoDialog(
          'Notifiche bloccate',
          'Android non permette a Calendario di mandare notifiche.\nApri le impostazioni del telefono, cerca “Calendario” tra le app e attiva le notifiche. Poi torna qui.',
        );
        return;
      }
    }
    forgetNotificationPlan();
    await updateSettings((s) => (s.notifications = on));
  }

  function setDefaultAlert(value: number | null) {
    picker = null;
    run(() => updateSettings((s) => (s.defaultAlerts = value === null ? [] : [value])));
  }

  function setStrip(id: string | null) {
    picker = null;
    run(() => updateSettings((s) => (s.stripCategoryId = id)));
  }

  async function backup() {
    try {
      const ok = await shareBackup();
      if (ok) showToast(isNative() ? 'Backup pronto: scegli dove salvarlo.' : 'Backup scaricato');
    } catch (e) {
      reportError(e, 'Non riesco a creare il backup.');
    }
  }

  async function restore() {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const backupData = await readBackupFile(file);
      const ok = await confirmDialog({
        title: 'Ripristinare questo backup?',
        message: `Contiene ${backupData.events.length} ${backupData.events.length === 1 ? 'impegno' : 'impegni'} e ${backupData.categories.length} categorie.\nSostituisce tutto quello che c’è adesso nell’app.`,
        confirmLabel: 'Ripristina',
        danger: true,
      });
      if (!ok) return;
      await withBusy('Ripristino il backup…', () => restoreBackup(backupData));
      // Le impostazioni del backup valgono subito, senza riaprire l'app.
      if (backupData.settings) {
        const restored = backupData.settings;
        app.settings = { ...restored, updates: app.settings.updates };
      }
      forgetNotificationPlan();
      showToast('Backup ripristinato');
    } catch (e) {
      reportError(e, 'Non riesco a leggere questo file.');
    }
  }

  async function check() {
    if (checking) return;
    checking = true;
    try {
      const result = await checkUpdateNow();
      if (result.kind === 'current') showToast('Hai già l’ultima versione.');
      else if (result.kind === 'offline') showToast('Sei senza internet: riprova quando sei connesso.');
      else if (result.kind === 'error') showToast('Non riesco a controllare adesso. Riprova tra poco.');
      else closePage();
    } catch (e) {
      reportError(e);
    } finally {
      checking = false;
    }
  }

  onMount(() => registerOverlay(closePage));
</script>

<div class="page">
  <div class="page-head">
    <button class="icon-btn" aria-label="Torna al calendario" onclick={closePage}><Icon name="back" /></button>
    <h1>Impostazioni</h1>
  </div>
  <div class="page-body">
    <section class="card">
      <h2 class="caps">Notifiche</h2>
      <div class="row">
        <span class="grow" id="set-notif">Notifiche degli avvisi</span>
        <Switch checked={app.settings.notifications} onchange={(v) => run(() => setNotifications(v))} labelledby="set-notif" />
      </div>
      <button class="row" onclick={() => (picker = 'alert')}>
        <span class="label">Avviso dei nuovi eventi</span>
        <span class="value" class:empty={defaultAlert === undefined}>{defaultAlert === undefined ? 'Nessuno' : alertLabel(defaultAlert, false)}</span>
        <Icon name="chevronRight" size={18} />
      </button>
      {#if !isNative()}
        <p class="note">Le notifiche arrivano solo nell’app installata sul telefono, non in questa anteprima nel browser.</p>
      {/if}
    </section>

    <section class="card">
      <h2 class="caps">Calendario</h2>
      <div class="row">
        <span class="grow" id="set-holidays">Festività italiane</span>
        <Switch checked={app.settings.showHolidays} onchange={(v) => run(() => updateSettings((s) => (s.showHolidays = v)))} labelledby="set-holidays" />
      </div>
      <button class="row" onclick={() => (picker = 'strip')}>
        <span class="label">Ore in cima al mese</span>
        <span class="value">{stripName}</span>
        <Icon name="chevronRight" size={18} />
      </button>
      <button class="row" onclick={() => openPage('categories')}>
        <span class="label grow">Categorie</span>
        <Icon name="chevronRight" size={18} />
      </button>
    </section>

    <section class="card">
      <h2 class="caps">Dati</h2>
      <button class="row" onclick={backup}>
        <Icon name="download" size={20} />
        <span class="label grow">Salva un backup</span>
        <Icon name="chevronRight" size={18} />
      </button>
      <button class="row" onclick={restore}>
        <Icon name="upload" size={20} />
        <span class="label grow">Ripristina un backup</span>
        <Icon name="chevronRight" size={18} />
      </button>
      <p class="note">Tutti i dati restano sul telefono. Un backup ogni tanto li mette al sicuro.</p>
    </section>

    <section class="card last">
      <h2 class="caps">Aggiornamenti</h2>
      <div class="row">
        <span class="grow">Versione installata</span>
        <span class="value num">{APP_VERSION}</span>
      </div>
      {#if update.available}
        <button class="btn btn-primary btn-block" onclick={() => { update.dismissed = false; closePage(); }}>
          <Icon name="download" size={20} />
          <span>Aggiorna alla {update.available.version}</span>
        </button>
      {:else}
        <button class="btn btn-block" disabled={checking} onclick={check}>
          <Icon name="refresh" size={20} />
          <span>{checking ? 'Controllo…' : 'Controlla aggiornamenti'}</span>
        </button>
      {/if}
      <button class="link" onclick={() => openExternal(RELEASES_PAGE)}>Apri la pagina dell’app su GitHub</button>
    </section>
  </div>
</div>

{#if picker === 'alert'}
  <Sheet title="Avviso dei nuovi eventi" onclose={() => (picker = null)}>
    <div class="options">
      <button class="option" aria-pressed={defaultAlert === undefined} onclick={() => setDefaultAlert(null)}>
        <span class="grow">Nessuno</span>
        {#if defaultAlert === undefined}<Icon name="check" size={20} />{/if}
      </button>
      {#each TIMED_ALERTS as o (o.value)}
        <button class="option" aria-pressed={defaultAlert === o.value} onclick={() => setDefaultAlert(o.value)}>
          <span class="grow">{o.label}</span>
          {#if defaultAlert === o.value}<Icon name="check" size={20} />{/if}
        </button>
      {/each}
    </div>
    <p class="note">Vale per gli eventi nuovi con un orario. Puoi cambiarlo in ogni evento.</p>
  </Sheet>
{/if}

{#if picker === 'strip'}
  <Sheet title="Ore in cima al mese" onclose={() => (picker = null)}>
    <div class="options">
      <button class="option" aria-pressed={app.settings.stripCategoryId === null} onclick={() => setStrip(null)}>
        <span class="grow">Automatica (la categoria con più ore)</span>
        {#if app.settings.stripCategoryId === null}<Icon name="check" size={20} />{/if}
      </button>
      {#each data.categories as c (c.id)}
        <button class="option" aria-pressed={app.settings.stripCategoryId === c.id} onclick={() => setStrip(c.id)}>
          <span class="dot" style:background={c.color}></span>
          <span class="grow">{c.name}</span>
          {#if app.settings.stripCategoryId === c.id}<Icon name="check" size={20} />{/if}
        </button>
      {/each}
    </div>
    <p class="note">È la striscia sopra la vista Mese, con le ore fatte e quelle del mese.</p>
  </Sheet>
{/if}

<style>
  .card {
    flex: none;
    padding: 4px 16px 6px;
  }
  .card.last {
    padding-bottom: 12px;
    display: flex;
    flex-direction: column;
  }
  .caps {
    height: 32px;
    display: flex;
    align-items: center;
  }
  .row :global(svg) {
    color: var(--text-dim);
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .note {
    margin: 6px 0 8px;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: var(--text-muted);
  }
  .card.last .btn {
    margin-top: 4px;
    border-radius: 14px;
  }
  .link {
    min-height: 44px;
    margin-top: 4px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--accent);
    align-self: center;
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
</style>
