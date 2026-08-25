const STORAGE_KEYS = {
  JOBS_BY_URL: "jobsByUrl",
  LATEST_JOB: "latestJob",
  PREPARED_PAYLOAD: "preparedPayload",
  LAST_UPDATED: "lastUpdated",
  AUTH_SESSION: "authSession",
  API_BASE_URL: "apiBaseUrl"
};

const DEFAULT_API_BASE_URL = "https://job-tracker-api.katishay.workers.dev";
const EXTENSION_CONTRACT = {
  version: "v1",
  source: "atriveo-job-assistant",
  submitPath: "/api/extension/applications"
};
const WEB_LOGIN_URL = "https://tracker.atriveo.com/";
const WEB_SESSION_KEY = "dashboard_auth_session";
const WEB_TAB_PATTERNS = [
  "https://tracker.atriveo.com/*"
];
const LEGACY_WEB_TAB_PATTERNS = [
  "https://www.atriveo.com/*",
  "https://atriveo.com/*"
];
const DASHBOARD_SIGNAL_MESSAGE_TYPE = "ATRIVEO_JOB_ADDED";
const DASHBOARD_REFRESH_EVENT_NAME = "dashboard-refresh";
const PLATFORM_EXTRACTOR_SCRIPTS = {
  workday: "content-scripts/workday.js",
  greenhouse: "content-scripts/greenhouse.js",
  lever: "content-scripts/lever.js",
  applytojob: "content-scripts/applytojob.js",
  ashby: "content-scripts/ashby.js",
  njoyn: "content-scripts/njoyn.js",
  linkedin: "content-scripts/linkedin.js",
  amazonjobs: "content-scripts/amazon-jobs.js",
  ultipro: "content-scripts/ultipro.js",
  smartrecruiters: "content-scripts/generic-ats.js",
  icims: "content-scripts/generic-ats.js",
  jobvite: "content-scripts/generic-ats.js",
  bamboohr: "content-scripts/generic-ats.js",
  jazzhr: "content-scripts/generic-ats.js",
  taleo: "content-scripts/generic-ats.js",
  successfactors: "content-scripts/generic-ats.js",
  adp: "content-scripts/generic-ats.js",
  paylocity: "content-scripts/generic-ats.js",
  teamtailor: "content-scripts/generic-ats.js",
  recruitee: "content-scripts/generic-ats.js",
  workable: "content-scripts/generic-ats.js",
  jobscore: "content-scripts/generic-ats.js",
  clearcompany: "content-scripts/generic-ats.js",
  avature: "content-scripts/generic-ats.js",
  jobright: "content-scripts/jobright.js",
  genericcareer: "content-scripts/generic-career.js"
};
const injectedExtractorByTabId = new Map();
const asText = (value) => {
  const text = String(value || "").trim();
  return text === "-" ? "" : text;
};

const getLocalISODate = (date = new Date()) => {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
};

const inferAtsPlatformFromUrl = (url = "") => {
  const source = asText(url).toLowerCase();
  if (!source) return "";

  const platformMatchers = [
    { token: "myworkdayjobs.com", platform: "workday" },
    { token: "greenhouse.io", platform: "greenhouse" },
    { token: "lever.co", platform: "lever" },
    { token: "applytojob.com", platform: "applytojob" },
    { token: "ashbyhq.com", platform: "ashby" },
    { token: "smartrecruiters.com", platform: "smartrecruiters" },
    { token: "icims.com", platform: "icims" },
    { token: "jobvite.com", platform: "jobvite" },
    { token: "bamboohr.com", platform: "bamboohr" },
    { token: "jazzhr.com", platform: "jazzhr" },
    { token: "taleo.net", platform: "taleo" },
    { token: "successfactors.com", platform: "successfactors" },
    { token: "jobs.sap.com", platform: "successfactors" },
    { token: "adp.com", platform: "adp" },
    { token: "paylocity.com", platform: "paylocity" },
    { token: "teamtailor.com", platform: "teamtailor" },
    { token: "recruitee.com", platform: "recruitee" },
    { token: "workable.com", platform: "workable" },
    { token: "jobscore.com", platform: "jobscore" },
    { token: "clearcompany.com", platform: "clearcompany" },
    { token: "njoyn.com", platform: "njoyn" },
    { token: "linkedin.com", platform: "linkedin" },
    { token: "avature.net", platform: "avature" },
    { token: "amazon.jobs", platform: "amazonjobs" },
    { token: "ultipro.com", platform: "ultipro" }
  ];

  for (const matcher of platformMatchers) {
    if (source.includes(matcher.token)) return matcher.platform;
  }

  const genericCareerHint =
    /\b(careers?|jobs?|job-details?|positions?|openings?|opportunities|requisition|vacanc(?:y|ies)|apply)\b/i.test(
      source
    ) ||
    /(?:jobid|job_id|gh_jid|opening|requisition|req_id)=/i.test(source);

  if (genericCareerHint) return "genericcareer";

  return "";
};

