(function initAtriveoDetector() {
  const MAX_EXTRACTION_ATTEMPTS = 12;
  let extractionAttempts = 0;
  let extractorRequestInFlight = false;
  let ensuredPlatform = "";

  const PLATFORM_MATCHERS = [
    { token: "myworkdayjobs", platform: "workday" },
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
    { token: "ultipro.com", platform: "ultipro" },
    { token: "jobright.ai", platform: "jobright" }
  ];

  const CAREER_PATH_PATTERN =
    /\b(careers?|jobs?|job-details?|positions?|openings?|opportunities|requisition|vacanc(?:y|ies)|apply)\b/i;
  const CAREER_QUERY_PATTERN = /(?:jobId|job_id|gh_jid|lever-source|opening|requisition|req_id)=/i;

  const isLikelyCareerPage = () => {
    const pathname = String(window.location.pathname || "");
    const href = String(window.location.href || "");
    const title = String(document.title || "");
    const bodyText = String(document.body?.innerText || "").slice(0, 2400);

    if (CAREER_PATH_PATTERN.test(pathname)) return true;
    if (CAREER_QUERY_PATTERN.test(href)) return true;
    if (/\b(careers?|jobs?|job opening|job description|requisition)\b/i.test(title)) return true;

    return /\b(apply now|job title|requisition id|employment type|hiring|career site)\b/i.test(bodyText);
  };

  const getPlatform = (hostname) => {
    const host = (hostname || "").toLowerCase();
    for (const matcher of PLATFORM_MATCHERS) {
      if (host.includes(matcher.token)) return matcher.platform;
    }

    if (isLikelyCareerPage()) return "genericcareer";
    return "";
  };

  const ensureExtractorLoaded = (platform) => {
    const normalizedPlatform = String(platform || "").toLowerCase();
    if (!normalizedPlatform) return;
    if (ensuredPlatform === normalizedPlatform || extractorRequestInFlight) return;

    extractorRequestInFlight = true;
    chrome.runtime.sendMessage(
      { type: "ENSURE_PLATFORM_EXTRACTOR", platform: normalizedPlatform },
      (response) => {
        extractorRequestInFlight = false;
        if (response?.ok && response?.ensured) {
          ensuredPlatform = normalizedPlatform;
          scheduleExtraction(40);
        }
      }
    );
  };

  const runExtraction = () => {
    const platform = getPlatform(window.location.hostname);
    const extractors = window.AtriveoExtractors || {};
    const extractor = extractors[platform];

    if (!extractor) {
      ensureExtractorLoaded(platform);
      return null;
    }

    ensuredPlatform = platform;

    try {
      const job = extractor();
      const hasCoreFields = Boolean(
        (job?.job_title || job?.position_title) &&
        job?.company &&
        (job?.url || job?.job_posting_url)
      );

      if (job && hasCoreFields) {
        extractionAttempts = 0;
        window.__ATRIVEO_CURRENT_JOB = job;
        return job;
      }

      // Keep retrying if extractor returned incomplete data.
      window.__ATRIVEO_CURRENT_JOB = null;
      if (extractionAttempts < MAX_EXTRACTION_ATTEMPTS) {
        extractionAttempts += 1;
        const delay = Math.min(1200, 120 + extractionAttempts * 80);
        scheduleExtraction(delay);
      }
      return null;
    } catch (error) {
      console.error("[Atriveo] Extraction failed:", error);
      if (extractionAttempts < MAX_EXTRACTION_ATTEMPTS) {
        extractionAttempts += 1;
        const delay = Math.min(1200, 140 + extractionAttempts * 90);
        scheduleExtraction(delay);
      }
      return null;
    }
  };

  let extractionTimer = null;
  const scheduleExtraction = (delayMs = 250) => {
    if (extractionTimer) {
      clearTimeout(extractionTimer);
    }

    extractionTimer = setTimeout(() => {
      extractionTimer = null;
      runExtraction();
    }, delayMs);
  };

  const boot = () => {
    if (!getPlatform(window.location.hostname)) return;
    extractionAttempts = 0;
    ensuredPlatform = "";
    extractorRequestInFlight = false;
    runExtraction();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  // Supports ATS pages that re-render content after client-side navigation.
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      extractionAttempts = 0;
      ensuredPlatform = "";
      extractorRequestInFlight = false;
      scheduleExtraction(50);
      return;
    }

    if (!window.__ATRIVEO_CURRENT_JOB) {
      scheduleExtraction();
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "GET_CURRENT_JOB") {
      sendResponse({ job: window.__ATRIVEO_CURRENT_JOB || null });
      return;
    }

    if (message?.type === "RUN_EXTRACTION") {
      const extracted = runExtraction();
      sendResponse({ job: extracted || window.__ATRIVEO_CURRENT_JOB || null });
    }
  });
})();
