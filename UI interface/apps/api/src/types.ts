export type Bindings = {
  NEON_DATABASE_URL: string;
  API_SHARED_TOKEN: string;
  MEDIA_BUCKET?: R2Bucket;
  MEDIA_URL_SIGNING_SECRET?: string;
  MEDIA_PUBLIC_BASE_URL?: string;
  OWNER_DASHBOARD_PASSWORD?: string;
  OWNER_EMAIL?: string;
  OWNER_ACCESS_ONLY?: string;
  SESSION_TTL_DAYS?: string;
  APP_ENV?: string;
  SIGNUPS_ENABLED?: string;
  ALLOW_SIGNUPS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_IDS?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  RESET_PASSWORD_URL_BASE?: string;
  PASSWORD_RESET_TOKEN_TTL_MINUTES?: string;
};

export type DbRow = Record<string, unknown>;

export type AuthUser = {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
};
