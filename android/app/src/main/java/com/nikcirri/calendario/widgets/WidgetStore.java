package com.nikcirri.calendario.widgets;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Dati dei widget, salvati sul telefono fuori dal database dell'app: così i widget funzionano
 * anche quando l'app è chiusa. Contiene la "fotografia" degli impegni mandata dall'app (testo JSON).
 */
final class WidgetStore {

    private static final String PREFS = "widgets";
    private static final String SNAPSHOT = "snapshot";

    private WidgetStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void saveSnapshot(Context context, String json) {
        // commit: i dati sono salvati prima che i widget vengano ridisegnati.
        prefs(context).edit().putString(SNAPSHOT, json).commit();
    }

    /** La fotografia salvata, oppure null se l'app non l'ha ancora mandata. */
    static String snapshot(Context context) {
        return prefs(context).getString(SNAPSHOT, null);
    }
}
