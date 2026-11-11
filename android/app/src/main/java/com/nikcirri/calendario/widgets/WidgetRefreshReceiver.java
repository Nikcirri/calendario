package com.nikcirri.calendario.widgets;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Ridisegna i widget quando cambia il giorno (a mezzanotte) o quando cambiano ora e fuso orario,
 * e ogni dieci minuti sposta la riga di "adesso" nei widget Settimana che mostrano la griglia delle ore.
 * Non è raggiungibile da altre app (exported="false" nel manifest): solo da questa app e da Android.
 */
public class WidgetRefreshReceiver extends BroadcastReceiver {

    static final String ACTION_REFRESH = "com.nikcirri.calendario.widget.REFRESH";
    static final String ACTION_TICK = "com.nikcirri.calendario.widget.TICK";
    private static final long TEN_MINUTES = 10 * 60 * 1000L;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_TICK.equals(intent.getAction())) {
            WeekWidget.updateHours(context);
        } else {
            updateAll(context);
            scheduleMidnight(context);
        }
        scheduleTick(context);
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

    private static PendingIntent pending(Context context, String action, int code) {
        Intent intent = new Intent(context, WidgetRefreshReceiver.class);
        intent.setAction(action);
        return PendingIntent.getBroadcast(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * Prepara l'aggiornamento dei widget per la prossima mezzanotte, quando "oggi" cambia.
     * È una sveglia che NON accende il telefono: se a mezzanotte lo schermo è spento, i widget si
     * aggiornano appena il telefono si risveglia. Senza widget sulla schermata Home la sveglia si spegne.
     */
    static void scheduleMidnight(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        PendingIntent refresh = pending(context, ACTION_REFRESH, 0);
        if (!anyWidget(context)) {
            alarms.cancel(refresh);
            return;
        }
        long midnight = LocalDate.now().plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
        alarms.setWindow(AlarmManager.RTC, midnight + 1000L, TEN_MINUTES, refresh);
    }

    /**
     * Prepara il prossimo spostamento della riga di "adesso" (ai minuti 00, 10, 20…), solo se c'è almeno
     * un widget Settimana con la griglia delle ore; altrimenti la sveglia si spegne.
     * Anche questa NON accende il telefono: a schermo spento non succede niente, e al risveglio la riga
     * va subito al posto giusto.
     */
    static void scheduleTick(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        PendingIntent tick = pending(context, ACTION_TICK, 1);
        if (!WeekWidget.anyHours(context)) {
            alarms.cancel(tick);
            return;
        }
        long next = (System.currentTimeMillis() / TEN_MINUTES + 1) * TEN_MINUTES + 500L;
        try {
            // All'orario preciso dove Android lo permette (l'app ha il permesso per gli avvisi del calendario).
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()) {
                alarms.setExact(AlarmManager.RTC, next, tick);
                return;
            }
        } catch (SecurityException e) {
            // Permesso tolto nel frattempo: si usa la sveglia "più o meno a quell'ora" qui sotto.
        }
        alarms.setWindow(AlarmManager.RTC, next, TEN_MINUTES, tick);
    }
}