const getExtractorScriptForPlatform = (platform = "") =>
  PLATFORM_EXTRACTOR_SCRIPTS[asText(platform).toLowerCase()] || "";

const ensurePlatformExtractorForTab = async (tabId, platform = "") => {
  if (typeof tabId !== "number") return { ensured: false };

  const normalizedPlatform = asText(platform).toLowerCase();
  const scriptFile = getExtractorScriptForPlatform(normalizedPlatform);
  if (!scriptFile) return { ensured: false };

  const alreadyInjectedForTab = injectedExtractorByTabId.get(tabId);
  if (alreadyInjectedForTab === normalizedPlatform) {
    return { ensured: true, platform: normalizedPlatform, scriptFile };
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: [scriptFile]
  });

  injectedExtractorByTabId.set(tabId, normalizedPlatform);
  return { ensured: true, platform: normalizedPlatform, scriptFile };
};

chrome.tabs.onRemoved.addListener((tabId) => {
  injectedExtractorByTabId.delete(tabId);
});

const normalizeApiBaseUrl = (value = "") =>
  asText(value)
    .replace(/\/+$/g, "")
    .replace(/\/api$/i, "");

const toTitleCase = (key = "") =>
  String(key || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeKeywordMatching = (value = "") => {
  const raw = asText(value).toLowerCase();
  if (raw === "strong") return "Strong";
  if (raw === "weak" || raw === "week") return "Weak";
  return "Medium";
};

const normalizeReferralStatus = (value = "") => {
  const raw = asText(value).toLowerCase();
  if (raw === "requested") return "Requested";
  if (raw === "yes") return "Yes";
  return "No";
};

const isValidHttpUrl = (value = "") => {
  const raw = asText(value);
  if (!raw) return false;

  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

const getApiBaseUrl = async () => {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.API_BASE_URL]);
  return normalizeApiBaseUrl(stored[STORAGE_KEYS.API_BASE_URL]) || normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
};

const getApiBaseCandidates = async () => {
  const primary = await getApiBaseUrl();
  const fallback = normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
  if (primary && primary !== fallback) return [primary, fallback];
  return [fallback];
};

const getAuthSession = async () => {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.AUTH_SESSION]);
  const session = stored[STORAGE_KEYS.AUTH_SESSION] || null;
  if (!session?.token) return null;
  return session;
};

const setAuthSession = async (session) => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.AUTH_SESSION]: session
  });
};

const clearAuthSession = async () => {
  await chrome.storage.local.remove([STORAGE_KEYS.AUTH_SESSION]);
};

const parseApiErrorResponse = async (response) => {
  const raw = await response.text();
  let payload = null;

  try {
    payload = JSON.parse(raw);
  } catch {
    payload = null;
  }

  const message =
    (typeof payload?.error === "string" && payload.error) ||
    (typeof payload?.message === "string" && payload.message) ||
    raw ||
    `HTTP ${response.status}`;

  return {
    message,
    code: typeof payload?.code === "string" ? payload.code : "",
    payload
  };
};

const apiRequest = async (path, options = {}) => {
  const method = options.method || "GET";
  const token = asText(options.token);

  const headers = {
    "Content-Type": "application/json",
    ...(options.skipAuth || !token ? {} : { Authorization: `Bearer ${token}` })
  };

  const baseCandidates = await getApiBaseCandidates();
  let lastError = null;

  for (let index = 0; index < baseCandidates.length; index += 1) {
    const baseUrl = baseCandidates[index];
    const isLastCandidate = index === baseCandidates.length - 1;
    let response;

    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });
    } catch (networkError) {
      lastError = networkError instanceof Error ? networkError : new Error("Network request failed.");
      if (isLastCandidate) throw lastError;
      continue;
    }

    if (!response.ok) {
      const parsedError = await parseApiErrorResponse(response);
      const error = new Error(parsedError.message);
      error.status = response.status;
      error.code = parsedError.code;
      error.payload = parsedError.payload;
      lastError = error;

      // Retry against known-good default API when custom/stale base returns 404.
      if (!isLastCandidate && Number(response.status) === 404) {
        continue;
      }

      throw error;
    }

    if (baseUrl !== baseCandidates[0]) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.API_BASE_URL]: baseUrl
      });
    }

    const text = await response.text();
    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  throw lastError || new Error("API request failed.");
};

