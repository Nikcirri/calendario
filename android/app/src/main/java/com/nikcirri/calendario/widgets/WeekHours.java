package com.nikcirri.calendario.widgets;

import android.content.Context;
import android.content.res.Resources;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;
import androidx.annotation.RequiresApi;
import com.nikcirri.calendario.R;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Il widget "Settimana" quando è alto: la griglia delle ore, come la vista Settimana dell'app.
 * In alto i sette giorni (con gli impegni di tutto il giorno), sotto una lista che si scorre con una
 * riga per ogni ora. Ogni impegno è un blocco colorato che va dall'ora di inizio all'ora di fine.
 *
 * Nei widget una lista può contenere solo righe separate: un blocco lungo più ore è fatto di più pezzi,
 * uno per ogni ora che attraversa, attaccati uno all'altro (solo il primo e l'ultimo hanno gli angoli
 * arrotondati). Le altezze dei pezzi si danno in pixel al testo del blocco (`setHeight`), l'unico modo
 * che funziona su tutte le versioni di Android.
 */
final class WeekHours {

    static final int HOURS = 24;
    /** Altezza di un'ora in dp: uguale a @dimen/widget_hour_height. */
    static final int HOUR_DP = 40;
    /** Durata minima disegnata (come nell'app), così anche promemoria ed eventi brevi si leggono. */
    static final int MIN_BLOCK_MINUTES = 30;
    /** Nei blocchi lunghi il titolo si ripete ogni tante ore: scorrendo se ne vede sempre almeno uno. */
    private static final int TITLE_EVERY_HOURS = 3;
    /** Posti per gli impegni di tutto il giorno sotto ogni giorno (l'ultimo può diventare "+2"). */
    private static final int MAX_ALL_DAY = 2;
    /** Spazio tra i giorni e la lista (margine di week_hours in widget_week_hours.xml). */
    private static final int LIST_MARGIN_DP = 2;
    /** Larghezza usata quando Android non dice quanto è largo il widget. */
    private static final int DEFAULT_WIDTH_DP = 300;
    /** Sotto questa larghezza (in dp) una colonna è troppo stretta per scriverci il titolo. */
    private static final float MIN_TEXT_LANE_DP = 16f;
    /** La colonna delle ore pesa 0.62 e ogni giorno 1 (vedi widget_week_hour.xml). */
    private static final float WEIGHTS = 7.62f;

    private static final int[] CELLS = { R.id.hour_d0, R.id.hour_d1, R.id.hour_d2, R.id.hour_d3, R.id.hour_d4, R.id.hour_d5, R.id.hour_d6 };

    private WeekHours() {}

    /** Un impegno con orario, già sistemato nella colonna del suo giorno. */
    static final class Block {

        final WidgetData.Item item;
        /** Minuti da mezzanotte usati per disegnare (gli impegni brevi hanno un'altezza minima). */
        final int top;
        final int bottom;
        /** Colonna (da 0) e numero di colonne del gruppo di impegni sovrapposti. */
        int col;
        int cols = 1;
        /** Numero del gruppo di impegni sovrapposti a cui appartiene. */
        int group;
        /** Prima ora in cui il titolo ci sta (-1 = da nessuna parte, -2 = ancora da calcolare). */
        int titleHour = -2;

        Block(WidgetData.Item item, int top, int bottom) {
            this.item = item;
            this.top = top;
            this.bottom = bottom;
        }
    }

    /** Misure in pixel, calcolate una volta per tutta la griglia. */
    private static final class Metrics {

        final int rowPx;
        final int gapPx;
        final int edgePx;
        final int padPx;
        final int nowPx;
        final int lineHeightPx;
        /** Larghezza di un giorno, in dp. */
        final float dayDp;

        Metrics(Context context, int widthDp) {
            Resources res = context.getResources();
            float density = res.getDisplayMetrics().density;
            rowPx = res.getDimensionPixelSize(R.dimen.widget_hour_height);
            gapPx = Math.max(1, Math.round(density));
            edgePx = Math.max(1, Math.round(1.5f * density));
            padPx = res.getDimensionPixelSize(R.dimen.widget_block_pad);
            nowPx = res.getDimensionPixelSize(R.dimen.widget_now_line);
            // Altezza di una riga di testo del blocco, con un po' di margine: serve a sapere quante righe ci stanno.
            Paint paint = new Paint();
            paint.setTypeface(Typeface.DEFAULT);
            paint.setTextSize(res.getDimension(R.dimen.widget_block_text));
            Paint.FontMetricsInt fm = paint.getFontMetricsInt();
            lineHeightPx = Math.max(1, (int) Math.ceil((fm.descent - fm.ascent + fm.leading) * 1.1f));
            dayDp = ((widthDp > 0 ? widthDp : DEFAULT_WIDTH_DP) - WeekWidget.PADDING_DP) / WEIGHTS;
        }

