package com.nikcirri.calendario.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.widget.RemoteViews;
import com.nikcirri.calendario.R;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Widget "Mese": la griglia del mese di oggi, con un pallino colorato per ogni impegno (al massimo 3).
 * Toccando un giorno si apre l'app su quella giornata; il + crea un nuovo evento.
 */
public class MonthWidget extends AppWidgetProvider {

    private static final int MAX_DOTS = 3;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, build(context, LocalDate.now()));
        WidgetRefreshReceiver.scheduleMidnight(context);
    }

    @Override
    public void onDisabled(Context context) {
        WidgetRefreshReceiver.scheduleMidnight(context);
    }

    static int[] ids(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        return manager == null ? new int[0] : manager.getAppWidgetIds(new ComponentName(context, MonthWidget.class));
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return;
        int[] ids = ids(context);
        if (ids.length == 0) return;
        RemoteViews views = build(context, LocalDate.now());
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    /** Disegna il mese che contiene `today` (così si può provare con una data fissa). */
    static RemoteViews build(Context context, LocalDate today) {
        WidgetData data = WidgetData.load(context);
        String pkg = context.getPackageName();
        RemoteViews views = new RemoteViews(pkg, R.layout.widget_month);
        int text = context.getColor(R.color.widget_text);
        int dim = context.getColor(R.color.widget_dim);
        int sunday = context.getColor(R.color.widget_sunday);
        int onAccent = context.getColor(R.color.widget_on_accent);

        views.setTextViewText(R.id.month_title, WidgetUi.capitalize(WidgetUi.MONTHS[today.getMonthValue() - 1]) + " " + today.getYear());
        views.removeAllViews(R.id.month_weeks);

        LocalDate first = today.withDayOfMonth(1);
        LocalDate gridStart = first.minusDays(WidgetUi.weekdayIndex(first));
        // Se la sesta settimana è tutta del mese dopo non si mostra: le righe diventano più alte.
        int weeks = gridStart.plusDays(35).getMonthValue() == today.getMonthValue() ? 6 : 5;

        for (int w = 0; w < weeks; w++) {
            RemoteViews row = new RemoteViews(pkg, R.layout.widget_month_week);
            for (int d = 0; d < 7; d++) {
                LocalDate day = gridStart.plusDays(w * 7L + d);
                boolean inMonth = day.getMonthValue() == today.getMonthValue();
                RemoteViews cell = new RemoteViews(pkg, R.layout.widget_month_cell);
                cell.setTextViewText(R.id.month_num, String.valueOf(day.getDayOfMonth()));
                if (day.equals(today)) {
                    cell.setInt(R.id.month_num, "setBackgroundResource", R.drawable.widget_today);
                    cell.setTextColor(R.id.month_num, onAccent);
                } else {
                    cell.setTextColor(R.id.month_num, !inMonth ? dim : d == 6 ? sunday : text);
                }
                cell.setTextViewText(R.id.month_dots, dots(data.items(day), inMonth));
                cell.setOnClickPendingIntent(R.id.month_cell, WidgetUi.openDay(context, day));
                row.addView(R.id.month_week, cell);
            }
            views.addView(R.id.month_weeks, row);
        }

        views.setOnClickPendingIntent(android.R.id.background, WidgetUi.openApp(context));
        views.setOnClickPendingIntent(R.id.month_add, WidgetUi.newEvent(context));
        return views;
    }

    /** Un pallino per ogni colore diverso tra gli impegni del giorno (al massimo 3). */
    private static CharSequence dots(List<WidgetData.Item> items, boolean inMonth) {
        List<Integer> colors = new ArrayList<>();
        for (WidgetData.Item item : items) {
            if (!colors.contains(item.color)) colors.add(item.color);
            if (colors.size() >= MAX_DOTS) break;
        }
        SpannableStringBuilder text = new SpannableStringBuilder();
        for (int color : colors) {
            int start = text.length();
            text.append("●");
            // I giorni degli altri mesi hanno i pallini più spenti.
            int shown = inMonth ? color : (color & 0x00FFFFFF) | 0x66000000;
            text.setSpan(new ForegroundColorSpan(shown), start, text.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        }
        return text;
    }
}
