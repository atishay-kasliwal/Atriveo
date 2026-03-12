(function initAtriveoFloatingWidget() {
  if (window.__ATRIVEO_FLOATING_WIDGET_READY__) return;
  window.__ATRIVEO_FLOATING_WIDGET_READY__ = true;

  const SUPPORTED_HOST_TOKENS = [
    "myworkdayjobs",
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
    "jobright.ai",
    "careers.apple.com",
    "metacareers.com",
    "careers.microsoft.com",
    "tesla.com",
    "nvidia.com",
    "jobs.cisco.com",
    "jobs.intel.com",
    "careers.ibm.com",
    "oracle.com",
    "salesforce.com",
    "stripe.com",
    "careers.airbnb.com",
    "uber.com",
    "lyft.com",
    "snap.com",
    "openai.com",
    "anthropic.com",
    "spacex.com",
    "databricks.com",
    "coinbase.com",
    "careers.robinhood.com",
    "rivian.com",
    "boeing.com",
    "lockheedmartin.com",
    "rtx.com",
    "goldmansachs.com",
    "morganstanley.com",
    "careers.jpmorgan.com",
    "pinterestcareers.com",
    "dropbox.com",
    "block.xyz",
    "careers.squareup.com",
    "jobs.netflix.com",
    "careers.google.com",
    "simplify.jobs"
  ];
  const CAREER_PATH_PATTERN =
    /\b(careers?|jobs?|job-details?|positions?|openings?|opportunities|requisition|vacanc(?:y|ies)|apply)\b/i;
  const CAREER_QUERY_PATTERN = /(?:jobId|job_id|gh_jid|lever-source|opening|requisition|req_id)=/i;
  const currentUrl = window.location.href;
  const host = window.location.hostname.toLowerCase();
  const pathname = String(window.location.pathname || "");
  const title = String(document.title || "");
  const bodyText = String(document.body?.innerText || "").slice(0, 2400);
  const lowerUrl = currentUrl.toLowerCase();
  const lowerPath = pathname.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerBodyText = bodyText.toLowerCase();

  const isPostApplyConfirmationPage =
    /(?:thank\s*you\s*for\s*applying|application\s*(?:submitted|received|complete)|submission\s*complete|already\s*applied)/i.test(
      `${lowerTitle} ${lowerBodyText}`
    ) ||
    /\b(?:confirmation|confirm|submitted|success|thank-you|thank_you)\b/.test(lowerPath) ||
    /\b(?:application[_-]?submitted|submission[_-]?complete|thank[_-]?you)\b/.test(lowerUrl);

  const isLinkedInHost = host.includes("linkedin.com");
  const isLinkedInJobPage =
    /\/jobs(?:\/|$)/i.test(pathname) ||
    /(?:currentjobid|trk=public_jobs)/i.test(currentUrl);

  const isSupportedHost =
    SUPPORTED_HOST_TOKENS.some((token) => host.includes(token)) &&
    (!isLinkedInHost || isLinkedInJobPage);
  const isLikelyCareerPage =
    CAREER_PATH_PATTERN.test(pathname) ||
    CAREER_QUERY_PATTERN.test(currentUrl) ||
    /\b(careers?|jobs?|job opening|job description|requisition)\b/i.test(title) ||
    /\b(apply now|job title|requisition id|employment type|hiring|career site)\b/i.test(bodyText);

  const isSupportedPage = isSupportedHost || isLikelyCareerPage;
  const forceWidget = Boolean(window.__ATRIVEO_FORCE_WIDGET__);

  if (!isSupportedPage && !forceWidget) return;

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

  const toText = (value = "") => String(value || "").trim();
  const DISMISSED_FLOW_STORAGE_KEY = "__ATRIVEO_DISMISSED_FLOWS__";
  const DISMISSED_FLOW_LIMIT = 80;

  const readDismissedFlows = () => {
    try {
      const raw = window.sessionStorage.getItem(DISMISSED_FLOW_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeDismissedFlows = (flows = {}) => {
    const entries = Object.entries(flows).sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0));
    const trimmed = Object.fromEntries(entries.slice(0, DISMISSED_FLOW_LIMIT));
    try {
      window.sessionStorage.setItem(DISMISSED_FLOW_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore storage quota/privacy mode errors.
    }
  };

  const getApplicationFlowKey = (url = "") => {
    const raw = toText(url);
    if (!raw) return "";

    try {
      const parsed = new URL(raw, window.location.origin);
      const params = parsed.searchParams;
      const identityPairs = [];

      for (const [key, value] of params.entries()) {
        if (!key || !value) continue;
        if (/(?:job|req|requisition|opening|position|posting|token|application|gh_jid|currentjobid|id)/i.test(key)) {
          identityPairs.push(`${key.toLowerCase()}=${value}`);
        }
      }

      identityPairs.sort();
      const identity = identityPairs.length > 0 ? `?${identityPairs.join("&")}` : "";
      return `${parsed.origin}${parsed.pathname}${identity}`;
    } catch {
      return raw;
    }
  };

  const markFlowDismissed = (url = "") => {
    const key = getApplicationFlowKey(url);
    if (!key) return;
    const flows = readDismissedFlows();
    flows[key] = Date.now();
    writeDismissedFlows(flows);
  };

  const isFlowDismissed = (url = "") => {
    const key = getApplicationFlowKey(url);
    if (!key) return false;
    const flows = readDismissedFlows();
    return Boolean(flows[key]);
  };

  const isValidHttpUrl = (value = "") => {
    const raw = toText(value);
    if (!raw) return false;

    try {
      const parsed = new URL(raw);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const getPayloadFromForm = (fields) => ({
    job_title: toText(fields.jobTitle?.value),
    company: toText(fields.jobCompany?.value),
    job_application_id: toText(fields.jobApplicationId?.value),
    job_link: toText(fields.jobLink?.value),
    notes: toText(fields.jobNotes?.value),
    keyword_match: toText(fields.keywordMatch?.value) || "Medium",
    referral_name: toText(fields.referralName?.value)
  });

  const createUi = () => {
    const widget = document.createElement("div");
    widget.id = "atriveo-widget";
    widget.innerHTML = `
      <button class="atriveo-float" id="atriveoLauncher" type="button" aria-label="Open Atriveo Assistant">
        <span class="atriveo-float-mark" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <circle cx="256" cy="256" r="256" fill="#0066FF"/>
            <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" style="font-family: Inter, 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: 900; letter-spacing: -0.02em; font-size: 250px; fill: #FFFFFF;">A.</text>
          </svg>
        </span>
      </button>
    `;

    const panel = document.createElement("aside");
    panel.id = "atriveoPanel";
    panel.className = "panel-container";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="panel-header">
        <div class="panel-header-brand">
          <div class="panel-logo-mark" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
              <circle cx="256" cy="256" r="256" fill="#0066FF"/>
              <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" style="font-family: Inter, 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: 900; letter-spacing: -0.02em; font-size: 250px; fill: #FFFFFF;">A.</text>
            </svg>
          </div>
          <div>
            <div class="panel-title">Atriveo Assistant</div>
            <div class="panel-subtitle">Capture this application quickly</div>
          </div>
        </div>
        <button class="panel-close" id="atriveoClose" type="button" aria-label="Close panel">&times;</button>
      </div>

      <div class="atriveo-field">
        <label class="atriveo-label" for="atriveoJobTitle">Job Title</label>
        <input id="atriveoJobTitle" class="atriveo-control" type="text" placeholder="e.g. Cyber Security Analyst" />
      </div>

      <div class="atriveo-grid-company">
        <div class="atriveo-field">
          <label class="atriveo-label" for="atriveoCompany">Company</label>
          <input id="atriveoCompany" class="atriveo-control" type="text" placeholder="e.g. Pimco" />
        </div>

        <div class="atriveo-field">
          <label class="atriveo-label" for="atriveoJobId">Job / App ID</label>
          <input id="atriveoJobId" class="atriveo-control" type="text" placeholder="Optional" />
        </div>
      </div>

      <div class="atriveo-field">
        <label class="atriveo-label" for="atriveoJobLink">Job Link</label>
        <input id="atriveoJobLink" class="atriveo-control" type="url" placeholder="https://..." />
      </div>

      <div class="atriveo-grid-2">
        <div class="atriveo-field">
          <label class="atriveo-label" for="atriveoKeywordMatch">Keyword Match</label>
          <select id="atriveoKeywordMatch" class="atriveo-control">
            <option value="Strong">Strong</option>
            <option value="Medium" selected>Medium</option>
            <option value="Weak">Weak</option>
          </select>
        </div>

        <div class="atriveo-field">
          <label class="atriveo-label" for="atriveoReferralName">Referral Name</label>
          <input id="atriveoReferralName" class="atriveo-control" type="text" placeholder="Optional" />
        </div>
      </div>

      <div class="atriveo-field">
        <label class="atriveo-label" for="atriveoNotes">Additional Information</label>
        <textarea id="atriveoNotes" class="atriveo-control" placeholder="Location, salary, ATS platform and other autofilled values appear here."></textarea>
      </div>

      <div class="section-divider"></div>

      <div class="actions-grid">
        <button id="atriveoRescanCard" class="action-tile" type="button" aria-label="Rescan">
          <span class="action-title">Rescan</span>
        </button>

        <button id="atriveoPrimaryCard" class="action-tile action-tile--primary" type="button" aria-label="Login or add application">
          <span id="atriveoPrimaryTitle" class="action-title">Login</span>
          <span id="atriveoPrimarySubtitle" class="action-subtitle-visually-hidden" aria-hidden="true"></span>
        </button>
      </div>

      <p id="atriveoStatus" class="atriveo-status" aria-live="polite"></p>
    `;

    document.documentElement.appendChild(widget);
    document.documentElement.appendChild(panel);

    return {
      widget,
      panel,
      launcher: widget.querySelector("#atriveoLauncher"),
      closeBtn: panel.querySelector("#atriveoClose"),
      rescanBtn: panel.querySelector("#atriveoRescanCard"),
      primaryBtn: panel.querySelector("#atriveoPrimaryCard"),
      primaryTitle: panel.querySelector("#atriveoPrimaryTitle"),
      primarySubtitle: panel.querySelector("#atriveoPrimarySubtitle"),
      statusEl: panel.querySelector("#atriveoStatus"),
      fields: {
        jobTitle: panel.querySelector("#atriveoJobTitle"),
        jobCompany: panel.querySelector("#atriveoCompany"),
        jobApplicationId: panel.querySelector("#atriveoJobId"),
        jobLink: panel.querySelector("#atriveoJobLink"),
        jobNotes: panel.querySelector("#atriveoNotes"),
        keywordMatch: panel.querySelector("#atriveoKeywordMatch"),
        referralName: panel.querySelector("#atriveoReferralName")
      }
    };
  };

  const ui = createUi();

  let authState = { authenticated: false, user: null };
  let actionInFlight = false;
  let currentRecord = null;
  let statusTimer = null;
  let dragState = {
    pointerId: null,
    startY: 0,
    originTop: 0,
    moved: false,
    active: false
  };

  const getWidgetTop = () => {
    const styleTop = Number.parseFloat(window.getComputedStyle(ui.widget).top || "72");
    if (Number.isFinite(styleTop)) return styleTop;
    return 72;
  };

  const clampWidgetTop = (value) => {
    const minTop = 12;
    const maxTop = Math.max(12, window.innerHeight - 72);
    return Math.min(maxTop, Math.max(minTop, value));
  };

  const beginDrag = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    dragState = {
      pointerId: event.pointerId,
      startY: event.clientY,
      originTop: getWidgetTop(),
      moved: false,
      active: true
    };

    ui.widget.classList.add("dragging");
    ui.launcher.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event) => {
    if (!dragState.active || dragState.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - dragState.startY;
    if (Math.abs(deltaY) > 3) dragState.moved = true;

    const nextTop = clampWidgetTop(dragState.originTop + deltaY);
    ui.widget.style.top = `${nextTop}px`;
  };

  const endDrag = (event) => {
    if (!dragState.active || dragState.pointerId !== event.pointerId) return;
    ui.widget.classList.remove("dragging");
    ui.launcher.releasePointerCapture(event.pointerId);

    const wasDragged = dragState.moved;
    dragState = {
      pointerId: null,
      startY: 0,
      originTop: 0,
      moved: false,
      active: false
    };

    if (!wasDragged) {
      void togglePanel();
    }
  };

  const setStatus = (message = "", type = "", autoClearMs = 0) => {
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }

    ui.statusEl.textContent = message;
    ui.statusEl.classList.remove("error", "success");
    if (type) ui.statusEl.classList.add(type);

    if (message && autoClearMs > 0) {
      statusTimer = setTimeout(() => {
        ui.statusEl.textContent = "";
        ui.statusEl.classList.remove("error", "success");
      }, autoClearMs);
    }
  };

  const hasSubmittablePayload = () => {
    const payload = getPayloadFromForm(ui.fields);
    return Boolean(payload.job_title && payload.company && payload.job_link && isValidHttpUrl(payload.job_link));
  };

  const updatePrimaryActionLabel = () => {
    if (authState.authenticated) {
      ui.primaryTitle.textContent = "Add Application";
      ui.primarySubtitle.textContent = "Submit to your Atriveo dashboard";
      return;
    }

    ui.primaryTitle.textContent = "Login";
    ui.primarySubtitle.textContent = "Connect your Atriveo web session";
  };

  const updateActionState = () => {
    ui.rescanBtn.disabled = actionInFlight;
    ui.primaryBtn.disabled = actionInFlight || (authState.authenticated && !hasSubmittablePayload());
    updatePrimaryActionLabel();
  };

  const hasAllFieldRefs = () =>
    Boolean(
      ui.fields.jobTitle &&
      ui.fields.jobCompany &&
      ui.fields.jobApplicationId &&
      ui.fields.jobLink &&
      ui.fields.jobNotes &&
      ui.fields.keywordMatch &&
      ui.fields.referralName
    );

  const renderPayload = (payload) => {
    if (!hasAllFieldRefs()) {
      setStatus("UI not ready. Please refresh the page.", "error", 4000);
      return;
    }

    const safePayload = payload || {};
    ui.fields.jobTitle.value = toText(safePayload.job_title);
    ui.fields.jobCompany.value = toText(safePayload.company);
    ui.fields.jobApplicationId.value = toText(safePayload.job_application_id);
    ui.fields.jobLink.value = toText(safePayload.job_link || currentUrl);
    ui.fields.jobNotes.value = toText(safePayload.notes);
    ui.fields.keywordMatch.value = toText(safePayload.keyword_match) || "Medium";
    ui.fields.referralName.value = toText(safePayload.referral_name);
    applyRequiredFieldHighlighting(getPayloadFromForm(ui.fields));
    updateActionState();
  };

  const refreshAuth = async () => {
    const response = await runtimeMessage({ type: "AUTH_STATUS", sync_web: true }).catch(() => ({
      ok: false,
      authenticated: false
    }));

    authState = response?.ok
      ? { authenticated: Boolean(response.authenticated), user: response.user || null }
      : { authenticated: false, user: null };

    updateActionState();
  };

  const persistDraft = async () => {
    const response = await runtimeMessage({
      type: "UPDATE_APPLICATION_DRAFT",
      url: currentUrl,
      application: getPayloadFromForm(ui.fields)
    }).catch(() => null);

    if (response?.ok && response.record) {
      currentRecord = response.record;
    }
  };

  const refreshFromPage = async () => {
    actionInFlight = false;
    updateActionState();
    setStatus("Scanning current job page...");

    const extraction = await runtimeMessage({ type: "RUN_EXTRACTION_FOR_TAB" }).catch((error) => ({
      ok: false,
      error: error.message
    }));

    await refreshAuth();

    if (!extraction?.ok) {
      setStatus(extraction?.error || "Unable to scan this page.", "error", 4500);
    }

    const stored = await runtimeMessage({ type: "GET_JOB_FOR_URL", url: currentUrl }).catch(() => null);
    currentRecord = stored?.record || extraction?.record || null;

    if (!currentRecord) {
      renderPayload({
        job_title: "",
        company: "",
        job_application_id: "",
        job_link: isValidHttpUrl(currentUrl) ? currentUrl : "",
        notes: "",
        keyword_match: "Medium",
        referral_name: ""
      });
      setStatus("Fill missing details and continue.");
      return;
    }

    renderPayload(currentRecord.new_application_payload || {});
    const payloadNow = getPayloadFromForm(ui.fields);
    const missingFields = getMissingRequiredFields(payloadNow);
    const confidence = toText(currentRecord?.extracted_job?.extraction_confidence).toLowerCase();

    if (missingFields.length > 0) {
      setStatus(`Partial extraction. Missing: ${missingFields.join(", ")}.`, "error");
      return;
    }

    if (confidence === "low") {
      setStatus(
        authState.authenticated
          ? "Low-confidence extraction. Please review before submit."
          : "Low-confidence extraction. Review details and login to submit."
      );
      return;
    }

    if (confidence === "medium") {
      setStatus(
        authState.authenticated
          ? "Review details once before submitting."
          : "Looks good. Login required to add application."
      );
      return;
    }

    setStatus(authState.authenticated ? "Ready to submit." : "Login required to add application.");
  };

  const handleLogin = async () => {
    actionInFlight = true;
    updateActionState();
    setStatus("Opening Atriveo login page...");

    const openResult = await runtimeMessage({ type: "OPEN_LOGIN_PAGE" }).catch((error) => ({
      ok: false,
      error: error.message
    }));

    if (!openResult?.ok) {
      setStatus(openResult?.error || "Unable to open login page.", "error", 4500);
      actionInFlight = false;
      updateActionState();
      return;
    }

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const syncResult = await runtimeMessage({ type: "SYNC_WEB_SESSION" }).catch(() => null);
      if (syncResult?.ok && syncResult.authenticated) {
        authState = { authenticated: true, user: syncResult.user || null };
        actionInFlight = false;
        updateActionState();
        setStatus("Logged in. You can now add application.", "success", 3200);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    actionInFlight = false;
    updateActionState();
    setStatus("Complete login on atriveo.com, then click Login again.", "error", 5200);
  };

  const validatePayload = (payload) => {
    if (!payload.job_title) return "Job Title is required.";
    if (!payload.company) return "Company is required.";
    if (!payload.job_link) return "Job Link is required.";
    if (!isValidHttpUrl(payload.job_link)) return "Job Link must be a valid URL.";
    return "";
  };

  const getMissingRequiredFields = (payload = {}) => {
    const missing = [];
    if (!toText(payload.job_title)) missing.push("Job Title");
    if (!toText(payload.company)) missing.push("Company");
    if (!toText(payload.job_link) || !isValidHttpUrl(payload.job_link)) missing.push("Job Link");
    return missing;
  };

  const applyRequiredFieldHighlighting = (payload = {}) => {
    const titleMissing = !toText(payload.job_title);
    const companyMissing = !toText(payload.company);
    const linkMissing = !toText(payload.job_link) || !isValidHttpUrl(payload.job_link);

    ui.fields.jobTitle?.classList.toggle("atriveo-control-missing", titleMissing);
    ui.fields.jobCompany?.classList.toggle("atriveo-control-missing", companyMissing);
    ui.fields.jobLink?.classList.toggle("atriveo-control-missing", linkMissing);
  };

  const handleSubmit = async () => {
    const applicationPayload = getPayloadFromForm(ui.fields);
    applyRequiredFieldHighlighting(applicationPayload);
    const validationError = validatePayload(applicationPayload);
    if (validationError) {
      setStatus(validationError, "error", 4500);
      return;
    }

    actionInFlight = true;
    updateActionState();
    setStatus("Adding application...");

    await persistDraft().catch(() => null);

    const response = await runtimeMessage({
      type: "SUBMIT_APPLICATION",
      url: currentUrl,
      keyword_match: applicationPayload.keyword_match,
      referral_name: applicationPayload.referral_name,
      application: applicationPayload
    }).catch((error) => ({ ok: false, error: error.message }));

    if (!response?.ok) {
      if (response?.unauthorized) {
        authState = { authenticated: false, user: null };
        actionInFlight = false;
        updateActionState();
        setStatus("Session expired. Login again.", "error", 4200);
        return;
      }

      if (response?.duplicate) {
        currentRecord = response.record || currentRecord;
        renderPayload(currentRecord?.new_application_payload || applicationPayload);
        actionInFlight = false;
        updateActionState();
        setStatus("Application added successfully.", "success", 3200);
        setTimeout(() => togglePanel(false), 1150);
        return;
      }

      actionInFlight = false;
      updateActionState();
      setStatus(response?.error || "Failed to add application.", "error", 5200);
      return;
    }

    currentRecord = response.record || currentRecord;
    renderPayload(currentRecord?.new_application_payload || applicationPayload);
    actionInFlight = false;
    updateActionState();
    setStatus("Application added successfully.", "success", 3200);
    setTimeout(() => togglePanel(false), 1150);
  };

  const togglePanel = async (open) => {
    const wasOpen = !ui.panel.hidden;
    const shouldOpen = typeof open === "boolean" ? open : ui.panel.hidden;

    if (!shouldOpen && wasOpen) {
      const payloadNow = getPayloadFromForm(ui.fields);
      const flowUrl = isValidHttpUrl(payloadNow.job_link) ? payloadNow.job_link : currentUrl;
      markFlowDismissed(flowUrl);
    }

    ui.panel.hidden = !shouldOpen;

    if (shouldOpen) {
      await refreshFromPage();
    }
  };

  ui.launcher.addEventListener("pointerdown", beginDrag);
  ui.launcher.addEventListener("pointermove", moveDrag);
  ui.launcher.addEventListener("pointerup", endDrag);
  ui.launcher.addEventListener("pointercancel", endDrag);

  window.addEventListener("resize", () => {
    const currentTop = getWidgetTop();
    ui.widget.style.top = `${clampWidgetTop(currentTop)}px`;
  });

  ui.closeBtn.addEventListener("click", () => {
    void togglePanel(false);
  });

  ui.rescanBtn.addEventListener("click", () => {
    void refreshFromPage();
  });

  ui.primaryBtn.addEventListener("click", () => {
    if (actionInFlight) return;
    if (!authState.authenticated) {
      void handleLogin();
      return;
    }
    void handleSubmit();
  });

  const onFormChange = () => {
    applyRequiredFieldHighlighting(getPayloadFromForm(ui.fields));
    void persistDraft();
    updateActionState();
  };

  Object.values(ui.fields).forEach((field) => {
    const eventName = field.tagName === "SELECT" ? "change" : "input";
    field.addEventListener(eventName, onFormChange);
  });

  // Auto-open on supported job pages so users can immediately review extracted data.
  if (isSupportedPage && !forceWidget && !isPostApplyConfirmationPage && !isFlowDismissed(currentUrl)) {
    void togglePanel(true);
  }

  // Allow the extension icon click (background.js) to toggle this panel.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "TOGGLE_PANEL") {
      void togglePanel();
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "AUTO_OPEN_PANEL") {
      if (ui.panel.hidden && !isPostApplyConfirmationPage && !isFlowDismissed(currentUrl)) {
        void togglePanel(true);
      }
      sendResponse({ ok: true });
    }
    return false;
  });
})();