        /** Da minuti (dall'inizio dell'ora) a pixel. */
        int px(int minutes) {
            return Math.round(minutes * rowPx / 60f);
        }

        /** Quante righe di titolo stanno in un pezzo alto così. */
        int lines(int heightPx) {
            return Math.max(0, (heightPx - padPx) / lineHeightPx);
        }
    }

    /** Sui telefoni fino ad Android 11 le righe della lista le fornisce un servizio a parte (WeekHoursService). */
    static boolean usesService() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S;
    }

    static boolean isAllDay(WidgetData.Item item) {
        return item.kind == WidgetData.KIND_ALL_DAY || (item.start <= 0 && item.end >= 1440);
    }

    /** Disegna il widget con la griglia delle ore per la settimana che contiene `today`. */
    static RemoteViews build(Context context, int widgetId, int widthDp, int heightDp, LocalDate today, int nowMinutes) {
        return build(context, widgetId, widthDp, heightDp, today, nowMinutes, usesService());
    }

    /** Come sopra, scegliendo a mano da dove arrivano le righe (serve alle prove). */
    static RemoteViews build(Context context, int widgetId, int widthDp, int heightDp, LocalDate today, int nowMinutes, boolean service) {
        WidgetData data = WidgetData.load(context);
        String pkg = context.getPackageName();
        RemoteViews views = new RemoteViews(pkg, R.layout.widget_week_hours);

        LocalDate monday = today.minusDays(WidgetUi.weekdayIndex(today));
        views.setTextViewText(R.id.week_title, WeekWidget.title(monday, monday.plusDays(6)));
        views.removeAllViews(R.id.week_heads);
        int allDayRows = 0;
        for (int d = 0; d < 7; d++) {
            LocalDate day = monday.plusDays(d);
            RemoteViews head = new RemoteViews(pkg, R.layout.widget_week_head);
            WeekWidget.fillDay(context, head, d, day, today);
            List<WidgetData.Item> allDay = new ArrayList<>();
            for (WidgetData.Item item : data.items(day)) if (isAllDay(item)) allDay.add(item);
            WeekWidget.addChips(pkg, head, allDay, MAX_ALL_DAY);
            allDayRows = Math.max(allDayRows, Math.min(allDay.size(), MAX_ALL_DAY));
            views.addView(R.id.week_heads, head);
        }

        if (service) {
            views.setRemoteAdapter(R.id.week_hours, WeekHoursService.intent(context, widgetId));
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Api31.setRows(views, rows(context, data, monday, today, nowMinutes, widthDp));
        }
        views.setPendingIntentTemplate(R.id.week_hours, WidgetUi.openDayTemplate(context));

        int listDp = heightDp - WeekWidget.PADDING_DP - WeekWidget.HEADER_DP - WeekWidget.DAY_HEAD_DP - allDayRows * WeekWidget.CHIP_DP - LIST_MARGIN_DP;
        views.setScrollPosition(R.id.week_hours, scrollRow(nowMinutes, listDp / HOUR_DP));

        views.setOnClickPendingIntent(android.R.id.background, WidgetUi.openApp(context));
        views.setOnClickPendingIntent(R.id.week_add, WidgetUi.newEvent(context));
        return views;
    }

    /** Da Android 12 le righe viaggiano insieme al widget: niente servizio a parte. */
    @RequiresApi(Build.VERSION_CODES.S)
    private static final class Api31 {

        static void setRows(RemoteViews views, RemoteViews[] rows) {
            RemoteViews.RemoteCollectionItems.Builder items = new RemoteViews.RemoteCollectionItems.Builder().setHasStableIds(true).setViewTypeCount(1);
            for (int hour = 0; hour < rows.length; hour++) items.addItem(hour, rows[hour]);
            // La lista viene prima impostata vuota e subito dopo riempita: così Android la considera
            // "appena cambiata" e lo spostamento verso l'ora di adesso (setScrollPosition, chiesto subito
            // dopo) viene eseguito anche quando il widget è appena stato creato. Chiesto su una lista
            // nuova e ancora senza righe, lo spostamento andrebbe perso.
            views.setRemoteAdapter(R.id.week_hours, new RemoteViews.RemoteCollectionItems.Builder().setHasStableIds(true).setViewTypeCount(1).build());
            views.setRemoteAdapter(R.id.week_hours, items.build());
        }
    }

    /**
     * La riga da rendere visibile perché la lista mostri "adesso". La lista scorre il minimo indispensabile,
     * quindi di solito questa riga finisce in fondo: per questo è qualche ora dopo adesso, quante ne servono
     * per avere in cima l'ora prima di quella attuale.
     */
    static int scrollRow(int nowMinutes, int visibleRows) {
        int rows = Math.max(2, visibleRows);
        return Math.max(0, Math.min(HOURS - 1, nowMinutes / 60 + rows - 2));
    }

    /** Le 24 righe della griglia (una per ora) per la settimana che inizia da `monday`. */
    static RemoteViews[] rows(Context context, WidgetData data, LocalDate monday, LocalDate today, int nowMinutes, int widthDp) {
        Metrics m = new Metrics(context, widthDp);
        List<List<Block>> week = new ArrayList<>(7);
        for (int d = 0; d < 7; d++) week.add(layout(data.items(monday.plusDays(d))));
        RemoteViews[] rows = new RemoteViews[HOURS];
        for (int hour = 0; hour < HOURS; hour++) rows[hour] = row(context, m, week, monday, today, nowMinutes, hour);
        return rows;
    }

    /**
     * Dispone gli impegni con orario di un giorno in colonne affiancate quando si sovrappongono
     * (stessa regola di `layoutTimed` in src/lib/logic/occurrences.ts). Il risultato è in ordine di inizio.
     */
    static List<Block> layout(List<WidgetData.Item> items) {
        List<Block> timed = new ArrayList<>();
        for (WidgetData.Item item : items) {
            if (isAllDay(item)) continue;
            int top = Math.max(0, Math.min(item.start, 1440 - MIN_BLOCK_MINUTES));
            int bottom = Math.min(1440, Math.max(item.end, top + MIN_BLOCK_MINUTES));
            timed.add(new Block(item, top, bottom));
        }
        timed.sort((a, b) -> a.top != b.top ? a.top - b.top : b.bottom - a.bottom);

        List<Block> group = new ArrayList<>();
        int groupEnd = -1;
        int groupNumber = 0;
        for (Block block : timed) {
            if (!group.isEmpty() && block.top >= groupEnd) {
                close(group, groupNumber++);
                group.clear();
            }
            int col = 0;
            while (taken(group, col, block.top)) col++;
            block.col = col;
            group.add(block);
            groupEnd = Math.max(groupEnd, block.bottom);
        }
        if (!group.isEmpty()) close(group, groupNumber);
        return timed;
    }

    /** La colonna è occupata, a quell'ora, da un impegno del gruppo? */
    private static boolean taken(List<Block> group, int col, int top) {
        for (Block b : group) if (b.col == col && b.bottom > top) return true;
        return false;
    }

    private static void close(List<Block> group, int number) {
        int cols = 1;
        for (Block b : group) cols = Math.max(cols, b.col + 1);
        for (Block b : group) {
            b.cols = cols;
            b.group = number;
        }
    }

    /** Una riga della lista: l'ora `hour` per i sette giorni. */
    private static RemoteViews row(Context context, Metrics m, List<List<Block>> week, LocalDate monday, LocalDate today, int nowMinutes, int hour) {
        String pkg = context.getPackageName();
        RemoteViews row = new RemoteViews(pkg, R.layout.widget_week_hour);
        boolean nowHour = nowMinutes / 60 == hour;
        row.setTextViewText(R.id.hour_label, String.valueOf(hour));
        row.setTextColor(R.id.hour_label, context.getColor(nowHour ? R.color.widget_sunday : R.color.widget_dim));
        int from = hour * 60;
        int to = from + 60;

        for (int d = 0; d < 7; d++) {
            int cell = CELLS[d];
            LocalDate day = monday.plusDays(d);
            boolean isToday = day.equals(today);
            // Le righe vengono riusate mentre si scorre: ogni casella va svuotata e ridisegnata per intero.
            row.removeAllViews(cell);
            row.setInt(cell, "setBackgroundResource", isToday ? R.drawable.widget_hour_cell_today : R.drawable.widget_hour_cell);

            List<Block> blocks = week.get(d);
            int i = 0;
            while (i < blocks.size()) {
                int start = i;
                int group = blocks.get(i).group;
                int groupTop = blocks.get(i).top;
                int groupBottom = 0;
                while (i < blocks.size() && blocks.get(i).group == group) {
                    groupBottom = Math.max(groupBottom, blocks.get(i).bottom);
                    i++;
                }
                if (groupBottom > from && groupTop < to) row.addView(cell, group(context, m, blocks.subList(start, i), hour));
            }

            if (isToday && nowHour) {
                RemoteViews now = new RemoteViews(pkg, R.layout.widget_week_now);
                int gap = Math.max(0, Math.min(m.rowPx - m.nowPx, m.px(nowMinutes - from) - m.nowPx / 2));
                now.setInt(R.id.now_gap, "setHeight", gap);
                row.addView(cell, now);
            }
            row.setOnClickFillInIntent(cell, WidgetUi.dayFillIn(day));
        }
        return row;
    }

    /** Un gruppo di impegni sovrapposti dentro la casella di un'ora: una colonna per ognuno, affiancate. */
    private static RemoteViews group(Context context, Metrics m, List<Block> blocks, int hour) {
        String pkg = context.getPackageName();
        RemoteViews group = new RemoteViews(pkg, R.layout.widget_week_group);
        int from = hour * 60;
        int to = from + 60;
        int cols = blocks.get(0).cols;
        boolean roomForText = m.dayDp / cols >= MIN_TEXT_LANE_DP;
        for (int col = 0; col < cols; col++) {
            RemoteViews lane = new RemoteViews(pkg, R.layout.widget_week_lane);
            int cursor = 0;
            for (Block b : blocks) {
                if (b.col != col || b.bottom <= from || b.top >= to) continue;
                boolean first = b.top >= from;
                boolean last = b.bottom <= to;
                int top = m.px(Math.max(b.top, from) - from);
                // Un filo di spazio sotto l'ultimo pezzo stacca il blocco da quello che viene dopo.
                int bottom = Math.max(top + 1, m.px(Math.min(b.bottom, to) - from) - (last ? m.gapPx : 0));
                if (top > cursor) {
                    RemoteViews gap = new RemoteViews(pkg, R.layout.widget_week_gap);
                    gap.setInt(R.id.hour_gap, "setHeight", top - cursor);
                    lane.addView(R.id.hour_lane, gap);
                }
                lane.addView(R.id.hour_lane, piece(context, m, b, hour, first, last, bottom - top, roomForText));
                cursor = bottom;
            }
            group.addView(R.id.hour_group, lane);
        }
        return group;
    }

    /** Il pezzo di un blocco che cade in un'ora. */
    private static RemoteViews piece(Context context, Metrics m, Block b, int hour, boolean first, boolean last, int heightPx, boolean roomForText) {
        RemoteViews piece = new RemoteViews(context.getPackageName(), R.layout.widget_week_block);
        int shape = first && last ? R.drawable.widget_block : first ? R.drawable.widget_block_top : last ? R.drawable.widget_block_bottom : R.drawable.widget_block_mid;
        boolean reminder = b.item.kind == WidgetData.KIND_REMINDER;
        piece.setImageViewResource(R.id.block_bg, shape);
        if (reminder) {
            // Promemoria: sfondo scuro con il bordo del suo colore, come nell'app.
            piece.setInt(R.id.block_bg, "setColorFilter", b.item.color);
            piece.setViewVisibility(R.id.block_edge, View.VISIBLE);
            piece.setViewPadding(R.id.block_edge, m.edgePx, first ? m.edgePx : 0, m.edgePx, last ? m.edgePx : 0);
            piece.setImageViewResource(R.id.block_fill, shape);
            piece.setInt(R.id.block_fill, "setColorFilter", context.getColor(R.color.widget_surface2));
            piece.setTextColor(R.id.block_text, context.getColor(R.color.widget_text));
        } else {
            piece.setInt(R.id.block_bg, "setColorFilter", WidgetUi.chipColor(b.item.color));
            piece.setViewVisibility(R.id.block_edge, View.GONE);
            piece.setTextColor(R.id.block_text, 0xFFFFFFFF);
        }

        int lines = roomForText && showsTitle(m, b, hour) ? m.lines(heightPx) : 0;
        piece.setTextViewText(R.id.block_text, lines > 0 ? b.item.title : "");
        // Prima l'altezza esatta in pixel, poi (se c'è il titolo) il numero di righe che ci stanno:
        // così il testo non viene tagliato a metà riga e il pezzo resta alto quanto deve.
        piece.setInt(R.id.block_text, "setHeight", heightPx);
        if (lines > 0) piece.setInt(R.id.block_text, "setMaxLines", lines);
        return piece;
    }

    /** Il titolo va nel primo pezzo abbastanza alto da contenerlo e poi, nei blocchi lunghi, ogni TITLE_EVERY_HOURS ore. */
    private static boolean showsTitle(Metrics m, Block b, int hour) {
        if (b.titleHour == -2) {
            b.titleHour = -1;
            for (int h = b.top / 60; h * 60 < b.bottom; h++) {
                if (m.lines(pieceHeight(m, b, h)) > 0) {
                    b.titleHour = h;
                    break;
                }
            }
        }
        return b.titleHour >= 0 && hour >= b.titleHour && (hour - b.titleHour) % TITLE_EVERY_HOURS == 0;
    }

    /** Altezza in pixel del pezzo del blocco che cade nell'ora `hour` (stesso calcolo di `group`). */
    private static int pieceHeight(Metrics m, Block b, int hour) {
        int from = hour * 60;
        int to = from + 60;
        int top = m.px(Math.max(b.top, from) - from);
        int bottom = Math.max(top + 1, m.px(Math.min(b.bottom, to) - from) - (b.bottom <= to ? m.gapPx : 0));
        return bottom - top;
    }
}
