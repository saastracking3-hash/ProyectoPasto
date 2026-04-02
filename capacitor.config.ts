import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.thegreenside.app",
  appName: "The Green Side",
  // Apunta al sitio live en Vercel — no necesita bundlear el build de Next.js
  server: {
    url: "https://proyecto-pasto.vercel.app",
    cleartext: false,
  },
  android: {
    backgroundColor: "#ffffff",
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#2D6A4F",
      showSpinner: false,
    },
  },
};

export default config;
