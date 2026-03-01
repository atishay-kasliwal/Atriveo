declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID || "").trim();
const GA_ALLOWED_HOSTS = String(import.meta.env.VITE_GA_ALLOWED_HOSTS || "")
  .split(",")
  .map((v: string) => v.trim().toLowerCase())
  .filter(Boolean);

let initialized = false;

function isHostAllowed() {
  if (GA_ALLOWED_HOSTS.length === 0) return true;
  const host = window.location.hostname.toLowerCase();
  return GA_ALLOWED_HOSTS.includes(host);
}

function isEnabled() {
  return Boolean(GA_MEASUREMENT_ID) && isHostAllowed();
}

export function initAnalytics() {
  if (initialized || !isEnabled()) return false;
  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });

  return true;
}

export function trackPageView(path: string) {
  if (!initialized || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: document.title,
    page_location: window.location.href,
  });
}

