import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nikcirri.calendario',
  appName: 'Calendario',
  webDir: 'dist',
  backgroundColor: '#0E1018',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_calendario',
      iconColor: '#C6F24E',
    },
  },
};

export default config;
