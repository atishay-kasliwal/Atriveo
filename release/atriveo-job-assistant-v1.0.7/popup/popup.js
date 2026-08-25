const scanMessageEl = document.getElementById("scanMessage");
const popupEl = document.querySelector(".popup");
const jobTitleEl = document.getElementById("jobTitle");
const jobCompanyEl = document.getElementById("jobCompany");
const jobApplicationIdEl = document.getElementById("jobApplicationId");
const jobLinkEl = document.getElementById("jobLink");
const jobNotesEl = document.getElementById("jobNotes");
const keywordMatchEl = document.getElementById("keywordMatch");
const referralNameEl = document.getElementById("referralName");
const actionStatusEl = document.getElementById("actionStatus");
const refreshBtn = document.getElementById("refreshBtn");
const actionBtn = document.getElementById("actionBtn");
const EDITABLE_TEXT_FIELDS = [jobTitleEl, jobCompanyEl, jobApplicationIdEl, jobLinkEl, jobNotesEl];
const SINGLE_LINE_EDITABLE_FIELDS = [jobTitleEl, jobCompanyEl, jobApplicationIdEl, jobLinkEl];

const ATS_HOSTS = [
  // Core ATS platforms
  "myworkdayjobs.com",
  "greenhouse.io",
  "lever.co",
  "applytojob.com",
  "ashbyhq.com",
  "smartrecruiters.com",
  "icims.com",
  "jobvite.com",
  "bamboohr.com",
  "jazzhr.com",
  "taleo.net",
  "successfactors.com",
  "jobs.sap.com",
  "adp.com",
  "paylocity.com",
  "teamtailor.com",
  "recruitee.com",
  "workable.com",
  "jobscore.com",
  "clearcompany.com",
  "njoyn.com",
  "linkedin.com",
  "avature.net",
  "amazon.jobs",
  "ultipro.com",
  // Job aggregators
  "jobright.ai",
  "simplify.jobs",
  // Company career pages
  "careers.apple.com",
  "metacareers.com",
  "careers.microsoft.com",
  "jobs.tesla.com",
  "nvidia.com/en-us/about-nvidia/careers",
  "jobs.cisco.com",
  "jobs.intel.com",
  "careers.ibm.com",
  "careers.oracle.com",
  "salesforce.com/company/careers",
  "stripe.com/jobs",
  "careers.airbnb.com",
  "uber.com/us/en/careers",
  "lyft.com/careers",
  "snap.com/en-US/jobs",
  "openai.com/careers",
  "anthropic.com/careers",
  "spacex.com/careers",
  "databricks.com/company/careers",
  "coinbase.com/careers",
  "careers.robinhood.com",
  "rivian.com/careers",
  "boeing.com/careers",
  "lockheedmartin.com/en-us/careers",
  "careers.rtx.com",
  "goldmansachs.com/careers",
  "morganstanley.com/people/professionals",
  "careers.jpmorgan.com",
  "pinterestcareers.com",
  "dropbox.com/jobs",
  "block.xyz/careers",
  "careers.squareup.com",
  "jobs.netflix.com",
  "careers.google.com"
];

const BASE_CONTENT_SCRIPT_FILES = ["utils/extractText.js", "content-scripts/detector.js"];
const EXTRACTOR_SCRIPT_BY_PLATFORM = {
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

let activeTab = null;
let currentRecord = null;
let authState = { authenticated: false, user: null };
let submissionComplete = false;
let actionInFlight = false;
let actionStatusTimer = null;

const runtimeMessage = (payload) =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response || {});
    });
  });

const tabMessage = (tabId, payload) =>
  new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response || {});
    });
  });

const getActiveTab = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
};

