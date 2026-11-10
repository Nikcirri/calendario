// Impostazioni dell'app: valori di partenza e controllo di quelle salvate.
import type { Settings, UpdateState, ViewId } from '../types';

const VIEWS: readonly ViewId[] = ['year', 'month', 'week', 'day', 'agenda'];

export function defaultSettings(): Settings {
  return {
    view: 'month',
    defaultAlerts: [30],
    showHolidays: true,
    notifications: true,
    stripCategoryId: null,
    updates: { lastCheck: null, latestVersion: null, apkUrl: null, pageUrl: null },
  };
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}

/** Legge le impostazioni salvate: quello che manca o non è valido prende il valore di partenza. */
export function sanitizeSettings(raw: unknown): Settings {
  const base = defaultSettings();
  if (typeof raw !== 'object' || raw === null) return base;
  const r = raw as Record<string, unknown>;
  const u = (typeof r.updates === 'object' && r.updates !== null ? r.updates : {}) as Record<string, unknown>;
  const updates: UpdateState = {
    lastCheck: strOrNull(u.lastCheck),
    latestVersion: strOrNull(u.latestVersion),
    apkUrl: strOrNull(u.apkUrl),
    pageUrl: strOrNull(u.pageUrl),
  };
  const alerts = Array.isArray(r.defaultAlerts)
    ? r.defaultAlerts.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 40_320).slice(0, 3)
    : base.defaultAlerts;
  return {
    view: VIEWS.includes(r.view as ViewId) ? (r.view as ViewId) : base.view,
    defaultAlerts: alerts,
    showHolidays: typeof r.showHolidays === 'boolean' ? r.showHolidays : base.showHolidays,
    notifications: typeof r.notifications === 'boolean' ? r.notifications : base.notifications,
    stripCategoryId: strOrNull(r.stripCategoryId),
    updates,
  };
}
