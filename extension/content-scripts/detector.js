(function initAtriveoDetector() {
  const getPlatform = (hostname) => {
    const host = (hostname || "").toLowerCase();
    if (host.includes("myworkdayjobs")) return "workday";
    if (host.includes("greenhouse.io")) return "greenhouse";
    if (host.includes("lever.co")) return "lever";
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