const getPlatformFromUrl = (url = "") => {
  const source = String(url || "").toLowerCase();
  if (source.includes("myworkdayjobs")) return "workday";
  if (source.includes("greenhouse.io")) return "greenhouse";
  if (source.includes("lever.co")) return "lever";
  if (source.includes("applytojob.com")) return "applytojob";
  if (source.includes("ashbyhq.com")) return "ashby";
  if (source.includes("smartrecruiters.com")) return "smartrecruiters";
  if (source.includes("icims.com")) return "icims";
  if (source.includes("jobvite.com")) return "jobvite";
  if (source.includes("bamboohr.com")) return "bamboohr";
  if (source.includes("jazzhr.com")) return "jazzhr";
  if (source.includes("taleo.net")) return "taleo";
  if (source.includes("successfactors.com") || source.includes("jobs.sap.com")) return "successfactors";
  if (source.includes("adp.com")) return "adp";
  if (source.includes("paylocity.com")) return "paylocity";
  if (source.includes("teamtailor.com")) return "teamtailor";
  if (source.includes("recruitee.com")) return "recruitee";
  if (source.includes("workable.com")) return "workable";
  if (source.includes("jobscore.com")) return "jobscore";
  if (source.includes("clearcompany.com")) return "clearcompany";
  if (source.includes("njoyn.com")) return "njoyn";
  if (source.includes("linkedin.com")) return "linkedin";
  if (source.includes("avature.net")) return "avature";
  if (source.includes("amazon.jobs")) return "amazonjobs";
  if (source.includes("ultipro.com")) return "ultipro";
  // Job aggregators
  if (source.includes("jobright.ai")) return "jobright";
  if (source.includes("simplify.jobs")) return "genericcareer";
  // Company career pages
  if (source.includes("careers.apple.com")) return "genericcareer";
  if (source.includes("metacareers.com")) return "genericcareer";
  if (source.includes("careers.microsoft.com")) return "genericcareer";
  if (source.includes("jobs.tesla.com")) return "genericcareer";
  if (source.includes("nvidia.com")) return "genericcareer";
  if (source.includes("jobs.cisco.com")) return "genericcareer";
  if (source.includes("jobs.intel.com")) return "genericcareer";
  if (source.includes("careers.ibm.com")) return "genericcareer";
  if (source.includes("careers.oracle.com")) return "genericcareer";
  if (source.includes("salesforce.com")) return "genericcareer";
  if (source.includes("stripe.com")) return "genericcareer";
  if (source.includes("careers.airbnb.com")) return "genericcareer";
  if (source.includes("uber.com")) return "genericcareer";
  if (source.includes("lyft.com")) return "genericcareer";
  if (source.includes("snap.com")) return "genericcareer";
  if (source.includes("openai.com")) return "genericcareer";
  if (source.includes("anthropic.com")) return "genericcareer";
  if (source.includes("spacex.com")) return "genericcareer";
  if (source.includes("databricks.com")) return "genericcareer";
  if (source.includes("coinbase.com")) return "genericcareer";
  if (source.includes("careers.robinhood.com")) return "genericcareer";
  if (source.includes("rivian.com")) return "genericcareer";
  if (source.includes("boeing.com")) return "genericcareer";
  if (source.includes("lockheedmartin.com")) return "genericcareer";
  if (source.includes("careers.rtx.com")) return "genericcareer";
  if (source.includes("goldmansachs.com")) return "genericcareer";
  if (source.includes("morganstanley.com")) return "genericcareer";
  if (source.includes("careers.jpmorgan.com")) return "genericcareer";
  if (source.includes("pinterestcareers.com")) return "genericcareer";
  if (source.includes("dropbox.com")) return "genericcareer";
  if (source.includes("block.xyz")) return "genericcareer";
  if (source.includes("careers.squareup.com")) return "genericcareer";
  if (source.includes("jobs.netflix.com")) return "genericcareer";
  if (source.includes("careers.google.com")) return "genericcareer";
  return "";
};

const ensureContentScripts = async (tabId, url = "") => {
  if (typeof tabId !== "number") return;

  const files = [...BASE_CONTENT_SCRIPT_FILES];
  const extractorScript = EXTRACTOR_SCRIPT_BY_PLATFORM[getPlatformFromUrl(url)];
  if (extractorScript) files.push(extractorScript);

  await chrome.scripting.executeScript({
    target: { tabId },
    files
  });
};

const isSupportedUrl = (url) => {
  if (!url) return false;
  return ATS_HOSTS.some((domain) => url.includes(domain));
};

const toSingleLineText = (value = "") => {
  const raw = String(value || "").replace(/\u00a0/g, " ");
  const normalized = raw.replace(/\s+/g, " ").trim();
  return normalized === "-" ? "" : normalized;
};

const toMultilineText = (value = "") => {
  const raw = String(value || "").replace(/\u00a0/g, " ").replace(/\r/g, "");
  const normalized = raw
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return normalized === "-" ? "" : normalized;
};