const validateSession = async () => {
  const session = await getAuthSession();
  if (!session?.token) {
    return { authenticated: false, user: null };
  }

  try {
    const me = await apiRequest("/api/auth/me", { token: session.token });
    const user = me?.user || session.user || null;
    const normalizedSession = {
      token: session.token,
      user,
      updated_at: new Date().toISOString()
    };
    await setAuthSession(normalizedSession);
    return { authenticated: true, user };
  } catch (error) {
    if (Number(error?.status) === 401) {
      await clearAuthSession();
    }
    return { authenticated: false, user: null, error: error.message || "Session check failed." };
  }
};

const openLoginPage = async () => {
  const existingTabs = await chrome.tabs.query({ url: WEB_TAB_PATTERNS });
  if (existingTabs.length > 0) {
    const tab = existingTabs[0];
    if (typeof tab.id === "number") {
      await chrome.tabs.update(tab.id, { active: true });
    }
    return tab;
  }

  return chrome.tabs.create({ url: WEB_LOGIN_URL, active: true });
};

const notifyDashboardTabsJobAdded = async () => {
  const tabs = await chrome.tabs.query({ url: WEB_TAB_PATTERNS });
  const notifyTasks = tabs
    .filter((tab) => typeof tab?.id === "number")
    .map(
      (tab) =>
        new Promise((resolve) => {
          chrome.tabs.sendMessage(
            tab.id,
            {
              type: DASHBOARD_SIGNAL_MESSAGE_TYPE,
              event: DASHBOARD_REFRESH_EVENT_NAME
            },
            () => {
              // Ignore errors when Atriveo dashboard content script is not ready in a tab.
              void chrome.runtime.lastError;
              resolve(null);
            }
          );
        })
    );

  await Promise.all(notifyTasks);
};

const readSessionFromTab = async (tabId) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (storageKeys) => {
      try {
        for (const storageKey of storageKeys || []) {
          const raw = window.localStorage.getItem(storageKey);
          if (!raw) continue;

          const parsed = JSON.parse(raw);
          if (!parsed?.token) continue;

          return {
            token: String(parsed.token),
            user: parsed.user || null
          };
        }
      } catch {
        return null;
      }

      try {
        for (const storageKey of storageKeys || []) {
          const raw = window.sessionStorage.getItem(storageKey);
          if (!raw) continue;

          const parsed = JSON.parse(raw);
          if (!parsed?.token) continue;

          return {
            token: String(parsed.token),
            user: parsed.user || null
          };
        }
      } catch {
        return null;
      }

      return null;
    },
    args: [[WEB_SESSION_KEY, "auth_session", "dashboard_session"]]
  });

  return results?.[0]?.result || null;
};

const syncWebSession = async () => {
  const tabs = await chrome.tabs.query({ url: [...WEB_TAB_PATTERNS, ...LEGACY_WEB_TAB_PATTERNS] });
  for (const tab of tabs) {
    if (typeof tab.id !== "number") continue;

    try {
      const session = await readSessionFromTab(tab.id);
      if (!session?.token) continue;

      await setAuthSession({
        token: session.token,
        user: session.user || null,
        updated_at: new Date().toISOString()
      });

      const status = await validateSession();
      if (status.authenticated) return status;
    } catch {
      // Ignore tab/script errors and try next tab.
    }
  }

  return { authenticated: false, user: null, error: "No active Atriveo web session found." };
};

