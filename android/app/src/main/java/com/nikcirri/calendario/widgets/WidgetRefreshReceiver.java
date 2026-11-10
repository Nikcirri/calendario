package com.nikcirri.calendario.widgets;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Ridisegna i widget quando cambia il giorno (a mezzanotte) o quando cambiano ora e fuso orario.
 * Non è raggiungibile da altre app (exported="false" nel manifest): solo da questa app e da Android.
 */
public class WidgetRefreshReceiver extends BroadcastReceiver {

    static final String ACTION_REFRESH = "com.nikcirri.calendario.widget.REFRESH";
    private static final long TEN_MINUTES = 10 * 60 * 1000L;

    @Override
    public void onReceive(Context context, Intent intent) {
        updateAll(context);
        scheduleMidnight(context);
    }

    /** Ridisegna tutti i widget dell'app presenti sulla schermata Home. */
    static void updateAll(Context context) {
        AgendaWidget.updateAll(context);
        MonthWidget.updateAll(context);
        WeekWidget.updateAll(context);
    }

    private static boolean anyWidget(Context context) {
        return AgendaWidget.ids(context).length > 0 || MonthWidget.ids(context).length > 0 || WeekWidget.ids(context).length > 0;
    }

    /**
     * Prepara l'aggiornamento dei widget per la prossima mezzanotte, quando "oggi" cambia.
     * È una sveglia che NON accende il telefono: se a mezzanotte lo schermo è spento, i widget si
     * aggiornano appena il telefono si risveglia. Senza widget sulla schermata Home la sveglia si spegne.
     */
    static void scheduleMidnight(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        Intent intent = new Intent(context, WidgetRefreshReceiver.class);
        intent.setAction(ACTION_REFRESH);
        PendingIntent refresh = PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (!anyWidget(context)) {
            alarms.cancel(refresh);
            return;
        }
        long midnight = LocalDate.now().plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
        alarms.setWindow(AlarmManager.RTC, midnight + 1000L, TEN_MINUTES, refresh);
    }
}
