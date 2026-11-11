package com.nikcirri.calendario.widgets;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Fornisce le righe della griglia delle ore del widget "Settimana" sui telefoni fino ad Android 11,
 * dove una lista dentro un widget può essere riempita solo da un servizio come questo.
 * Da Android 12 le righe viaggiano insieme al widget (vedi WeekHours) e questo servizio non viene usato.
 * Solo Android può collegarsi (permesso BIND_REMOTEVIEWS nel manifest).
 */
public class WeekHoursService extends RemoteViewsService {

    static Intent intent(Context context, int widgetId) {
        Intent intent = new Intent(context, WeekHoursService.class);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        // Android distingue gli intent dai "dati", non dagli extra: così ogni widget ha la sua lista.
        intent.setData(Uri.parse("calendario://widget/settimana/" + widgetId));
        return intent;
    }

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext(), intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID));
    }

    /** Le 24 righe (una per ora), ricalcolate ogni volta che il widget viene ridisegnato. */
    static final class Factory implements RemoteViewsFactory {

        private final Context context;
        private final int widgetId;
        private volatile RemoteViews[] rows = new RemoteViews[0];

        Factory(Context context, int widgetId) {
            this.context = context;
            this.widgetId = widgetId;
        }

        @Override
        public void onCreate() {
            // Le righe si preparano in onDataSetChanged, che Android chiama subito dopo.
        }

        @Override
        public void onDataSetChanged() {
            LocalDateTime now = LocalDateTime.now();
            LocalDate today = now.toLocalDate();
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            int widthDp = manager == null ? 0 : WidgetUi.widthDp(manager, widgetId);
            LocalDate monday = today.minusDays(WidgetUi.weekdayIndex(today));
            rows = WeekHours.rows(context, WidgetData.load(context), monday, today, now.getHour() * 60 + now.getMinute(), widthDp);
        }

        @Override
        public void onDestroy() {
            rows = new RemoteViews[0];
        }

        @Override
        public int getCount() {
            return rows.length;
        }

        @Override
        public RemoteViews getViewAt(int position) {
            RemoteViews[] current = rows;
            return position >= 0 && position < current.length ? current[position] : null;
        }

        @Override
        public RemoteViews getLoadingView() {
            // null = la riga provvisoria di Android, che si vede solo per un attimo.
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 1;
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public boolean hasStableIds() {
            return true;
        }
    }
}