const normalizeExtractedJob = (job = {}) => {
  const jobTitle = asText(job.job_title || job.position_title);
  const company = asText(job.company);
  const location = asText(job.location);
  const jobDescription = asText(job.job_description);
  const jobId = asText(job.job_id);
  const employmentType = asText(job.employment_type);
  const jobType = asText(job.job_type || employmentType);
  const salaryMin = asText(job.salary_min || job.min_salary);
  const salaryMax = asText(job.salary_max || job.max_salary);
  const currency = asText(job.currency || job.salary_currency);
  const period = asText(job.period || job.salary_period);
  const applicationStatus = asText(job.application_status || "Not Applied");
  const url = asText(job.url || job.job_posting_url);
  const atsPlatform = asText(job.ats_platform) || inferAtsPlatformFromUrl(url);
  const extractorNotes = asText(job.notes);
  const locationType = asText(job.location_type);
  const department = asText(job.department);
  const capturedAt = new Date().toISOString();

  const knownKeys = new Set([
    "job_title",
    "position_title",
    "company",
    "location",
    "job_description",
    "job_id",
    "employment_type",
    "job_type",
    "salary_min",
    "salary_max",
    "salary_currency",
    "salary_period",
    "min_salary",
    "max_salary",
    "currency",
    "period",
    "application_status",
    "notes",
    "url",
    "job_posting_url",
    "ats_platform",
    "location_type",
    "department"
  ]);

  const additionalMetadata = {};
  for (const [key, value] of Object.entries(job || {})) {
    if (knownKeys.has(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") continue;

    const normalizedValue = asText(value);
    if (!normalizedValue) continue;
    additionalMetadata[key] = normalizedValue;
  }

  return {
    job_title: jobTitle,
    company,
    location,
    job_description: jobDescription,
    job_id: jobId,
    employment_type: employmentType,
    job_type: jobType,
    salary_min: salaryMin,
    salary_max: salaryMax,
    currency,
    period,
    application_status: applicationStatus,
    extractor_notes: extractorNotes,
    location_type: locationType,
    department,
    url,
    ats_platform: atsPlatform,
    additional_metadata: additionalMetadata,
    captured_at: capturedAt
  };
};

const buildNotesFromExtractedJob = (job) => {
  const lines = [];

  if (job.location) lines.push(`Location: ${job.location}`);
  if (job.job_type) lines.push(`Job Type: ${job.job_type}`);
  if (job.employment_type && job.employment_type !== job.job_type) {
    lines.push(`Employment Type: ${job.employment_type}`);
  }
  if (job.location_type) lines.push(`Location Type: ${job.location_type}`);
  if (job.department) lines.push(`Department: ${job.department}`);
  if (job.salary_min) lines.push(`Min Salary: ${job.salary_min}`);
  if (job.salary_max) lines.push(`Max Salary: ${job.salary_max}`);
  if (job.currency) lines.push(`Currency: ${job.currency}`);
  if (job.period) lines.push(`Period: ${job.period}`);
  if (job.ats_platform) lines.push(`ATS Platform: ${job.ats_platform}`);
  if (job.application_status && job.application_status.toLowerCase() !== "not applied") {
    lines.push(`Application Status: ${job.application_status}`);
  }
  if (job.extractor_notes) lines.push(`Extractor Notes: ${job.extractor_notes}`);

  const metadataEntries = Object.entries(job.additional_metadata || {});
  for (const [key, value] of metadataEntries) {
    lines.push(`${toTitleCase(key)}: ${value}`);
  }

  return lines.join("\n");
};

const buildNewApplicationPayload = (job) => ({
  job_title: job.job_title,
  company: job.company,
  job_application_id: job.job_id,
  job_link: job.url,
  keyword_match: "Medium",
  referral: "No",
  referral_name: "",
  notes: buildNotesFromExtractedJob(job)
});

const sanitizeNewApplicationPayload = (payload = {}, fallbackNotes = "") => {
  const notesValue =
    payload.notes === undefined || payload.notes === null ? fallbackNotes : payload.notes;

  const normalizedPayload = {
    job_title: asText(payload.job_title),
    company: asText(payload.company),
    job_application_id: asText(payload.job_application_id),
    job_link: asText(payload.job_link),
    keyword_match: normalizeKeywordMatching(payload.keyword_match),
    referral_name: asText(payload.referral_name),
    referral: normalizeReferralStatus(payload.referral),
    notes: asText(notesValue)
  };

  if (normalizedPayload.referral_name) {
    normalizedPayload.referral = "Yes";
  } else if (!normalizedPayload.referral) {
    normalizedPayload.referral = "No";
  }

  return normalizedPayload;
};

const validateApplicationPayload = (payload = {}) => {
  if (!payload.job_title || !payload.company || !payload.job_link) {
    throw new Error("Missing required fields: job_title, company, or job_link.");
  }
  if (!isValidHttpUrl(payload.job_link)) {
    throw new Error("Job link must be a valid URL.");
  }
};

const normalizedCompareText = (value = "") => asText(value).toLowerCase();

const isDuplicateAgainstRow = (row = {}, payload = {}) => {
  const payloadLink = asText(payload.job_link);
  const rowLink = asText(row.job_link);
  if (payloadLink && rowLink && payloadLink === rowLink) return true;

  const payloadJobId = normalizedCompareText(payload.job_application_id);
  const rowJobId = normalizedCompareText(row.job_application_id);
  const payloadCompany = normalizedCompareText(payload.company);
  const rowCompany = normalizedCompareText(row.company);
  const payloadTitle = normalizedCompareText(payload.job_title);
  const rowRole = normalizedCompareText(row.role);

  if (!payloadJobId || !rowJobId) return false;
  return payloadJobId === rowJobId && payloadCompany === rowCompany && payloadTitle === rowRole;
};

const findExistingApplication = async (token, payload) => {
  const limit = 100;
  let page = 1;
  let total = 0;

  const companyFilter = asText(payload.company);
  const companyQuery = companyFilter ? `&company=${encodeURIComponent(companyFilter)}` : "";

  do {
    const response = await apiRequest(`/api/jobs?page=${page}&limit=${limit}${companyQuery}`, {
      token
    });

    const rows = Array.isArray(response?.data) ? response.data : [];
    total = Number(response?.total || 0);

    const existing = rows.find((row) => isDuplicateAgainstRow(row, payload));
    if (existing) return existing;

    if (rows.length < limit) break;
    page += 1;
  } while ((page - 1) * limit < total && page <= 10);

  return null;
};

const buildExtensionSubmissionBody = (record, applicationPayload) => {
  const extracted = record?.extracted_job || {};

  return {
    payload_version: EXTENSION_CONTRACT.version,
    source: EXTENSION_CONTRACT.source,
    submitted_at: new Date().toISOString(),
    submitted_local_date: getLocalISODate(),
    extracted_job: {
      job_title: asText(extracted.job_title),
      company: asText(extracted.company),
      location: asText(extracted.location),
      job_id: asText(extracted.job_id),
      employment_type: asText(extracted.employment_type),
      job_type: asText(extracted.job_type),
      salary_min: asText(extracted.salary_min),
      salary_max: asText(extracted.salary_max),
      currency: asText(extracted.currency),
      period: asText(extracted.period),
      url: asText(extracted.url),
      ats_platform: asText(extracted.ats_platform)
    },
    application: {
      job_title: applicationPayload.job_title,
      company: applicationPayload.company,
      job_application_id: applicationPayload.job_application_id || undefined,
      job_link: applicationPayload.job_link,
      keyword_match: applicationPayload.keyword_match,
      referral: applicationPayload.referral,
      referral_name: applicationPayload.referral_name || undefined,
      notes: applicationPayload.notes || undefined
    }
  };
};

const buildLegacyJobsSubmissionBody = (record, applicationPayload) => {
  const extracted = record?.extracted_job || {};
  const referralName = asText(applicationPayload.referral_name);
  const referralStatus = referralName || normalizeReferralStatus(applicationPayload.referral) === "Yes" ? "Yes" : "No";

  return {
    role: asText(applicationPayload.job_title),
    company: asText(applicationPayload.company),
    location_raw: asText(extracted.location),
    job_link: asText(applicationPayload.job_link),
    job_application_id: asText(applicationPayload.job_application_id) || undefined,
    keyword_matching: normalizeKeywordMatching(applicationPayload.keyword_match),
    oa_status: "No",
    referral_status: referralStatus,
    response_status: "Review",
    application_status: "Applied",
    referred_by_name: referralName || undefined,
    notes: asText(applicationPayload.notes) || undefined,
    date_saved: getLocalISODate()
  };
};

const prepareBackendPayload = (job, newApplicationPayload) => ({
  payload_version: EXTENSION_CONTRACT.version,
  source: EXTENSION_CONTRACT.source,
  captured_at: job.captured_at,
  new_application: newApplicationPayload
});

const createManualRecord = (url, application = {}) => {
  const sourceUrl = asText(url) || asText(application.job_link);
  if (!sourceUrl) return null;

  const extractedJob = normalizeExtractedJob({
    job_title: application.job_title,
    company: application.company,
    job_id: application.job_application_id,
    url: sourceUrl,
    ats_platform: inferAtsPlatformFromUrl(sourceUrl) || "manual"
  });
  const fallbackPayload = buildNewApplicationPayload(extractedJob);
  const newApplicationPayload = sanitizeNewApplicationPayload(
    {
      ...fallbackPayload,
      ...application
    },
    buildNotesFromExtractedJob(extractedJob)
  );

  return {
    extracted_job: extractedJob,
    payload_version: EXTENSION_CONTRACT.version,
    new_application_payload: newApplicationPayload,
    captured_at: extractedJob.captured_at
  };
};

const persistJob = async (incomingJob) => {
  const extractedJob = normalizeExtractedJob(incomingJob);
  if (!extractedJob.url) {
    throw new Error("Missing URL in extracted job payload.");
  }

  const existing = await chrome.storage.local.get([STORAGE_KEYS.JOBS_BY_URL]);
  const jobsByUrl = existing[STORAGE_KEYS.JOBS_BY_URL] || {};
  const existingRecord = jobsByUrl[extractedJob.url] || null;
  const hasCoreFields = Boolean(extractedJob.job_title && extractedJob.company && extractedJob.url);

  // Ignore partial extractor payloads; detector will keep retrying until core fields are present.
  if (!hasCoreFields) {
    if (existingRecord) {
      const existingPrepared = prepareBackendPayload(
        existingRecord.extracted_job || {},
        existingRecord.new_application_payload || {}
      );
      return { record: existingRecord, preparedPayload: existingPrepared, skipped: true };
    }
    return { record: null, preparedPayload: null, skipped: true };
  }

  const defaultPayload = buildNewApplicationPayload(extractedJob);
  const newApplicationPayload = sanitizeNewApplicationPayload(
    defaultPayload,
    buildNotesFromExtractedJob(extractedJob)
  );
  const preparedPayload = prepareBackendPayload(extractedJob, newApplicationPayload);
  const record = {
    extracted_job: extractedJob,
    payload_version: EXTENSION_CONTRACT.version,
    new_application_payload: newApplicationPayload,
    captured_at: extractedJob.captured_at
  };

  jobsByUrl[extractedJob.url] = record;

  await chrome.storage.local.set({
    [STORAGE_KEYS.JOBS_BY_URL]: jobsByUrl,
    [STORAGE_KEYS.LATEST_JOB]: record,
    [STORAGE_KEYS.PREPARED_PAYLOAD]: preparedPayload,
    [STORAGE_KEYS.LAST_UPDATED]: Date.now()
  });

  return { record, preparedPayload };
};

const getRecordForUrl = async (url) => {
  if (!url) return null;

  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.JOBS_BY_URL,
    STORAGE_KEYS.LATEST_JOB
  ]);
  const jobsByUrl = stored[STORAGE_KEYS.JOBS_BY_URL] || {};
  const fromMap = jobsByUrl[url];
  if (fromMap) return fromMap;

  const latest = stored[STORAGE_KEYS.LATEST_JOB] || null;
  return latest?.extracted_job?.url === url ? latest : null;
};

