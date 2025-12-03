import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.almasa.erp',
  appName: 'ALMASA ERP',
  webDir: 'dist',
  server: {
    url: 'https://erp.almasa.com.mx',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      // iOS specific
      iosSpinnerStyle: 'small',
      // Android specific  
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP'
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#ffffff'
    }
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'ALMASA ERP'
  }
};

export default config;
