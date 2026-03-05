declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    __atriveoGaInitialized?: boolean;
  }
}

export type AnalyticsParams = Record<string, unknown>;
type SafeAnalyticsValue = string | number | boolean | null;
type SafeAnalyticsParams = Record<string, SafeAnalyticsValue>;

export type UserType = "guest" | "logged_in";
export type DeviceType = "mobile" | "tablet" | "desktop";

export type AnalyticsContext = {
  user_type: UserType;
  plan_type: string;
  device_type?: DeviceType;
  referrer_source?: string;
  page_section?: string;
};

export type AnalyticsProvider = {
  name: string;
  init: () => void;
  trackEvent: (eventName: string, params: SafeAnalyticsParams) => void;
  trackPageView?: (path: string, title: string, location: string, params: SafeAnalyticsParams) => void;
  setContext?: (context: AnalyticsContext) => void;
};

type QueuedEvent =
  | { type: "event"; eventName: string; params: AnalyticsParams }
  | { type: "page_view"; path: string; title: string; location: string };

const GA_MEASUREMENT_ID = "G-D1XC74NKPG";
const DEBUG_MODE_STORAGE_KEY = "atriveo_analytics_debug";
const MILESTONE_STORAGE_PREFIX = "atriveo_analytics_milestone";
const EVENT_FLUSH_INTERVAL_MS = 120;
const MAX_QUEUE_SIZE = 200;

const BLOCKED_PARAM_KEYS = new Set([
  "email",
  "first_name",
  "last_name",
  "full_name",
  "name",
  "company",
  "role",
  "notes",
  "password",
  "token",
  "job_link",
  "job_application_id",
]);

const providers: AnalyticsProvider[] = [];
const queue: QueuedEvent[] = [];

let analyticsInitialized = false;
let gaProviderRegistered = false;
let flushTimer: number | null = null;
let cachedReferrerSource: string | null = null;

const sessionContext: AnalyticsContext = {
  user_type: "guest",
  plan_type: "free",
};

function normalizeSnakeCase(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

function normalizeEventName(eventName: string): string {
  const normalized = normalizeSnakeCase(eventName);
  return normalized || "unknown_event";
}

function toSafeValue(value: unknown): SafeAnalyticsValue | undefined {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const cleaned = value.trim();
    if (!cleaned) return undefined;
    return cleaned.slice(0, 120);
  }
  return undefined;
}

function sanitizeParams(params: AnalyticsParams): SafeAnalyticsParams {
  const safe: SafeAnalyticsParams = {};
  for (const [rawKey, rawValue] of Object.entries(params)) {
    const key = normalizeSnakeCase(rawKey);
    if (!key || BLOCKED_PARAM_KEYS.has(key)) continue;
    const safeValue = toSafeValue(rawValue);
    if (safeValue === undefined) continue;
    safe[key] = safeValue;
  }
  return safe;
}

function detectDeviceType(): DeviceType {
  if (typeof window === "undefined") return "desktop";
  const width = window.innerWidth || 1280;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function getReferrerSource(): string {
  if (cachedReferrerSource) return cachedReferrerSource;
  if (typeof document === "undefined") return "direct";
  const rawReferrer = String(document.referrer || "").trim();
  if (!rawReferrer) {
    cachedReferrerSource = "direct";
    return cachedReferrerSource;
  }
  try {
    const host = new URL(rawReferrer).hostname.replace(/^www\./, "");
    cachedReferrerSource = host || "direct";
    return cachedReferrerSource;
  } catch {
    cachedReferrerSource = "unknown";
    return cachedReferrerSource;
  }
}

function getCurrentPageSection(): string {
  if (typeof window === "undefined") return "unknown";
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (!parts.length) return "landing";
  if (parts[0] === "dashboard" || parts[0] === "app") {
    return parts[1] || "dashboard";
  }
  return parts[0];
}

function isDebugModeEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEBUG_MODE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function ensureGtagShim() {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer.push(args);
    };
  }
}

function createGa4Provider(measurementId: string): AnalyticsProvider {
  let configured = false;
  return {
    name: "ga4",
    init() {
      if (typeof window === "undefined") return;
      ensureGtagShim();
      if (configured) return;
      if (window.__atriveoGaInitialized) {
        configured = true;
        return;
      }
      window.gtag?.("js", new Date());
      window.gtag?.("config", measurementId, {
        send_page_view: false,
        debug_mode: isDebugModeEnabled(),
      });
      window.__atriveoGaInitialized = true;
      configured = true;
    },
    trackEvent(eventName, params) {
      if (typeof window === "undefined") return;
      ensureGtagShim();
      const payload = isDebugModeEnabled() ? { ...params, debug_mode: true } : params;
      window.gtag?.("event", eventName, payload);
    },
    trackPageView(path, title, location, params) {
      if (typeof window === "undefined") return;
      ensureGtagShim();
      const payload = isDebugModeEnabled()
        ? { ...params, page_path: path, page_title: title, page_location: location, debug_mode: true }
        : { ...params, page_path: path, page_title: title, page_location: location };
      window.gtag?.("event", "page_view", payload);
    },
    setContext(context) {
      if (typeof window === "undefined") return;
      ensureGtagShim();
      window.gtag?.("set", "user_properties", {
        user_type: context.user_type,
        plan_type: context.plan_type,
        device_type: context.device_type ?? detectDeviceType(),
      });
    },
  };
}