const saveRecord = async (record) => {
  const url = asText(record?.extracted_job?.url);
  if (!url) return;

  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.JOBS_BY_URL,
    STORAGE_KEYS.LATEST_JOB
  ]);
  const jobsByUrl = stored[STORAGE_KEYS.JOBS_BY_URL] || {};
  jobsByUrl[url] = record;

  const latest = stored[STORAGE_KEYS.LATEST_JOB] || null;
  const updates = {
    [STORAGE_KEYS.JOBS_BY_URL]: jobsByUrl
  };

  if (!latest || latest?.extracted_job?.url === url) {
    updates[STORAGE_KEYS.LATEST_JOB] = record;
  }

  await chrome.storage.local.set(updates);
};

const updateApplicationDraft = async ({ url, application = {} }) => {
  const sourceUrl = asText(url);
  if (!sourceUrl) throw new Error("Missing URL.");

  const existingRecord = await getRecordForUrl(sourceUrl);
  const record = existingRecord || createManualRecord(sourceUrl, application);
  if (!record) throw new Error("Unable to prepare application draft.");

  const fallbackNotes = buildNotesFromExtractedJob(record.extracted_job || {});
  const payload = sanitizeNewApplicationPayload(
    {
      ...(record.new_application_payload || {}),
      ...application
    },
    fallbackNotes
  );

  const updatedRecord = {
    ...record,
    extracted_job: {
      ...(record.extracted_job || {}),
      url: asText(record?.extracted_job?.url) || sourceUrl,
      ats_platform:
        asText(record?.extracted_job?.ats_platform) ||
        inferAtsPlatformFromUrl(sourceUrl) ||
        "manual",
      job_title: asText(record?.extracted_job?.job_title) || payload.job_title,
      company: asText(record?.extracted_job?.company) || payload.company,
      job_id: asText(record?.extracted_job?.job_id) || payload.job_application_id
    },
    new_application_payload: payload,
    payload_version: EXTENSION_CONTRACT.version,
    captured_at: asText(record?.captured_at) || new Date().toISOString()
  };

  await saveRecord(updatedRecord);

  const preparedPayload = prepareBackendPayload(updatedRecord.extracted_job, payload);
  await chrome.storage.local.set({
    [STORAGE_KEYS.PREPARED_PAYLOAD]: preparedPayload,
    [STORAGE_KEYS.LAST_UPDATED]: Date.now()
  });

  return { record: updatedRecord, preparedPayload };
};

