// Collegamento al plugin Android "Widgets" (android/app/src/main/java/.../widgets/WidgetsPlugin.java):
// passa ai widget gli impegni dei prossimi giorni e avvisa quando l'app viene aperta da un widget.
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isDateKey } from '../logic/dates';
import type { WidgetSnapshot } from '../logic/widget';
import { isNative } from '../platform';
import type { DateKey } from '../types';

interface WidgetsPlugin {
  setSnapshot(options: { json: string }): Promise<void>;
  addListener(event: 'widgetAction', handler: (e: { action?: string; date?: string }) => void): Promise<PluginListenerHandle>;
}

const Widgets = registerPlugin<WidgetsPlugin>('Widgets');

/** Aggiorna i widget (solo nell'app Android). */
export async function pushWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  if (!isNative()) return;
  await Widgets.setSnapshot({ json: JSON.stringify(snapshot) });
}

export type WidgetAction = { action: 'newEvent' } | { action: 'openDay'; date: DateKey };

/**
 * Chiama `handler` quando l'app viene aperta dal + di un widget o toccando un giorno.
 * Se il tocco è arrivato ad app chiusa, Android lo consegna appena ci si mette in ascolto.
 */
export function onWidgetAction(handler: (action: WidgetAction) => void): void {
  if (!isNative()) return;
  void Widgets.addListener('widgetAction', (e) => {
    if (e.action === 'newEvent') handler({ action: 'newEvent' });
    else if (e.action === 'openDay' && isDateKey(e.date)) handler({ action: 'openDay', date: e.date });
  }).catch(() => undefined);
}
