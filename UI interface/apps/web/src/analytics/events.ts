import { trackEvent, trackMilestoneOnce, type AnalyticsParams } from "./analytics";

/**
 * Central catalog of analytics events.
 * Keep all names lowercase snake_case for GA4 compatibility and consistency.
 */
export const ANALYTICS_EVENTS = {
  landing_page_view: "landing_page_view",
  signup_started: "signup_started",
  signup_completed: "signup_completed",
  login_completed: "login_completed",
  dashboard_opened: "dashboard_opened",
  add_application_clicked: "add_application_clicked",
  application_created: "application_created",
  application_deleted: "application_deleted",
  application_updated: "application_updated",
  share_data_enabled: "share_data_enabled",
  share_data_disabled: "share_data_disabled",
  privacy_settings_opened: "privacy_settings_opened",
  chrome_extension_install_clicked: "chrome_extension_install_clicked",
  chrome_extension_store_clicked: "chrome_extension_store_clicked",
  feedback_submitted: "feedback_submitted",
  filter_used: "filter_used",
  search_used: "search_used",
  sort_changed: "sort_changed",
  export_data_clicked: "export_data_clicked",
  first_application_created: "first_application_created",
  first_share_enabled: "first_share_enabled",
  first_dashboard_visit: "first_dashboard_visit",
  form_submission_error: "form_submission_error",
  api_request_failed: "api_request_failed",
  validation_error: "validation_error",
  slow_dashboard_load: "slow_dashboard_load",
  slow_application_create: "slow_application_create",
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export const CONVERSION_EVENTS = [
  ANALYTICS_EVENTS.signup_completed,
  ANALYTICS_EVENTS.application_created,
  ANALYTICS_EVENTS.chrome_extension_install_clicked,
  ANALYTICS_EVENTS.chrome_extension_store_clicked,
] as const;

export type ProductEventName =
  | typeof ANALYTICS_EVENTS.signup_started
  | typeof ANALYTICS_EVENTS.signup_completed
  | typeof ANALYTICS_EVENTS.login_completed
  | typeof ANALYTICS_EVENTS.dashboard_opened
  | typeof ANALYTICS_EVENTS.add_application_clicked
  | typeof ANALYTICS_EVENTS.application_created
  | typeof ANALYTICS_EVENTS.application_deleted
  | typeof ANALYTICS_EVENTS.application_updated
  | typeof ANALYTICS_EVENTS.share_data_enabled
  | typeof ANALYTICS_EVENTS.share_data_disabled
  | typeof ANALYTICS_EVENTS.privacy_settings_opened
  | typeof ANALYTICS_EVENTS.chrome_extension_install_clicked
  | typeof ANALYTICS_EVENTS.chrome_extension_store_clicked
  | typeof ANALYTICS_EVENTS.feedback_submitted;

export type FeatureEventName =
  | typeof ANALYTICS_EVENTS.filter_used
  | typeof ANALYTICS_EVENTS.search_used
  | typeof ANALYTICS_EVENTS.sort_changed
  | typeof ANALYTICS_EVENTS.export_data_clicked;

export type LifecycleMilestoneEventName =
  | typeof ANALYTICS_EVENTS.first_application_created
  | typeof ANALYTICS_EVENTS.first_share_enabled
  | typeof ANALYTICS_EVENTS.first_dashboard_visit;

export type ErrorEventName =
  | typeof ANALYTICS_EVENTS.form_submission_error
  | typeof ANALYTICS_EVENTS.api_request_failed
  | typeof ANALYTICS_EVENTS.validation_error;

export type PerformanceEventName =
  | typeof ANALYTICS_EVENTS.slow_dashboard_load
  | typeof ANALYTICS_EVENTS.slow_application_create;

export const FUNNEL_STEPS = [
  ANALYTICS_EVENTS.landing_page_view,
  ANALYTICS_EVENTS.signup_started,
  ANALYTICS_EVENTS.signup_completed,
  ANALYTICS_EVENTS.dashboard_opened,
  ANALYTICS_EVENTS.add_application_clicked,
  ANALYTICS_EVENTS.application_created,
  ANALYTICS_EVENTS.share_data_enabled,
] as const;

export type FunnelStepName = (typeof FUNNEL_STEPS)[number];

export function trackProductEvent(eventName: ProductEventName, parameters: AnalyticsParams = {}) {
  trackEvent(eventName, parameters);
}

export function trackFeatureEvent(eventName: FeatureEventName, parameters: AnalyticsParams = {}) {
  trackEvent(eventName, parameters);
}

export function trackFunnelStep(step: FunnelStepName, parameters: AnalyticsParams = {}) {
  trackEvent(step, parameters);
}

export function trackLifecycleMilestone(eventName: LifecycleMilestoneEventName, parameters: AnalyticsParams = {}) {
  trackMilestoneOnce(eventName, parameters);
}

export function trackErrorEvent(
  eventName: ErrorEventName,
  parameters: AnalyticsParams & { error_type: string; component_name: string },
) {
  trackEvent(eventName, parameters);
}

export function trackPerformanceEvent(
  eventName: PerformanceEventName,
  durationMs: number,
  parameters: AnalyticsParams = {},
) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  trackEvent(eventName, {
    ...parameters,
    duration_ms: Math.round(durationMs),
  });
}
