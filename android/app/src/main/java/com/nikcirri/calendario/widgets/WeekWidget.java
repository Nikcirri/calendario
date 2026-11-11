package com.nikcirri.calendario.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import com.nikcirri.calendario.R;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

/**
 * Widget "Settimana": i sette giorni della settimana di oggi, ognuno con i suoi impegni.
 * Da piccolo mostra gli impegni come etichette; quando è alto (da HOURS_FROM_DP in su) diventa la griglia
 * delle ore che si scorre, disegnata da WeekHours.
 * Toccando un giorno si apre l'app su quella giornata; il + crea un nuovo evento.
 */
public class WeekWidget extends AppWidgetProvider {

    // Misure in dp: devono restare uguali a quelle dei layout widget_week*.xml.
    static final int PADDING_DP = 20;
    static final int HEADER_DP = 36;
    static final int DAY_HEAD_DP = 38;
    static final int CHIP_DP = 18;
    private static final int DEFAULT_HEIGHT_DP = 130;
    /** Sotto questa altezza la riga del titolo non si mostra. */
    private static final int COMPACT_BELOW_DP = 150;
    /**
     * Da questa altezza in su il widget mostra la griglia delle ore. Sulla maggior parte dei telefoni
     * un widget alto 2 caselle sta sotto e uno alto 3 sta sopra.
     */
    static final int HOURS_FROM_DP = 285;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
        WidgetRefreshReceiver.scheduleMidnight(context);
        WidgetRefreshReceiver.scheduleTick(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        // Il widget è stato ridimensionato: può passare dalle etichette alla griglia delle ore, o tornare indietro.
        render(context, manager, id);
        WidgetRefreshReceiver.scheduleTick(context);
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        WidgetRefreshReceiver.scheduleTick(context);
    }

    @Override
    public void onDisabled(Context context) {
        WidgetRefreshReceiver.scheduleMidnight(context);
        WidgetRefreshReceiver.scheduleTick(context);
    }

    static int[] ids(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        return manager == null ? new int[0] : manager.getAppWidgetIds(new ComponentName(context, WeekWidget.class));
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return;
        for (int id : ids(context)) render(context, manager, id);
    }

    /** Il widget, a questa altezza, mostra la griglia delle ore? */
    static boolean showsHours(int heightDp) {
        return heightDp >= HOURS_FROM_DP;
    }

    /** C'è almeno un widget Settimana con la griglia delle ore? (Serve a tenere aggiornata la riga di "adesso".) */
    static boolean anyHours(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return false;
        for (int id : ids(context)) if (showsHours(WidgetUi.heightDp(manager, id))) return true;
        return false;
    }

    /** Ridisegna solo i widget con la griglia delle ore: sposta la riga di "adesso". */
    static void updateHours(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return;
        for (int id : ids(context)) if (showsHours(WidgetUi.heightDp(manager, id))) render(context, manager, id);
    }

    private static void render(Context context, AppWidgetManager manager, int id) {
        LocalDateTime now = LocalDateTime.now();
        int height = WidgetUi.heightDp(manager, id);
        int minutes = now.getHour() * 60 + now.getMinute();
        manager.updateAppWidget(id, build(context, id, WidgetUi.widthDp(manager, id), height, now.toLocalDate(), minutes));
        // Sui telefoni fino ad Android 11 le righe della griglia le fornisce WeekHoursService: va avvisato che sono cambiate.
        if (showsHours(height) && WeekHours.usesService()) manager.notifyAppWidgetViewDataChanged(id, R.id.week_hours);
    }

