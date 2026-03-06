(function initAtriveoDetector() {
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
    { token: "clearcompany.com", platform: "clearcompany" }
  ];

  const getPlatform = (hostname) => {
    const host = (hostname || "").toLowerCase();
    for (const matcher of PLATFORM_MATCHERS) {
      if (host.includes(matcher.token)) return matcher.platform;
    }
    return "";
  };

  const runExtraction = () => {
    const platform = getPlatform(window.location.hostname);
    const extractors = window.AtriveoExtractors || {};
    const extractor = extractors[platform];

    if (!extractor) return null;

    try {
      const job = extractor();
      if (job) {
        window.__ATRIVEO_CURRENT_JOB = job;
      }
      return job;
    } catch (error) {
      console.error("[Atriveo] Extraction failed:", error);
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
