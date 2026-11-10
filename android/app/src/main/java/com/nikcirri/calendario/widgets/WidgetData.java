package com.nikcirri.calendario.widgets;

import android.content.Context;
import android.graphics.Color;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Gli impegni giorno per giorno, letti dalla fotografia mandata dall'app
 * (la prepara src/lib/logic/widget.ts: stessa forma, stessi nomi dei campi).
 */
final class WidgetData {

    static final int KIND_EVENT = 0;
    static final int KIND_ALL_DAY = 1;
    static final int KIND_REMINDER = 2;
    private static final int DEFAULT_COLOR = 0xFF7D8799;

    /** Un impegno in un certo giorno. */
    static final class Item {

        final String title;
        /** Minuti da mezzanotte, in quel giorno. */
        final int start;
        final int end;
        final int color;
        final int kind;

        Item(String title, int start, int end, int color, int kind) {
            this.title = title;
            this.start = start;
            this.end = end;
            this.color = color;
            this.kind = kind;
        }
    }

    private final JSONObject days;
    private final LocalDate from;
    private final LocalDate to;

    private WidgetData(JSONObject days, LocalDate from, LocalDate to) {
        this.days = days;
        this.from = from;
        this.to = to;
    }

    static WidgetData load(Context context) {
        return parse(WidgetStore.snapshot(context));
    }

    /** Legge la fotografia; se manca o non è valida restituisce dati vuoti (i widget restano utilizzabili). */
    static WidgetData parse(String json) {
        if (json == null || json.isEmpty()) return new WidgetData(null, null, null);
        try {
            JSONObject root = new JSONObject(json);
            JSONObject days = root.getJSONObject("days");
            LocalDate from = LocalDate.parse(root.getString("from"));
            LocalDate to = LocalDate.parse(root.getString("to"));
            return new WidgetData(days, from, to);
        } catch (JSONException | RuntimeException e) {
            return new WidgetData(null, null, null);
        }
    }

    /** Falso finché l'app non ha mai mandato i dati (app appena installata e mai aperta). */
    boolean known() {
        return days != null;
    }

    /** Il giorno è dentro il periodo coperto dai dati? Se no, l'app non viene aperta da troppo tempo. */
    boolean covers(LocalDate day) {
        return days != null && !day.isBefore(from) && !day.isAfter(to);
    }

    List<Item> items(LocalDate day) {
        List<Item> out = new ArrayList<>();
        if (days == null) return out;
        JSONArray list = days.optJSONArray(day.toString());
        if (list == null) return out;
        for (int i = 0; i < list.length(); i++) {
            JSONObject o = list.optJSONObject(i);
            if (o == null) continue;
            out.add(new Item(o.optString("t", ""), o.optInt("s", 0), o.optInt("e", 0), parseColor(o.optString("c", "")), o.optInt("k", KIND_EVENT)));
        }
        return out;
    }

    private static int parseColor(String hex) {
        try {
            return Color.parseColor(hex);
        } catch (RuntimeException e) {
            return DEFAULT_COLOR;
        }
    }
}