    /**
     * Disegna la settimana che contiene `today`, per una misura data (così si può provare con dati fissi).
     * `nowMinutes` sono i minuti da mezzanotte di adesso: servono solo alla griglia delle ore.
     */
    static RemoteViews build(Context context, int widgetId, int widthDp, int heightDp, LocalDate today, int nowMinutes) {
        int height = heightDp > 0 ? heightDp : DEFAULT_HEIGHT_DP;
        if (showsHours(height)) return WeekHours.build(context, widgetId, widthDp, height, today, nowMinutes);

        WidgetData data = WidgetData.load(context);
        String pkg = context.getPackageName();
        RemoteViews views = new RemoteViews(pkg, R.layout.widget_week);

        LocalDate monday = today.minusDays(WidgetUi.weekdayIndex(today));
        views.setTextViewText(R.id.week_title, title(monday, monday.plusDays(6)));
        views.removeAllViews(R.id.week_days);

        // Con poca altezza la riga del titolo si nasconde: così c'è posto per gli impegni.
        boolean compact = height < COMPACT_BELOW_DP;
        views.setViewVisibility(R.id.week_header, compact ? View.GONE : View.VISIBLE);
        int room = height - PADDING_DP - (compact ? 0 : HEADER_DP) - DAY_HEAD_DP;
        int maxChips = Math.max(1, room / CHIP_DP);

        for (int d = 0; d < 7; d++) {
            LocalDate day = monday.plusDays(d);
            RemoteViews col = new RemoteViews(pkg, R.layout.widget_week_day);
            fillDay(context, col, d, day, today);
            addChips(pkg, col, data.items(day), maxChips);
            views.addView(R.id.week_days, col);
        }

        views.setOnClickPendingIntent(android.R.id.background, WidgetUi.openApp(context));
        views.setOnClickPendingIntent(R.id.week_add, WidgetUi.newEvent(context));
        return views;
    }

    /** Nome e numero del giorno (oggi evidenziato, domenica in rosso) e il tocco che apre quel giorno nell'app. */
    static void fillDay(Context context, RemoteViews col, int weekday, LocalDate day, LocalDate today) {
        col.setTextViewText(R.id.week_name, WidgetUi.WEEKDAYS_SHORT[weekday].toUpperCase(Locale.ITALIAN));
        col.setTextViewText(R.id.week_num, String.valueOf(day.getDayOfMonth()));
        if (day.equals(today)) {
            col.setInt(R.id.week_num, "setBackgroundResource", R.drawable.widget_today);
            col.setTextColor(R.id.week_num, context.getColor(R.color.widget_on_accent));
        } else {
            col.setTextColor(R.id.week_num, context.getColor(weekday == 6 ? R.color.widget_sunday : R.color.widget_text));
        }
        col.setOnClickPendingIntent(R.id.week_col, WidgetUi.openDay(context, day));
    }

    /** Le etichette degli impegni sotto un giorno. Se non ci stanno tutte, l'ultimo posto dice quante ne restano ("+2"). */
    static void addChips(String pkg, RemoteViews col, List<WidgetData.Item> items, int maxChips) {
        int full = items.size() > maxChips ? maxChips - 1 : items.size();
        for (int i = 0; i < full; i++) {
            WidgetData.Item item = items.get(i);
            RemoteViews chip = new RemoteViews(pkg, R.layout.widget_week_chip);
            chip.setInt(R.id.chip_bg, "setColorFilter", WidgetUi.chipColor(item.color));
            chip.setTextViewText(R.id.chip_text, item.title);
            col.addView(R.id.week_chips, chip);
        }
        if (items.size() > full) {
            RemoteViews more = new RemoteViews(pkg, R.layout.widget_week_more);
            more.setTextViewText(R.id.week_more, "+" + (items.size() - full));
            col.addView(R.id.week_chips, more);
        }
    }

    /** "9 – 15 novembre" oppure "30 nov – 6 dic". */
    static String title(LocalDate monday, LocalDate last) {
        if (monday.getMonthValue() == last.getMonthValue()) {
            return monday.getDayOfMonth() + " – " + last.getDayOfMonth() + " " + WidgetUi.MONTHS[monday.getMonthValue() - 1];
        }
        return (
            monday.getDayOfMonth() +
            " " +
            WidgetUi.MONTHS_SHORT[monday.getMonthValue() - 1] +
            " – " +
            last.getDayOfMonth() +
            " " +
            WidgetUi.MONTHS_SHORT[last.getMonthValue() - 1]
        );
    }
}