const submitApplication = async ({ url, keyword_match, referral_name, application = {} }) => {
  const session = await getAuthSession();
  if (!session?.token) {
    const error = new Error("Login required.");
    error.status = 401;
    throw error;
  }

  const sourceUrl = asText(url);
  let record = await getRecordForUrl(sourceUrl);
  if (!record) {
    record = createManualRecord(sourceUrl, application);
  }
  if (!record?.new_application_payload) {
    throw new Error("No application draft available for this tab.");
  }

  const payload = sanitizeNewApplicationPayload(
    {
      ...record.new_application_payload,
      ...application,
      keyword_match:
        keyword_match !== undefined
          ? keyword_match
          : application.keyword_match !== undefined
            ? application.keyword_match
            : record.new_application_payload.keyword_match,
      referral_name:
        referral_name !== undefined
          ? referral_name
          : application.referral_name !== undefined
            ? application.referral_name
            : record.new_application_payload.referral_name
    },
    buildNotesFromExtractedJob(record.extracted_job || {})
  );
  validateApplicationPayload(payload);

  const existing = await findExistingApplication(session.token, payload).catch(() => null);
  if (existing) {
    const updatedRecord = {
      ...record,
      extracted_job: {
        ...(record.extracted_job || {}),
        url: asText(record?.extracted_job?.url) || sourceUrl || payload.job_link,
        ats_platform:
          asText(record?.extracted_job?.ats_platform) ||
          inferAtsPlatformFromUrl(sourceUrl || payload.job_link) ||
          "manual",
        job_title: asText(record?.extracted_job?.job_title) || payload.job_title,
        company: asText(record?.extracted_job?.company) || payload.company,
        job_id: asText(record?.extracted_job?.job_id) || payload.job_application_id
      },
      new_application_payload: payload
    };
    await saveRecord(updatedRecord);

    const preparedPayload = prepareBackendPayload(updatedRecord.extracted_job, payload);
    await chrome.storage.local.set({
      [STORAGE_KEYS.PREPARED_PAYLOAD]: preparedPayload,
      [STORAGE_KEYS.LAST_UPDATED]: Date.now()
    });

    return {
      created: {
        deduped: true,
        job: existing
      },
      deduped: true,
      record: updatedRecord
    };
  }

  let created;
  try {
    created = await apiRequest(EXTENSION_CONTRACT.submitPath, {
      method: "POST",
      token: session.token,
      body: buildExtensionSubmissionBody(record, payload)
    });
  } catch (error) {
    if (Number(error?.status) !== 404) {
      throw error;
    }

    created = await apiRequest("/api/jobs", {
      method: "POST",
      token: session.token,
      body: buildLegacyJobsSubmissionBody(record, payload)
    });
  }

  const updatedRecord = {
    ...record,
    extracted_job: {
      ...(record.extracted_job || {}),
      url: asText(record?.extracted_job?.url) || sourceUrl || payload.job_link,
      ats_platform:
        asText(record?.extracted_job?.ats_platform) ||
        inferAtsPlatformFromUrl(sourceUrl || payload.job_link) ||
        "manual",
      job_title: asText(record?.extracted_job?.job_title) || payload.job_title,
      company: asText(record?.extracted_job?.company) || payload.company,
      job_id: asText(record?.extracted_job?.job_id) || payload.job_application_id
    },
    new_application_payload: payload
  };
  await saveRecord(updatedRecord);

  const preparedPayload = prepareBackendPayload(updatedRecord.extracted_job, payload);
  await chrome.storage.local.set({
    [STORAGE_KEYS.PREPARED_PAYLOAD]: preparedPayload,
    [STORAGE_KEYS.LAST_UPDATED]: Date.now()
  });

  try {
    await notifyDashboardTabsJobAdded();
  } catch (_) {
    // Best-effort notification; save flow must not fail on tab messaging issues.
  }

  try {
    const bc = new BroadcastChannel("atriveo-sync");
    bc.postMessage({ type: "job-added" });
    bc.close();
  } catch (_) { /* BroadcastChannel not available */ }

  return { created, record: updatedRecord };
};