const toDisplayText = (value = "", { multiline = false } = {}) => {
  const normalized = multiline ? toMultilineText(value) : toSingleLineText(value);
  return normalized;
};

const clearActionStatusTimer = () => {
  if (actionStatusTimer) {
    clearTimeout(actionStatusTimer);
    actionStatusTimer = null;
  }
};

const setActionStatus = (message = "", type = "", options = {}) => {
  clearActionStatusTimer();

  actionStatusEl.textContent = message;
  actionStatusEl.classList.remove("error", "success");
  if (type) actionStatusEl.classList.add(type);

  const autoClearMs = Number(options.autoClearMs || 0);
  if (message && autoClearMs > 0) {
    actionStatusTimer = setTimeout(() => {
      if (!submissionComplete && !actionInFlight) {
        actionStatusEl.textContent = "";
        actionStatusEl.classList.remove("error", "success");
      }
    }, autoClearMs);
  }
};

const setSubmissionComplete = (complete) => {
  submissionComplete = Boolean(complete);
  popupEl.classList.toggle("success-only", submissionComplete);
};

const readEditableText = (element, { multiline = false } = {}) => {
  if (!element) return "";
  return multiline
    ? toMultilineText(element.textContent || "")
    : toSingleLineText(element.textContent || "");
};

const isValidHttpUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return false;

  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const syncJobLinkHref = () => {
  const value = readEditableText(jobLinkEl);
  jobLinkEl.href = isValidHttpUrl(value) ? value : "#";
};

const getFormPayload = () => ({
  job_title: readEditableText(jobTitleEl),
  company: readEditableText(jobCompanyEl),
  job_application_id: readEditableText(jobApplicationIdEl),
  job_link: readEditableText(jobLinkEl),
  notes: readEditableText(jobNotesEl, { multiline: true }),
  keyword_match: String(keywordMatchEl.value || "Medium").trim() || "Medium",
  referral_name: toSingleLineText(referralNameEl.value || "")
});

const hasSubmittablePayload = () => {
  const payload = getFormPayload();
  return Boolean(payload.job_title && payload.company && payload.job_link && isValidHttpUrl(payload.job_link));
};

const setActionInFlight = (inFlight) => {
  actionInFlight = Boolean(inFlight);
  refreshBtn.disabled = actionInFlight;
  updateActionButtonState();
};

const clearJobFields = () => {
  jobTitleEl.textContent = "";
  jobCompanyEl.textContent = "";
  jobApplicationIdEl.textContent = "";
  jobLinkEl.textContent = "";
  jobLinkEl.href = "#";
  jobNotesEl.textContent = "";
  keywordMatchEl.value = "Medium";
  referralNameEl.value = "";
};

const renderPayload = (payload) => {
  if (!payload) {
    clearJobFields();
    return;
  }

  jobTitleEl.textContent = toDisplayText(payload.job_title);
  jobCompanyEl.textContent = toDisplayText(payload.company);
  jobApplicationIdEl.textContent = toDisplayText(payload.job_application_id);
  jobNotesEl.textContent = toDisplayText(payload.notes, { multiline: true });
  keywordMatchEl.value = toSingleLineText(payload.keyword_match || "Medium") || "Medium";
  referralNameEl.value = toDisplayText(payload.referral_name);

  const safeUrl = toSingleLineText(payload.job_link || "");
  if (safeUrl) {
    jobLinkEl.textContent = safeUrl;
    jobLinkEl.href = safeUrl;
  } else {
    jobLinkEl.textContent = "";
    jobLinkEl.href = "#";
  }
};

const updateActionButtonState = () => {
  if (authState.authenticated) {
    actionBtn.textContent = "Add Application";
    actionBtn.disabled = actionInFlight || !hasSubmittablePayload();
    return;
  }

  actionBtn.textContent = "Login";
  actionBtn.disabled = actionInFlight;
};

const fetchRecordForTab = async (tab) => {
  if (!tab || typeof tab.id !== "number" || !tab.url) return null;

  const stored = await runtimeMessage({ type: "GET_JOB_FOR_URL", url: tab.url }).catch(() => null);
  if (stored?.record) return stored.record;

  let extractionAttempted = false;
  try {
    await tabMessage(tab.id, { type: "RUN_EXTRACTION" });
    extractionAttempted = true;
  } catch {
    // Content scripts may not be attached for already-open tabs after reload; inject and retry.
    await ensureContentScripts(tab.id, tab.url).catch(() => null);
    await tabMessage(tab.id, { type: "RUN_EXTRACTION" }).catch(() => null);
    extractionAttempted = true;
  }

  if (!extractionAttempted) return null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const refreshed = await runtimeMessage({ type: "GET_JOB_FOR_URL", url: tab.url }).catch(() => null);
    if (refreshed?.record) return refreshed.record;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return null;
};

