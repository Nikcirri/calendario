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
import java.time.LocalTime;
import java.util.List;
import java.util.Locale;

/**
 * Widget "Lista eventi": la data di oggi e i prossimi impegni, giorno per giorno.
 * Gli impegni li manda l'app (WidgetsPlugin); qui si disegnano soltanto.
 * Toccando il widget si apre l'app, toccando il + si crea un nuovo evento.
 */
public class AgendaWidget extends AppWidgetProvider {

    // Misure in dp: devono restare uguali a quelle dei layout widget_agenda*.xml.
    private static final int PADDING_DP = 20;
    private static final int HEADER_DP = 46;
    private static final int ROW_DP = 28;
    private static final int DAY_DP = 22;
    /** Altezza usata quando Android non dice quanto è alto il widget. */
    private static final int DEFAULT_HEIGHT_DP = 130;
    /** Fin dove si cercano gli impegni da mostrare. */
    private static final int DAYS_AHEAD = 45;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
        WidgetRefreshReceiver.scheduleMidnight(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        // Il widget è stato ridimensionato: cambia il numero di righe che ci stanno.
        render(context, manager, id);
    }

    @Override
    public void onDisabled(Context context) {
        WidgetRefreshReceiver.scheduleMidnight(context);
    }

    static int[] ids(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        return manager == null ? new int[0] : manager.getAppWidgetIds(new ComponentName(context, AgendaWidget.class));
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return;
        for (int id : ids(context)) render(context, manager, id);
    }

    private static void render(Context context, AppWidgetManager manager, int id) {
        LocalTime now = LocalTime.now();
        manager.updateAppWidget(id, build(context, WidgetUi.heightDp(manager, id), LocalDate.now(), now.getHour() * 60 + now.getMinute()));
    }

    /** Disegna il widget per un'altezza, un giorno e un'ora dati (così si può provare con dati fissi). */
    static RemoteViews build(Context context, int heightDp, LocalDate today, int nowMinutes) {
        WidgetData data = WidgetData.load(context);
        String pkg = context.getPackageName();
        RemoteViews views = new RemoteViews(pkg, R.layout.widget_agenda);

        views.setTextViewText(R.id.agenda_title, WidgetUi.capitalize(WidgetUi.WEEKDAYS[WidgetUi.weekdayIndex(today)]) + " " + today.getDayOfMonth());
        views.setTextViewText(R.id.agenda_sub, WidgetUi.MONTHS[today.getMonthValue() - 1] + " " + today.getYear());
        views.removeAllViews(R.id.agenda_list);

        int room = (heightDp > 0 ? heightDp : DEFAULT_HEIGHT_DP) - PADDING_DP - HEADER_DP;
        int shown = 0;
        for (int i = 0; i <= DAYS_AHEAD && room >= ROW_DP; i++) {
            LocalDate day = today.plusDays(i);
            List<WidgetData.Item> items = data.items(day);
            // Di oggi restano solo gli impegni non ancora finiti (i promemoria restano finché non sono fatti).
            if (i == 0) items.removeIf((item) -> item.kind == WidgetData.KIND_EVENT && item.end <= nowMinutes);
            if (items.isEmpty()) continue;
            if (i > 0) {
                // Serve posto per l'etichetta del giorno e almeno un impegno.
                if (room < DAY_DP + ROW_DP) break;
                RemoteViews label = new RemoteViews(pkg, R.layout.widget_agenda_day);
                label.setTextViewText(R.id.agenda_daylabel, (i == 1 ? "domani" : WidgetUi.dayShort(day)).toUpperCase(Locale.ITALIAN));
                views.addView(R.id.agenda_list, label);
                room -= DAY_DP;
            }
            for (WidgetData.Item item : items) {
                if (room < ROW_DP) break;
                RemoteViews row = new RemoteViews(pkg, R.layout.widget_agenda_row);
                row.setTextColor(R.id.row_dot, item.color);
                row.setTextViewText(R.id.row_title, item.title);
                row.setTextViewText(R.id.row_time, timeText(context, item));
                views.addView(R.id.agenda_list, row);
                room -= ROW_DP;
                shown++;
            }
        }

        if (shown == 0) {
            int message = !data.known() ? R.string.widget_open_first : !data.covers(today) ? R.string.widget_open_refresh : R.string.widget_agenda_empty;
            views.setTextViewText(R.id.agenda_empty, context.getString(message));
        }
        views.setViewVisibility(R.id.agenda_empty, shown == 0 ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.agenda_list, shown == 0 ? View.GONE : View.VISIBLE);

        views.setOnClickPendingIntent(android.R.id.background, WidgetUi.openApp(context));
        views.setOnClickPendingIntent(R.id.agenda_add, WidgetUi.newEvent(context));
        return views;
    }

    private static String timeText(Context context, WidgetData.Item item) {
        if (item.kind == WidgetData.KIND_ALL_DAY) return context.getString(R.string.widget_all_day);
        if (item.kind == WidgetData.KIND_REMINDER) return WidgetUi.time(item.start);
        return WidgetUi.time(item.start) + " – " + WidgetUi.time(item.end);
    }
}
