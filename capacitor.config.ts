import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pushhour.app',
  appName: 'PushUp Hourly',
  webDir: 'out',    // Next.js static export target
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#38BDF8',
      sound: 'default',
    },
  },
};

export default config;
