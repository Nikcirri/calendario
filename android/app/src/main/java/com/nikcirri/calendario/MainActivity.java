package com.nikcirri.calendario;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.nikcirri.calendario.widgets.WidgetsPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin dell'app (non da npm): aggiornamenti dentro l'app e widget della schermata Home.
        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(WidgetsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