const refreshAuthStatus = async ({ syncWeb = true } = {}) => {
  const response = await runtimeMessage({ type: "AUTH_STATUS", sync_web: syncWeb }).catch(() => ({
    ok: false,
    authenticated: false
  }));

  authState = response?.ok
    ? { authenticated: Boolean(response.authenticated), user: response.user || null }
    : { authenticated: false, user: null };

  return authState;
};

const persistDraft = async () => {
  if (!activeTab?.url) return;

  const response = await runtimeMessage({
    type: "UPDATE_APPLICATION_DRAFT",
    url: activeTab.url,
    application: getFormPayload()
  }).catch(() => null);

  if (response?.ok && response.record) {
    currentRecord = response.record;
  }
};

const refresh = async () => {
  setActionInFlight(false);
  setSubmissionComplete(false);
  setActionStatus("");
  scanMessageEl.textContent = "Atriveo is scanning this job page.";
  clearJobFields();
  currentRecord = null;

  activeTab = await getActiveTab().catch(() => null);
  if (!activeTab?.url) {
    scanMessageEl.textContent = "No active tab found.";
    jobTitleEl.textContent = "Open a job page to scan.";
    await refreshAuthStatus({ syncWeb: true });
    updateActionButtonState();
    return;
  }

  const supportedPage = isSupportedUrl(activeTab.url);
  let recordResult = null;

  if (supportedPage) {
    recordResult = await fetchRecordForTab(activeTab).catch(() => null);
  } else {
    scanMessageEl.textContent = "Unsupported page. Fill fields manually.";
    const stored = await runtimeMessage({ type: "GET_JOB_FOR_URL", url: activeTab.url }).catch(() => null);
    recordResult = stored?.record || null;
  }

  await refreshAuthStatus({ syncWeb: true });

  currentRecord = recordResult;
  if (!currentRecord) {
    renderPayload({
      job_title: "",
      company: "",
      job_application_id: "",
      job_link: isValidHttpUrl(activeTab.url) ? activeTab.url : "",
      notes: "",
      keyword_match: "Medium",
      referral_name: ""
    });
  } else {
    renderPayload(currentRecord.new_application_payload || null);
  }

  if (!supportedPage && authState.authenticated) {
    setActionStatus("Unsupported page: fill details manually, then add application.");
  } else if (!authState.authenticated && !supportedPage) {
    setActionStatus("Unsupported page: fill details manually, then login to add.");
  } else if (!authState.authenticated) {
    setActionStatus("Login required to add application.");
  }

  syncJobLinkHref();
  updateActionButtonState();
};

