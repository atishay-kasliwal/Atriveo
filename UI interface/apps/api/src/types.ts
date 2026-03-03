export type Bindings = {
  NEON_DATABASE_URL: string;
  API_SHARED_TOKEN: string;
  OWNER_DASHBOARD_PASSWORD?: string;
  OWNER_EMAIL?: string;
  OWNER_ACCESS_ONLY?: string;
  SESSION_TTL_DAYS?: string;
  APP_ENV?: string;
  SIGNUPS_ENABLED?: string;
  ALLOW_SIGNUPS?: string;
};

export type DbRow = Record<string, unknown>;

export type AuthUser = {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
};
