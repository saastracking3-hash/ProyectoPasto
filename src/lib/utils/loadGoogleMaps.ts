declare global {
  interface Window {
    google: typeof google;
    __gmapsLoading?: boolean;
    __gmapsLoaded?: boolean;
  }
}

export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.__gmapsLoaded) return Promise.resolve();
  if (window.__gmapsLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.__gmapsLoaded) { clearInterval(check); resolve(); }
      }, 100);
    });
  }
  window.__gmapsLoading = true;
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      existing.addEventListener("load", () => { window.__gmapsLoaded = true; resolve(); });
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&language=es&region=AR`;
    script.async = true;
    script.defer = true;
    script.onload = () => { window.__gmapsLoaded = true; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
