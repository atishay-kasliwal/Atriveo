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
  "clearcompany.com"
];

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

  await tabMessage(tab.id, { type: "RUN_EXTRACTION" }).catch(() => null);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const refreshed = await runtimeMessage({ type: "GET_JOB_FOR_URL", url: tab.url }).catch(() => null);
    if (refreshed?.record) return refreshed.record;
    await new Promise((resolve) => setTimeout(resolve, 120));
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

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const syncResult = await runtimeMessage({ type: "SYNC_WEB_SESSION" }).catch(() => null);
    if (syncResult?.ok && syncResult.authenticated) {
      authState = { authenticated: true, user: syncResult.user || null };
      setActionStatus("Logged in. You can now add application.", "success", { autoClearMs: 3500 });
      setActionInFlight(false);
      updateActionButtonState();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  setActionStatus("Complete login on atriveo.com, then click Login again.", "error", { autoClearMs: 5000 });
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