function buildContext(overrides: AnalyticsParams = {}): SafeAnalyticsParams {
  const merged: AnalyticsParams = {
    user_type: sessionContext.user_type,
    plan_type: sessionContext.plan_type,
    device_type: sessionContext.device_type ?? detectDeviceType(),
    referrer_source: sessionContext.referrer_source ?? getReferrerSource(),
    page_section: sessionContext.page_section ?? getCurrentPageSection(),
    ...overrides,
  };
  return sanitizeParams(merged);
}

function dispatchEventToProviders(eventName: string, params: AnalyticsParams = {}) {
  const safeEventName = normalizeEventName(eventName);
  const payload = buildContext(params);
  providers.forEach((provider) => provider.trackEvent(safeEventName, payload));
}

function dispatchPageViewToProviders(path: string, title: string, location: string) {
  const payload = buildContext();
  providers.forEach((provider) => {
    if (provider.trackPageView) {
      provider.trackPageView(path, title, location, payload);
      return;
    }
    provider.trackEvent("page_view", {
      ...payload,
      page_path: path,
      page_title: title,
      page_location: location,
    });
  });
}

function flushQueue() {
  if (!analyticsInitialized || queue.length === 0) return;
  const pending = queue.splice(0, queue.length);
  pending.forEach((item) => {
    if (item.type === "event") {
      dispatchEventToProviders(item.eventName, item.params);
      return;
    }
    dispatchPageViewToProviders(item.path, item.title, item.location);
  });
}

function scheduleFlush() {
  if (typeof window === "undefined" || flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flushQueue();
  }, EVENT_FLUSH_INTERVAL_MS);
}

function enqueue(item: QueuedEvent) {
  if (queue.length >= MAX_QUEUE_SIZE) queue.shift();
  queue.push(item);
  scheduleFlush();
}

export function registerAnalyticsProvider(provider: AnalyticsProvider) {
  if (providers.some((existing) => existing.name === provider.name)) return;
  providers.push(provider);
  if (analyticsInitialized) {
    provider.init();
    provider.setContext?.(sessionContext);
  }
}

export function initAnalytics() {
  if (typeof window === "undefined") return false;

  if (!gaProviderRegistered && GA_MEASUREMENT_ID) {
    registerAnalyticsProvider(createGa4Provider(GA_MEASUREMENT_ID));
    gaProviderRegistered = true;
  }

  if (analyticsInitialized) return false;
  analyticsInitialized = true;

  providers.forEach((provider) => provider.init());
  providers.forEach((provider) => provider.setContext?.(sessionContext));
  flushQueue();
  return true;
}

export function setSessionContext(partial: Partial<AnalyticsContext>) {
  if (partial.user_type === "guest" || partial.user_type === "logged_in") {
    sessionContext.user_type = partial.user_type;
  }
  if (typeof partial.plan_type === "string" && partial.plan_type.trim()) {
    sessionContext.plan_type = partial.plan_type.trim().slice(0, 32);
  }
  if (partial.device_type === "mobile" || partial.device_type === "tablet" || partial.device_type === "desktop") {
    sessionContext.device_type = partial.device_type;
  }
  if (typeof partial.referrer_source === "string" && partial.referrer_source.trim()) {
    sessionContext.referrer_source = partial.referrer_source.trim().slice(0, 64);
  }
  if (typeof partial.page_section === "string" && partial.page_section.trim()) {
    sessionContext.page_section = partial.page_section.trim().slice(0, 64);
  }
  if (analyticsInitialized) {
    providers.forEach((provider) => provider.setContext?.(sessionContext));
  }
}

export function trackEvent(eventName: string, params: AnalyticsParams = {}) {
  enqueue({
    type: "event",
    eventName: normalizeEventName(eventName),
    params,
  });
  if (analyticsInitialized) scheduleFlush();
}

export function trackPageView(path: string, title = typeof document !== "undefined" ? document.title : "") {
  if (typeof window === "undefined") return;
  const safePath = path || window.location.pathname || "/";
  enqueue({
    type: "page_view",
    path: safePath,
    title,
    location: window.location.href,
  });
  if (analyticsInitialized) scheduleFlush();
}

type MilestoneOptions = {
  scope?: string;
};

export function trackMilestoneOnce(eventName: string, params: AnalyticsParams = {}, options: MilestoneOptions = {}): boolean {
  if (typeof window === "undefined") {
    trackEvent(eventName, params);
    return true;
  }

  const scope = normalizeSnakeCase(options.scope || "global");
  const event = normalizeEventName(eventName);
  const storageKey = `${MILESTONE_STORAGE_PREFIX}:${scope}:${event}`;

  try {
    if (window.localStorage.getItem(storageKey) === "1") return false;
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // Ignore storage failures; still emit the event.
  }

  trackEvent(eventName, params);
  return true;
}
