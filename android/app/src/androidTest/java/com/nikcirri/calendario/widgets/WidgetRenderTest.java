package com.nikcirri.calendario.widgets;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.RemoteViews;
import android.widget.TextView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Prova sul telefono (emulatore) che i tre widget si disegnino davvero con dati di esempio:
 * Android rifiuta in silenzio le viste non ammesse nei widget, e qui un errore del genere viene a galla.
 * Salva anche le immagini dei widget, da guardare dopo la prova.
 */
@RunWith(AndroidJUnit4.class)
public class WidgetRenderTest {

    /** Martedì 10 novembre 2026, 13:04. */
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 10);
    private static final int NOW = 13 * 60 + 4;

    private static final String TIR = "{\"t\":\"Tirocinio\",\"s\":510,\"e\":870,\"c\":\"#3987e5\",\"k\":0}";
    private static final String SNAPSHOT =
        "{\"v\":1,\"from\":\"2026-10-26\",\"to\":\"2027-01-24\",\"days\":{" +
        "\"2026-11-02\":[" + TIR + "],\"2026-11-03\":[" + TIR + "],\"2026-11-04\":[" + TIR + "],\"2026-11-05\":[" + TIR + "]," +
        "\"2026-11-09\":[{\"t\":\"Pulizia strade\",\"s\":0,\"e\":1440,\"c\":\"#7d8799\",\"k\":1}," + TIR + "]," +
        "\"2026-11-10\":[{\"t\":\"Colazione\",\"s\":420,\"e\":450,\"c\":\"#c98500\",\"k\":0}," + TIR + ",{\"t\":\"Pagare la bolletta\",\"s\":1020,\"e\":1020,\"c\":\"#7d8799\",\"k\":2}]," +
        "\"2026-11-11\":[" + TIR + ",{\"t\":\"Cena con Marco\",\"s\":1200,\"e\":1260,\"c\":\"#d55181\",\"k\":0}]," +
        "\"2026-11-12\":[" + TIR + ",{\"t\":\"Laboratorio\",\"s\":900,\"e\":1020,\"c\":\"#d95926\",\"k\":0},{\"t\":\"Calcetto\",\"s\":1080,\"e\":1140,\"c\":\"#199e70\",\"k\":0},{\"t\":\"Pizza\",\"s\":1230,\"e\":1320,\"c\":\"#d55181\",\"k\":0}]," +
        "\"2026-11-22\":[{\"t\":\"Compleanno di Marta\",\"s\":0,\"e\":1440,\"c\":\"#d55181\",\"k\":1}]," +
        "\"2026-12-01\":[" + TIR + "]}}";

    private Context context;

    @Before
    public void setUp() {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        WidgetStore.saveSnapshot(context, SNAPSHOT);
    }

    /** Costruisce davvero le viste del widget, come fa la schermata Home, e ne salva l'immagine. */
    private View inflate(RemoteViews views, int widthDp, int heightDp, String name) {
        View[] out = new View[1];
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            View view = views.apply(context, new FrameLayout(context));
            float density = context.getResources().getDisplayMetrics().density;
            int w = Math.round(widthDp * density);
            int h = Math.round(heightDp * density);
            view.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY));
            view.layout(0, 0, w, h);
            Bitmap bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.drawColor(0xFF0E1018);
            view.draw(canvas);
            save(bitmap, name);
            out[0] = view;
        });
        return out[0];
    }

    private void save(Bitmap bitmap, String name) {
        // Cartella che Gradle copia sul computer a fine prova (build/outputs/connected_android_test_additional_output).
        String dir = InstrumentationRegistry.getArguments().getString("additionalTestOutputDir");
        File folder = dir != null ? new File(dir) : context.getExternalFilesDir(null);
        if (folder == null) return;
        folder.mkdirs();
        try (FileOutputStream stream = new FileOutputStream(new File(folder, name + ".png"))) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream);
        } catch (Exception e) {
            // L'immagine è un extra: la prova vale lo stesso.
        }
    }

    private static List<String> texts(View view) {
        List<String> out = new ArrayList<>();
        collect(view, out);
        return out;
    }

    private static void collect(View view, List<String> out) {
        if (view.getVisibility() != View.VISIBLE) return;
        if (view instanceof TextView) out.add(((TextView) view).getText().toString());
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) collect(group.getChildAt(i), out);
        }
    }

    @Test
    public void agendaShowsTodayAndNextDays() {
        List<String> t = texts(inflate(AgendaWidget.build(context, 260, TODAY, NOW), 320, 260, "widget-lista"));
        assertTrue(t.toString(), t.contains("Martedì 10"));
        assertTrue(t.toString(), t.contains("novembre 2026"));
        // La colazione delle 7 è già finita, il tirocinio no.
        assertFalse(t.toString(), t.contains("Colazione"));
        assertTrue(t.toString(), t.contains("Tirocinio"));
        assertTrue(t.toString(), t.contains("08:30 – 14:30"));
        assertTrue(t.toString(), t.contains("Pagare la bolletta"));
        assertTrue(t.toString(), t.contains("17:00"));
        assertTrue(t.toString(), t.contains("DOMANI"));
        assertTrue(t.toString(), t.contains("Cena con Marco"));
    }

    @Test
    public void agendaFitsSmallHeightAndEmptyStates() {
        List<String> small = texts(inflate(AgendaWidget.build(context, 110, TODAY, NOW), 320, 110, "widget-lista-piccolo"));
        assertTrue(small.toString(), small.contains("Tirocinio"));
        assertFalse(small.toString(), small.contains("Cena con Marco"));

        // Un giorno oltre i dati salvati: il widget chiede di riaprire l'app.
        List<String> stale = texts(inflate(AgendaWidget.build(context, 180, LocalDate.of(2027, 6, 1), NOW), 320, 180, "widget-lista-vecchio"));
        assertTrue(stale.toString(), stale.contains("Apri l’app per aggiornare gli impegni"));

        WidgetStore.saveSnapshot(context, "non valido");
        List<String> none = texts(inflate(AgendaWidget.build(context, 180, TODAY, NOW), 320, 180, "widget-lista-vuoto"));
        assertTrue(none.toString(), none.contains("Apri l’app per vedere qui i tuoi impegni"));
    }

    @Test
    public void monthShowsGridWithToday() {
        List<String> t = texts(inflate(MonthWidget.build(context, TODAY), 320, 260, "widget-mese"));
        assertTrue(t.toString(), t.contains("Novembre 2026"));
        // Novembre 2026: 6 settimane (dal 26 ottobre al 6 dicembre).
        assertEquals(t.toString(), 2, t.stream().filter("30"::equals).count());
        assertTrue(t.toString(), t.contains("●"));
        assertTrue(t.toString(), t.contains("●●●"));

        // Febbraio 2027 sta in 4 settimane: la griglia ne mostra 5, senza errori.
        List<String> feb = texts(inflate(MonthWidget.build(context, LocalDate.of(2027, 2, 14)), 320, 220, "widget-mese-febbraio"));
        assertTrue(feb.toString(), feb.contains("Febbraio 2027"));
    }

    @Test
    public void weekShowsSevenDaysWithEvents() {
        List<String> t = texts(inflate(WeekWidget.build(context, 170, TODAY), 320, 170, "widget-settimana"));
        assertTrue(t.toString(), t.contains("9 – 15 novembre"));
        for (String name : new String[] { "LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM" }) assertTrue(t.toString(), t.contains(name));
        assertTrue(t.toString(), t.contains("Tirocinio"));
        assertTrue(t.toString(), t.contains("Pulizia strade"));
        // Giovedì ha 4 impegni e nel widget ce ne stanno 4: nessun "+".
        assertTrue(t.toString(), t.contains("Pizza"));

        List<String> small = texts(inflate(WeekWidget.build(context, 110, TODAY), 320, 110, "widget-settimana-piccolo"));
        // Con poca altezza il titolo sparisce e restano un impegno per giorno e il conto degli altri ("+2").
        assertFalse(small.toString(), small.contains("9 – 15 novembre"));
        assertTrue(small.toString(), small.contains("Colazione"));
        assertTrue(small.toString(), small.contains("+2"));
        assertTrue(small.toString(), small.contains("+3"));

        List<String> cross = texts(inflate(WeekWidget.build(context, 170, LocalDate.of(2026, 12, 1)), 320, 170, "widget-settimana-due-mesi"));
        assertTrue(cross.toString(), cross.contains("30 nov – 6 dic"));
    }
}
