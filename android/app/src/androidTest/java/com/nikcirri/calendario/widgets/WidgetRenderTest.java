package com.nikcirri.calendario.widgets;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.app.Activity;
import android.app.PendingIntent;
import android.appwidget.AppWidgetHostView;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Parcel;
import android.view.PixelCopy;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ListView;
import android.widget.RemoteViews;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.nikcirri.calendario.R;
import java.io.File;
import java.io.FileOutputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
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

    /**
     * Settimana piena, per la griglia delle ore: impegni che si sovrappongono (due venerdì, tre sabato), un impegno
     * breve, uno che passa la mezzanotte (sabato 22:00 – domenica 02:00), un promemoria e tre "tutto il giorno".
     */
    private static final String BUSY =
        "{\"v\":1,\"from\":\"2026-10-26\",\"to\":\"2027-01-24\",\"days\":{" +
        "\"2026-11-09\":[{\"t\":\"Pulizia strade\",\"s\":0,\"e\":1440,\"c\":\"#7d8799\",\"k\":1}," + TIR + "]," +
        "\"2026-11-10\":[{\"t\":\"Colazione\",\"s\":420,\"e\":450,\"c\":\"#c98500\",\"k\":0}," + TIR + ",{\"t\":\"Pranzo con Sara\",\"s\":780,\"e\":840,\"c\":\"#199e70\",\"k\":0},{\"t\":\"Pagare la bolletta\",\"s\":1020,\"e\":1020,\"c\":\"#c98500\",\"k\":2}]," +
        "\"2026-11-11\":[" + TIR + ",{\"t\":\"Cena con Marco\",\"s\":1200,\"e\":1260,\"c\":\"#d55181\",\"k\":0}]," +
        "\"2026-11-12\":[" + TIR + ",{\"t\":\"Laboratorio\",\"s\":900,\"e\":1020,\"c\":\"#d95926\",\"k\":0},{\"t\":\"Calcetto\",\"s\":1080,\"e\":1140,\"c\":\"#199e70\",\"k\":0},{\"t\":\"Pizza\",\"s\":1230,\"e\":1320,\"c\":\"#d55181\",\"k\":0}]," +
        "\"2026-11-13\":[{\"t\":\"Ferie\",\"s\":0,\"e\":1440,\"c\":\"#8b6fe8\",\"k\":1},{\"t\":\"Compleanno di Marta\",\"s\":0,\"e\":1440,\"c\":\"#d55181\",\"k\":1},{\"t\":\"Mercato\",\"s\":0,\"e\":1440,\"c\":\"#2a9db0\",\"k\":1}," +
        "{\"t\":\"Riunione\",\"s\":540,\"e\":630,\"c\":\"#3987e5\",\"k\":0},{\"t\":\"Dentista\",\"s\":600,\"e\":660,\"c\":\"#d95926\",\"k\":0},{\"t\":\"Caffè\",\"s\":730,\"e\":745,\"c\":\"#c98500\",\"k\":0}]," +
        "\"2026-11-14\":[{\"t\":\"Spesa\",\"s\":590,\"e\":650,\"c\":\"#2a9db0\",\"k\":0},{\"t\":\"Palestra\",\"s\":600,\"e\":690,\"c\":\"#199e70\",\"k\":0},{\"t\":\"Chiamata\",\"s\":610,\"e\":625,\"c\":\"#d95926\",\"k\":0},{\"t\":\"Festa\",\"s\":1320,\"e\":1440,\"c\":\"#8b6fe8\",\"k\":0}]," +
        "\"2026-11-15\":[{\"t\":\"Festa\",\"s\":0,\"e\":120,\"c\":\"#8b6fe8\",\"k\":0},{\"t\":\"Pranzo dai nonni\",\"s\":750,\"e\":900,\"c\":\"#d55181\",\"k\":0}]}}";

    private Context context;

    @Before
    public void setUp() {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        WidgetStore.saveSnapshot(context, SNAPSHOT);
    }

    /**
     * Esegue un'azione sul filo principale (dove vivono le viste). Un errore lì farebbe chiudere l'app
     * di prova senza spiegazioni: qui viene raccolto e riportato alla prova, con il suo testo.
     */
    private static void onMain(Runnable action) {
        Throwable[] error = new Throwable[1];
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            try {
                action.run();
            } catch (Throwable t) {
                error[0] = t;
            }
        });
        if (error[0] != null) throw new AssertionError("Errore nel disegnare il widget: " + error[0], error[0]);
    }

    /** Costruisce davvero le viste del widget, come fa la schermata Home, e ne salva l'immagine. */
    private View inflate(RemoteViews views, int widthDp, int heightDp, String name) {
        View[] out = new View[1];
        onMain(() -> {
            View view = views.apply(context, new FrameLayout(context));
            float density = context.getResources().getDisplayMetrics().density;
            int w = Math.round(widthDp * density);
            int h = Math.round(heightDp * density);
            view.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY));
            view.layout(0, 0, w, h);
            if (name != null) save(picture(view), name);
            out[0] = view;
        });
        return out[0];
    }

    private int px(int dp) {
        return Math.round(dp * context.getResources().getDisplayMetrics().density);
    }

    private static Bitmap picture(View view) {
        Bitmap bitmap = Bitmap.createBitmap(view.getWidth(), view.getHeight(), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(0xFF0E1018);
        view.draw(canvas);
        return bitmap;
    }

    /**
     * Come `inflate`, ma dentro un vero contenitore di widget: serve per le liste, che Android riempie solo lì.
     * La lista viene portata sulla riga `firstHour` (qui non c'è una finestra, quindi non si sposta da sola).
     */
    private View inflateHosted(RemoteViews views, int widthDp, int heightDp, int firstHour, String name) {
        View[] out = new View[1];
        onMain(() -> {
            AppWidgetHostView host = new AppWidgetHostView(context);
            View view = views.apply(context, host);
            host.addView(view);
            int w = View.MeasureSpec.makeMeasureSpec(px(widthDp), View.MeasureSpec.EXACTLY);
            int h = View.MeasureSpec.makeMeasureSpec(px(heightDp), View.MeasureSpec.EXACTLY);
            host.measure(w, h);
            host.layout(0, 0, px(widthDp), px(heightDp));
            ListView list = view.findViewById(R.id.week_hours);
            if (list != null && firstHour > 0) {
                list.setSelectionFromTop(firstHour, 0);
                host.measure(w, h);
                host.layout(0, 0, px(widthDp), px(heightDp));
            }
            save(picture(host), name);
            out[0] = view;
        });
        return out[0];
    }

    /** Fa fare al widget il viaggio che fa davvero (dall'app ad Android e da lì alla schermata Home) e dice quanto pesa. */
    private static RemoteViews travel(RemoteViews views, int[] size) {
        Parcel parcel = Parcel.obtain();
        try {
            views.writeToParcel(parcel, 0);
            size[0] = parcel.dataSize();
            parcel.setDataPosition(0);
            return new RemoteViews(parcel);
        } finally {
            parcel.recycle();
        }
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
        List<String> t = texts(inflate(WeekWidget.build(context, 1, 320, 170, TODAY, NOW), 320, 170, "widget-settimana"));
        assertTrue(t.toString(), t.contains("9 – 15 novembre"));
        for (String name : new String[] { "LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM" }) assertTrue(t.toString(), t.contains(name));
        assertTrue(t.toString(), t.contains("Tirocinio"));
        assertTrue(t.toString(), t.contains("Pulizia strade"));
        // Giovedì ha 4 impegni e nel widget ce ne stanno 4: nessun "+".
        assertTrue(t.toString(), t.contains("Pizza"));

        List<String> small = texts(inflate(WeekWidget.build(context, 1, 320, 110, TODAY, NOW), 320, 110, "widget-settimana-piccolo"));
        // Con poca altezza il titolo sparisce e restano un impegno per giorno e il conto degli altri ("+2").
        assertFalse(small.toString(), small.contains("9 – 15 novembre"));
        assertTrue(small.toString(), small.contains("Colazione"));
        assertTrue(small.toString(), small.contains("+2"));
        assertTrue(small.toString(), small.contains("+3"));

        List<String> cross = texts(inflate(WeekWidget.build(context, 1, 320, 170, LocalDate.of(2026, 12, 1), NOW), 320, 170, "widget-settimana-due-mesi"));
        assertTrue(cross.toString(), cross.contains("30 nov – 6 dic"));
    }

    @Test
    public void weekStaysAsLabelsUntilTall() {
        // Appena sotto la soglia: ancora le etichette, nessuna lista.
        View labels = inflate(WeekWidget.build(context, 1, 320, WeekWidget.HOURS_FROM_DP - 1, TODAY, NOW), 320, WeekWidget.HOURS_FROM_DP - 1, "widget-settimana-alto");
        assertNull(labels.findViewById(R.id.week_hours));
        assertTrue(texts(labels).toString(), texts(labels).contains("Pizza"));
        assertFalse(WeekWidget.showsHours(WeekWidget.HOURS_FROM_DP - 1));
        assertTrue(WeekWidget.showsHours(WeekWidget.HOURS_FROM_DP));
    }

    @Test
    public void weekShowsHourGridWhenTall() {
        WidgetStore.saveSnapshot(context, BUSY);
        int[] size = new int[1];
        RemoteViews views = travel(WeekWidget.build(context, 1, 320, 400, TODAY, NOW), size);
        // Android passa i widget in messaggi di dimensione limitata: la settimana piena deve starci larga.
        assertTrue("Il widget pesa " + size[0] + " byte", size[0] < 250_000);

        View view = inflateHosted(views, 320, 400, 7, "widget-settimana-ore");
        ListView list = view.findViewById(R.id.week_hours);
        assertNotNull(list);
        assertEquals(24, list.getAdapter().getCount());
        assertEquals(7, list.getFirstVisiblePosition());
        // Le caselle aprono il loro giorno: serve il modello sulla lista e il tocco su ogni casella.
        assertTrue(list.getTag() instanceof PendingIntent);
        assertTrue(list.getChildAt(0).findViewById(R.id.hour_d3).hasOnClickListeners());

        List<String> t = texts(view);
        assertTrue(t.toString(), t.contains("9 – 15 novembre"));
        for (String name : new String[] { "LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM" }) assertTrue(t.toString(), t.contains(name));
        for (String hour : new String[] { "7", "8", "9", "10", "11", "12" }) assertTrue(t.toString(), t.contains(hour));
        assertTrue(t.toString(), t.contains("Tirocinio"));
        assertTrue(t.toString(), t.contains("Colazione"));
        assertTrue(t.toString(), t.contains("Riunione"));
        // Tutto il giorno: sopra la griglia; venerdì ne ha tre e ne mostra uno più "+2".
        assertTrue(t.toString(), t.contains("Pulizia strade"));
        assertTrue(t.toString(), t.contains("Ferie"));
        assertTrue(t.toString(), t.contains("+2"));
        assertFalse(t.toString(), t.contains("Mercato"));

        // Tutta la giornata in una sola immagine (widget altissimo), per controllare ogni ora a colpo d'occhio.
        List<String> all = texts(inflateHosted(travel(WeekWidget.build(context, 1, 320, 1100, TODAY, NOW), size), 320, 1100, 0, "widget-settimana-ore-giornata"));
        for (String title : new String[] { "Pranzo con Sara", "Pagare la bolletta", "Cena con Marco", "Laboratorio", "Calcetto", "Pizza", "Dentista", "Caffè", "Festa", "Pranzo dai nonni" }) {
            assertTrue(title + " in " + all, all.contains(title));
        }
        // Sabato mattina tre impegni insieme: colonne troppo strette per scriverci, restano solo i colori.
        assertFalse(all.toString(), all.contains("Palestra"));
        // Il tirocinio dura sei ore ma il titolo si scrive una volta sola per blocco (quattro giorni, quattro titoli).
        assertEquals(all.toString(), 4, all.stream().filter("Tirocinio"::equals).count());

        // Più stretto e con i dati di tutti i giorni: non deve rompersi niente.
        inflateHosted(travel(WeekWidget.build(context, 1, 250, 300, TODAY, 23 * 60 + 50), size), 250, 300, 19, "widget-settimana-ore-stretto");
    }

    @Test
    public void weekHoursFollowNow() {
        WidgetStore.saveSnapshot(context, BUSY);
        // Alto 400 con due righe di "tutto il giorno": nella lista stanno 6 ore intere.
        // Alle 13:04 la riga da raggiungere è quella delle 17: in cima resta l'ora prima di adesso.
        assertEquals(17, WeekHours.scrollRow(NOW, 6));
        assertEquals(23, WeekHours.scrollRow(22 * 60, 6));
        assertEquals(1, WeekHours.scrollRow(10, 3));

        try (ActivityScenario<WidgetTestActivity> scenario = ActivityScenario.launch(WidgetTestActivity.class)) {
            Activity[] activity = new Activity[1];
            scenario.onActivity(a -> activity[0] = a);
            AppWidgetHostView[] host = new AppWidgetHostView[1];
            onMain(() -> {
                // Come sulla schermata Home: il contenitore riceve il widget e lo disegna in una finestra vera.
                host[0] = new AppWidgetHostView(activity[0]);
                activity[0].addContentView(host[0], new FrameLayout.LayoutParams(px(320), px(400)));
                host[0].updateAppWidget(WeekWidget.build(activity[0], 1, 320, 400, TODAY, NOW));
            });
            int[] first = settle(host[0]);
            onMain(() -> save(picture(host[0]), "widget-settimana-ore-adesso"));
            // Appena creato, il widget si porta da solo su "adesso": le 13 si vedono e sopra c'è l'ora prima.
            assertTrue("Prima riga visibile: " + first[0] + ", ultima: " + first[1], first[0] >= 11 && first[0] <= 12 && first[1] >= 17);

            // Tre ore dopo (un aggiornamento qualsiasi): la lista segue l'ora.
            onMain(() -> host[0].updateAppWidget(WeekWidget.build(activity[0], 1, 320, 400, TODAY, NOW + 180)));
            int[] later = settle(host[0]);
            onMain(() -> save(picture(host[0]), "widget-settimana-ore-dopo"));
            assertTrue("Prima riga visibile: " + later[0] + ", ultima: " + later[1], later[0] >= 14 && later[0] <= 15 && later[1] >= 20);

            // Stessa ora, dati cambiati: la lista resta dov'è.
            onMain(() -> host[0].updateAppWidget(WeekWidget.build(activity[0], 1, 320, 400, TODAY, NOW + 185)));
            int[] same = settle(host[0]);
            assertEquals(later[0], same[0]);
        }
    }

    /**
     * Alcune schermate Home (per esempio quella dei Samsung) disegnano i widget un po' rimpiccioliti: i bordi
     * delle righe cadono a metà pixel e tra un pezzo e l'altro di un blocco lungo può comparire una riga sottile.
     * Qui il widget viene rimpicciolito apposta e si controlla, sui pixel veri dello schermo, che il blocco
     * del tirocinio (lunedì, 8:30 – 14:30) sia di un colore solo dalle 10 alle 13 passate.
     */
    @Test
    public void weekHoursBlocksAreSeamlessWhenScaled() throws Exception {
        WidgetStore.saveSnapshot(context, BUSY);
        try (ActivityScenario<WidgetTestActivity> scenario = ActivityScenario.launch(WidgetTestActivity.class)) {
            Activity[] activity = new Activity[1];
            scenario.onActivity(a -> activity[0] = a);
            AppWidgetHostView[] host = new AppWidgetHostView[1];
            onMain(() -> {
                host[0] = new AppWidgetHostView(activity[0]);
                activity[0].addContentView(host[0], new FrameLayout.LayoutParams(px(320), px(400)));
                host[0].setPivotX(0f);
                host[0].setPivotY(0f);
                host[0].setScaleX(0.83f);
                host[0].setScaleY(0.83f);
                host[0].updateAppWidget(WeekWidget.build(activity[0], 1, 320, 400, TODAY, 10 * 60));
            });
            int[] rows = settle(host[0]);
            assertTrue("Righe visibili: " + rows[0] + " – " + rows[1], rows[0] <= 10 && rows[1] >= 13);

            // Colonna di pixel dentro il blocco di lunedì, dalle 10 e qualcosa alle 13 e qualcosa: attraversa tre cambi d'ora.
            int[] line = new int[3];
            onMain(() -> {
                ListView list = host[0].findViewById(R.id.week_hours);
                View from = list.getChildAt(10 - list.getFirstVisiblePosition()).findViewById(R.id.hour_d0);
                View to = list.getChildAt(13 - list.getFirstVisiblePosition()).findViewById(R.id.hour_d0);
                int[] a = new int[2];
                int[] b = new int[2];
                from.getLocationInWindow(a);
                to.getLocationInWindow(b);
                line[0] = a[0] + Math.round(from.getWidth() * 0.83f * 0.6f);
                line[1] = a[1] + 4;
                line[2] = b[1] + 8;
            });
            Bitmap shot = screenshot(activity[0]);
            save(shot, "widget-settimana-ore-rimpicciolito");
            int expected = WidgetUi.chipColor(0xFF3987E5);
            int worst = 0;
            int worstY = -1;
            for (int y = line[1]; y <= line[2]; y++) {
                int c = shot.getPixel(line[0], y);
                int diff = Math.max(Math.abs(Color.red(c) - Color.red(expected)), Math.max(Math.abs(Color.green(c) - Color.green(expected)), Math.abs(Color.blue(c) - Color.blue(expected))));
                if (diff > worst) {
                    worst = diff;
                    worstY = y;
                }
            }
            assertTrue("Riga visibile dentro il blocco: differenza di colore " + worst + " alla riga di pixel " + worstY + " (da " + line[1] + " a " + line[2] + ")", worst <= 6);
        }
    }

    /** I pixel veri della finestra, come li vede chi guarda lo schermo. */
    private static Bitmap screenshot(Activity activity) throws InterruptedException {
        View decor = activity.getWindow().getDecorView();
        Bitmap bitmap = Bitmap.createBitmap(decor.getWidth(), decor.getHeight(), Bitmap.Config.ARGB_8888);
        HandlerThread thread = new HandlerThread("foto");
        thread.start();
        CountDownLatch done = new CountDownLatch(1);
        int[] result = { -1 };
        PixelCopy.request(
            activity.getWindow(),
            bitmap,
            r -> {
                result[0] = r;
                done.countDown();
            },
            new Handler(thread.getLooper())
        );
        boolean finished = done.await(10, TimeUnit.SECONDS);
        thread.quitSafely();
        assertTrue("La foto dello schermo non è arrivata", finished);
        assertEquals(PixelCopy.SUCCESS, result[0]);
        return bitmap;
    }

    /** Aspetta che la lista del widget sia disegnata e ferma; restituisce prima e ultima riga visibile. */
    private int[] settle(AppWidgetHostView host) {
        int[] now = { -1, -1, 0 };
        int[] before = { -2, -2, 0 };
        int still = 0;
        for (int i = 0; i < 60 && still < 4; i++) {
            try {
                Thread.sleep(250);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            onMain(() -> {
                ListView list = host.findViewById(R.id.week_hours);
                boolean ready = list != null && list.getChildCount() > 0;
                now[0] = ready ? list.getFirstVisiblePosition() : -1;
                now[1] = ready ? list.getLastVisiblePosition() : -1;
                now[2] = ready ? list.getChildAt(0).getTop() : 0;
            });
            still = now[0] >= 0 && now[0] == before[0] && now[1] == before[1] && now[2] == before[2] ? still + 1 : 0;
            System.arraycopy(now, 0, before, 0, 3);
        }
        assertTrue("La lista delle ore non si è disegnata: " + texts(host), now[0] >= 0);
        return now;
    }

    @Test
    public void weekHoursRowsForOlderAndroid() {
        WidgetStore.saveSnapshot(context, BUSY);
        // Fino ad Android 11 le righe le fornisce un servizio: qui si controlla che le prepari tutte e che si disegnino.
        WeekHoursService.Factory factory = new WeekHoursService.Factory(context, 1);
        factory.onCreate();
        assertEquals(0, factory.getCount());
        factory.onDataSetChanged();
        assertEquals(24, factory.getCount());
        assertTrue(factory.hasStableIds());
        assertNull(factory.getViewAt(24));
        int[] size = new int[1];
        for (int hour = 0; hour < 24; hour++) {
            RemoteViews row = travel(factory.getViewAt(hour), size);
            String label = String.valueOf(hour);
            List<String> t = texts(inflate(row, 320, WeekHours.HOUR_DP, null));
            assertTrue(t.toString(), t.contains(label));
        }
        // Il widget che usa il servizio si costruisce e regge il viaggio verso la schermata Home.
        assertNotNull(travel(WeekHours.build(context, 1, 320, 400, TODAY, NOW, true), size));
        factory.onDestroy();
        assertEquals(0, factory.getCount());
    }
}
