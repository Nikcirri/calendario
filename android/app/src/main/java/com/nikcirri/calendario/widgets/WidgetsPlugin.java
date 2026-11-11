package com.nikcirri.calendario.widgets;

import android.content.Context;
import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Collega l'app ai widget della schermata Home:
 * - `setSnapshot`: l'app manda gli impegni dei prossimi giorni e i widget si ridisegnano;
 * - evento `widgetAction`: avvisa l'app quando viene aperta dal + di un widget o toccando un giorno.
 */
@CapacitorPlugin(name = "Widgets")
public class WidgetsPlugin extends Plugin {

    /** La fotografia degli impegni è un testo: oltre questa misura c'è qualcosa che non va. */
    private static final int MAX_JSON = 2_000_000;

    @Override
    public void load() {
        // A ogni apertura dell'app i widget si rimettono in pari (giorno giusto, sveglie di mezzanotte e della riga di "adesso" attive).
        Context context = getContext().getApplicationContext();
        WidgetRefreshReceiver.updateAll(context);
        WidgetRefreshReceiver.scheduleMidnight(context);
        WidgetRefreshReceiver.scheduleTick(context);
    }

    /** Capacitor chiama questo metodo sia all'avvio dell'app sia quando l'app già aperta riceve un nuovo intent. */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent == null) return;
        String action = intent.getAction();
        boolean newEvent = WidgetUi.ACTION_NEW_EVENT.equals(action);
        boolean openDay = WidgetUi.ACTION_OPEN_DAY.equals(action);
        if (!newEvent && !openDay) return;
        // App riaperta dalle app recenti: l'intent è quello vecchio, il widget non è stato toccato adesso.
        if ((intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return;
        JSObject data = new JSObject();
        if (newEvent) {
            data.put("action", "newEvent");
        } else {
            String date = intent.getStringExtra(WidgetUi.EXTRA_DATE);
            if (date == null || !date.matches("\\d{4}-\\d{2}-\\d{2}")) return;
            data.put("action", "openDay");
            data.put("date", date);
        }
        // Segnato come già gestito, così non si ripete.
        intent.setAction(Intent.ACTION_MAIN);
        // "true": se l'app si sta ancora avviando, l'avviso resta in attesa finché non è pronta ad ascoltarlo.
        notifyListeners("widgetAction", data, true);
    }

    @PluginMethod
    public void setSnapshot(PluginCall call) {
        String json = call.getString("json");
        if (json == null || json.length() > MAX_JSON || !WidgetData.parse(json).known()) {
            call.reject("Dati dei widget non validi");
            return;
        }
        Context context = getContext().getApplicationContext();
        WidgetStore.saveSnapshot(context, json);
        WidgetRefreshReceiver.updateAll(context);
        WidgetRefreshReceiver.scheduleMidnight(context);
        WidgetRefreshReceiver.scheduleTick(context);
        call.resolve();
    }
}