const handleLogin = async () => {
  setSubmissionComplete(false);
  setActionInFlight(true);
  setActionStatus("Opening Atriveo login page...");

  const openResult = await runtimeMessage({ type: "OPEN_LOGIN_PAGE" }).catch((error) => ({
    ok: false,
    error: error.message
  }));

  if (!openResult?.ok) {
    setActionStatus(openResult?.error || "Unable to open login page.", "error", { autoClearMs: 4500 });
    setActionInFlight(false);
    return;
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const syncResult = await runtimeMessage({ type: "SYNC_WEB_SESSION" }).catch(() => null);
    if (syncResult?.ok && syncResult.authenticated) {
      authState = { authenticated: true, user: syncResult.user || null };
      setActionStatus("Logged in. You can now add application.", "success", { autoClearMs: 3500 });
      setActionInFlight(false);
      updateActionButtonState();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  setActionStatus("Complete login on tracker.atriveo.com, then click Login again.", "error", { autoClearMs: 5000 });
  setActionInFlight(false);
  updateActionButtonState();
};

const validateFormPayload = (payload) => {
  if (!payload.job_title) return "Job Title is required.";
  if (!payload.company) return "Company is required.";
  if (!payload.job_link) return "Job Link is required.";
  if (!isValidHttpUrl(payload.job_link)) return "Job Link must be a valid URL.";
  return "";
};

const handleAddApplication = async () => {
  setSubmissionComplete(false);

  if (!activeTab?.url) {
    setActionStatus("No active tab detected.", "error", { autoClearMs: 4500 });
    return;
  }

  const applicationPayload = getFormPayload();
  const validationError = validateFormPayload(applicationPayload);
  if (validationError) {
    setActionStatus(validationError, "error", { autoClearMs: 4500 });
    updateActionButtonState();
    return;
  }

  setActionInFlight(true);
  setActionStatus("Adding application...");
  await persistDraft().catch(() => null);

  const response = await runtimeMessage({
    type: "SUBMIT_APPLICATION",
    url: activeTab.url,
    keyword_match: applicationPayload.keyword_match,
    referral_name: applicationPayload.referral_name,
    application: applicationPayload
  }).catch((error) => ({ ok: false, error: error.message }));

  if (!response?.ok) {
    if (response?.unauthorized) {
      authState = { authenticated: false, user: null };
      setActionStatus("Session expired. Login again.", "error", { autoClearMs: 4500 });
      setActionInFlight(false);
      updateActionButtonState();
      return;
    }

    if (response?.duplicate) {
      currentRecord = response.record || currentRecord;
      renderPayload(currentRecord?.new_application_payload || applicationPayload);
      setSubmissionComplete(true);
      setActionStatus("Application added successfully.", "success");
      setActionInFlight(false);
      updateActionButtonState();
      return;
    }

    setActionStatus(response?.error || "Failed to add application.", "error", { autoClearMs: 5000 });
    setActionInFlight(false);
    updateActionButtonState();
    return;
  }

  currentRecord = response.record || currentRecord;
  renderPayload(currentRecord?.new_application_payload || applicationPayload);
  setActionInFlight(false);
  setSubmissionComplete(true);
  setActionStatus("Application added successfully.", "success");
  updateActionButtonState();
};

const handlePrimaryAction = async () => {
  if (actionInFlight) return;

  if (authState.authenticated) {
    await handleAddApplication();
    return;
  }

  await handleLogin();
};

const insertTextAtCursor = (text) => {
  if (
    typeof document.queryCommandSupported === "function" &&
    document.queryCommandSupported("insertText")
  ) {
    document.execCommand("insertText", false, text);
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  selection.deleteFromDocument();
  const range = selection.getRangeAt(0);
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.setEndAfter(textNode);
  selection.removeAllRanges();
  selection.addRange(range);
};

const handleEditablePaste = (event) => {
  event.preventDefault();
  const target = event.currentTarget;
  const text = event.clipboardData?.getData("text/plain") || "";
  const normalized =
    target === jobNotesEl ? toMultilineText(text) : toSingleLineText(text);
  insertTextAtCursor(normalized);
  handleFormInputChange();
};

const handleSingleLineEnter = (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  insertTextAtCursor(" ");
};

const handleInputPaste = (event) => {
  event.preventDefault();
  const text = toSingleLineText(event.clipboardData?.getData("text/plain") || "");
  const target = event.currentTarget;
  const start = Number(target.selectionStart ?? target.value.length);
  const end = Number(target.selectionEnd ?? target.value.length);
  target.setRangeText(text, start, end, "end");
  handleFormInputChange();
};

const handleFormInputChange = (event) => {
  if (event?.target === referralNameEl) {
    referralNameEl.value = toSingleLineText(referralNameEl.value || "");
  }

  if (submissionComplete) {
    setSubmissionComplete(false);
    setActionStatus("");
  }
  syncJobLinkHref();
  void persistDraft();
  updateActionButtonState();
};

EDITABLE_TEXT_FIELDS.forEach((element) => {
  element.addEventListener("input", handleFormInputChange);
  element.addEventListener("paste", handleEditablePaste);
});

SINGLE_LINE_EDITABLE_FIELDS.forEach((element) => {
  element.addEventListener("keydown", handleSingleLineEnter);
});

keywordMatchEl.addEventListener("change", handleFormInputChange);
referralNameEl.addEventListener("input", handleFormInputChange);
referralNameEl.addEventListener("paste", handleInputPaste);
refreshBtn.addEventListener("click", refresh);
actionBtn.addEventListener("click", handlePrimaryAction);
document.addEventListener("DOMContentLoaded", refresh);