chrome.runtime.onInstalled.addListener(() => {
  console.info("[Atriveo] Job Assistant installed.");
});

// Auto-open the floater after supported pages finish loading.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;

  const tabUrl = asText(tab?.url);
  if (!tabUrl || !/^https?:\/\//i.test(tabUrl)) return;

  const platform = inferAtsPlatformFromUrl(tabUrl);
  if (!platform) return;

  chrome.tabs.sendMessage(tabId, { type: "AUTO_OPEN_PANEL" }, () => {
    // Content script may not exist on every URL variant; ignore message errors.
    void chrome.runtime.lastError;
  });
});

// Extension icon click: toggle the floating widget panel on supported pages,
// or open the Atriveo dashboard on unsupported pages.
chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id) return;

  const tabId = tab.id;
  chrome.tabs.sendMessage(tabId, { type: "TOGGLE_PANEL" }, (response) => {
    if (!chrome.runtime.lastError && response?.ok) {
      return;
    }

    // Floater is not present yet. Attempt dynamic injection on the active tab
    // so users can still add applications manually on unsupported pages.
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: () => {
          window.__ATRIVEO_FORCE_WIDGET__ = true;
        }
      },
      () => {
        chrome.scripting.insertCSS(
          {
            target: { tabId },
            files: ["content-scripts/floating-widget.css"]
          },
          () => {
            chrome.scripting.executeScript(
              {
                target: { tabId },
                files: [
                  "utils/extractText.js",
                  "content-scripts/detector.js",
                  "content-scripts/floating-widget.js"
                ]
              },
              () => {
                chrome.tabs.sendMessage(tabId, { type: "TOGGLE_PANEL" }, (retryResponse) => {
                  if (!chrome.runtime.lastError && retryResponse?.ok) {
                    return;
                  }

                  // Restricted pages (chrome://, extensions, web store) can't be scripted.
                  chrome.tabs.create({ url: WEB_LOGIN_URL });
                });
              }
            );
          }
        );
      }
    );
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = message?.type;
  if (!type) return false;

  if (type === "JOB_EXTRACTED") {
    persistJob(message.payload)
      .then(({ record, preparedPayload }) => {
        console.info("[Atriveo] Job data received:", record);
        console.debug("[Atriveo] Prepared payload for backend sync:", preparedPayload);
        sendResponse({ ok: true, record });
      })
      .catch((error) => {
        console.error("[Atriveo] Failed to persist extracted job:", error);
        sendResponse({ ok: false, error: error.message });
      });

    return true;
  }

  if (type === "GET_JOB_FOR_URL") {
    getRecordForUrl(message.url)
      .then((record) => sendResponse({ ok: true, record }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (type === "GET_LATEST_JOB") {
    chrome.storage.local
      .get([STORAGE_KEYS.LATEST_JOB])
      .then((stored) => sendResponse({ ok: true, record: stored[STORAGE_KEYS.LATEST_JOB] || null }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (type === "GET_PREPARED_PAYLOAD") {
    chrome.storage.local
      .get([STORAGE_KEYS.PREPARED_PAYLOAD])
      .then((stored) =>
        sendResponse({ ok: true, payload: stored[STORAGE_KEYS.PREPARED_PAYLOAD] || null })
      )
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (type === "RUN_EXTRACTION_FOR_TAB") {
    const tabId = _sender?.tab?.id;
    const tabUrl = asText(_sender?.tab?.url);
    const platform = inferAtsPlatformFromUrl(tabUrl);

    if (typeof tabId !== "number") {
      sendResponse({ ok: false, error: "Unable to identify tab for extraction." });
      return false;
    }

    ensurePlatformExtractorForTab(tabId, platform)
      .catch(() => ({ ensured: false }))
      .then(
        () =>
          new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { type: "RUN_EXTRACTION" }, (response) => {
              const runtimeError = chrome.runtime.lastError;
              if (runtimeError) {
                resolve({ ok: false, error: runtimeError.message });
                return;
              }

              const job = response?.job || null;
              if (!job) {
                resolve({ ok: true, record: null });
                return;
              }

              persistJob(job)
                .then(({ record }) => resolve({ ok: true, record }))
                .catch((error) => resolve({ ok: false, error: error.message }));
            });
          })
      )
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (type === "AUTH_STATUS") {
    (async () => {
      const status = await validateSession();
      if (status.authenticated || !message?.sync_web) return status;
      return syncWebSession();
    })()
      .then((status) => sendResponse({ ok: true, ...status }))
      .catch((error) => sendResponse({ ok: false, authenticated: false, error: error.message }));

    return true;
  }

  if (type === "ENSURE_PLATFORM_EXTRACTOR") {
    const tabId = _sender?.tab?.id;
    const platform = asText(message?.platform) || inferAtsPlatformFromUrl(_sender?.tab?.url || "");

    ensurePlatformExtractorForTab(tabId, platform)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (type === "OPEN_LOGIN_PAGE") {
    openLoginPage()
      .then((tab) => sendResponse({ ok: true, tabId: tab?.id ?? null }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (type === "SYNC_WEB_SESSION") {
    syncWebSession()
      .then((status) => sendResponse({ ok: true, ...status }))
      .catch((error) => sendResponse({ ok: false, authenticated: false, error: error.message }));

    return true;
  }

  if (type === "UPDATE_APPLICATION_DRAFT") {
    updateApplicationDraft({
      url: message.url,
      application: message.application || {}
    })
      .then(({ record }) => sendResponse({ ok: true, record }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (type === "LOGOUT") {
    clearAuthSession()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (type === "SUBMIT_APPLICATION") {
    submitApplication({
      url: message.url,
      keyword_match: message.keyword_match,
      referral_name: message.referral_name,
      application: message.application || {}
    })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          unauthorized: Number(error?.status) === 401,
          duplicate:
            Number(error?.status) === 409 ||
            asText(error?.code).toUpperCase() === "DUPLICATE_APPLICATION",
          code: asText(error?.code),
          details: error?.payload || null,
          error: error.message || "Failed to submit application."
        })
      );

    return true;
  }

  return false;
});
