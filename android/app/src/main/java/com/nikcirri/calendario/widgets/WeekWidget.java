package com.nikcirri.calendario.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;
import com.nikcirri.calendario.R;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

/**
 * Widget "Settimana": i sette giorni della settimana di oggi, ognuno con i suoi impegni.
 * Toccando un giorno si apre l'app su quella giornata; il + crea un nuovo evento.
 */
public class WeekWidget extends AppWidgetProvider {

    // Misure in dp: devono restare uguali a quelle dei layout widget_week*.xml.
    private static final int PADDING_DP = 20;
    private static final int HEADER_DP = 36;
    private static final int DAY_HEAD_DP = 38;
    private static final int CHIP_DP = 18;
    private static final int DEFAULT_HEIGHT_DP = 130;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
        WidgetRefreshReceiver.scheduleMidnight(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        render(context, manager, id);
    }

    @Override
    public void onDisabled(Context context) {
        WidgetRefreshReceiver.scheduleMidnight(context);
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

    private static void render(Context context, AppWidgetManager manager, int id) {
        manager.updateAppWidget(id, build(context, WidgetUi.heightDp(manager, id), LocalDate.now()));
    }

    /** Disegna la settimana che contiene `today`, per un'altezza data (così si può provare con dati fissi). */
    static RemoteViews build(Context context, int heightDp, LocalDate today) {
        WidgetData data = WidgetData.load(context);
        String pkg = context.getPackageName();
        RemoteViews views = new RemoteViews(pkg, R.layout.widget_week);
        int text = context.getColor(R.color.widget_text);
        int sunday = context.getColor(R.color.widget_sunday);
        int onAccent = context.getColor(R.color.widget_on_accent);

        LocalDate monday = today.minusDays(WidgetUi.weekdayIndex(today));
        LocalDate last = monday.plusDays(6);
        views.setTextViewText(R.id.week_title, title(monday, last));
        views.removeAllViews(R.id.week_days);

        int room = (heightDp > 0 ? heightDp : DEFAULT_HEIGHT_DP) - PADDING_DP - HEADER_DP - DAY_HEAD_DP;
        int maxChips = Math.max(1, room / CHIP_DP);

        for (int d = 0; d < 7; d++) {
            LocalDate day = monday.plusDays(d);
            RemoteViews col = new RemoteViews(pkg, R.layout.widget_week_day);
            col.setTextViewText(R.id.week_name, WidgetUi.WEEKDAYS_SHORT[d].toUpperCase(Locale.ITALIAN));
            col.setTextViewText(R.id.week_num, String.valueOf(day.getDayOfMonth()));
            if (day.equals(today)) {
                col.setInt(R.id.week_num, "setBackgroundResource", R.drawable.widget_today);
                col.setTextColor(R.id.week_num, onAccent);
            } else {
                col.setTextColor(R.id.week_num, d == 6 ? sunday : text);
            }

            List<WidgetData.Item> items = data.items(day);
            // Se non ci stanno tutti, l'ultimo posto dice quanti ne restano ("+2").
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
            col.setOnClickPendingIntent(R.id.week_col, WidgetUi.openDay(context, day));
            views.addView(R.id.week_days, col);
        }

        views.setOnClickPendingIntent(android.R.id.background, WidgetUi.openApp(context));
        views.setOnClickPendingIntent(R.id.week_add, WidgetUi.newEvent(context));
        return views;
    }

    /** "9 – 15 novembre" oppure "30 nov – 6 dic". */
    private static String title(LocalDate monday, LocalDate last) {
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
