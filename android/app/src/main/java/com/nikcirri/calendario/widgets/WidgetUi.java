package com.nikcirri.calendario.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import com.nikcirri.calendario.MainActivity;
import java.time.LocalDate;
import java.util.Locale;

/** Cose in comune tra i widget: testi in italiano, colori, tocchi che aprono l'app. */
final class WidgetUi {

    /** Il + di un widget: l'app si apre sulla schermata "nuovo evento". */
    static final String ACTION_NEW_EVENT = "com.nikcirri.calendario.widget.NEW_EVENT";
    /** Tocco su un giorno: l'app si apre su quella giornata. */
    static final String ACTION_OPEN_DAY = "com.nikcirri.calendario.widget.OPEN_DAY";
    static final String EXTRA_DATE = "date";

    static final String[] MONTHS = {
        "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
    };
    static final String[] MONTHS_SHORT = { "gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic" };
    /** Indice 0 = lunedì. */
    static final String[] WEEKDAYS = { "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica" };
    static final String[] WEEKDAYS_SHORT = { "lun", "mar", "mer", "gio", "ven", "sab", "dom" };

    /** Sfondo scuro su cui si "spengono" i colori degli impegni, come nell'app. */
    private static final int DARK_BASE = 0xFF12141D;

    private WidgetUi() {}

    static String capitalize(String s) {
        return s.isEmpty() ? s : s.substring(0, 1).toUpperCase(Locale.ITALIAN) + s.substring(1);
    }

    /** 510 → "08:30" (1440, la mezzanotte di fine giornata, diventa "00:00"). */
    static String time(int minutes) {
        int m = ((minutes % 1440) + 1440) % 1440;
        return String.format(Locale.ROOT, "%02d:%02d", m / 60, m % 60);
    }

    /** Indice del giorno della settimana: 0 = lunedì … 6 = domenica. */
    static int weekdayIndex(LocalDate day) {
        return day.getDayOfWeek().getValue() - 1;
    }

    /** "mar 10 nov". */
    static String dayShort(LocalDate day) {
        return WEEKDAYS_SHORT[weekdayIndex(day)] + " " + day.getDayOfMonth() + " " + MONTHS_SHORT[day.getMonthValue() - 1];
    }

    /** Il colore dell'impegno scurito, così il testo bianco sopra si legge sempre. */
    static int chipColor(int color) {
        float keep = 0.58f;
        int r = Math.round(Color.red(color) * keep + Color.red(DARK_BASE) * (1 - keep));
        int g = Math.round(Color.green(color) * keep + Color.green(DARK_BASE) * (1 - keep));
        int b = Math.round(Color.blue(color) * keep + Color.blue(DARK_BASE) * (1 - keep));
        return Color.rgb(r, g, b);
    }

    /** Altezza del widget in dp (0 se Android non la dice). */
    static int heightDp(AppWidgetManager manager, int id) {
        Bundle options = manager.getAppWidgetOptions(id);
        return options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
    }

    private static Intent appIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return intent;
    }

    private static final int FLAGS = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

    /** Apre l'app così com'è. */
    static PendingIntent openApp(Context context) {
        Intent intent = appIntent(context);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        return PendingIntent.getActivity(context, 0, intent, FLAGS);
    }

    /** Apre l'app sulla schermata "nuovo evento". */
    static PendingIntent newEvent(Context context) {
        Intent intent = appIntent(context);
        intent.setAction(ACTION_NEW_EVENT);
        return PendingIntent.getActivity(context, 1, intent, FLAGS);
    }

    /** Apre l'app su quel giorno. Ogni giorno ha il suo numero, così i tocchi non si confondono tra loro. */
    static PendingIntent openDay(Context context, LocalDate day) {
        Intent intent = appIntent(context);
        intent.setAction(ACTION_OPEN_DAY);
        intent.putExtra(EXTRA_DATE, day.toString());
        return PendingIntent.getActivity(context, 100_000 + (int) day.toEpochDay(), intent, FLAGS);
    }
}
