(function registerAmazonJobsExtractor() {
  window.AtriveoExtractors = window.AtriveoExtractors || {};

  const firstMatching = (candidates = [], validator = null) => {
    for (const candidate of candidates) {
      const value = String(candidate || "").trim();
      if (!value) continue;
      if (validator && !validator(value)) continue;
      return value;
    }
    return "";
  };

  const isLikelyCompany = (value = "") => {
    const text = String(value || "").trim();
    if (!text) return false;
    if (/^(job details?|description|location|apply now)$/i.test(text)) return false;
    if (/^\d+$/.test(text)) return false;
    return true;
  };

  const extractAmazonJobs = () => {
    const utils = window.AtriveoUtils;
    if (!utils) return null;

    const rawText = document.body.innerText || "";
    const pageText = utils.normalizeText(rawText);

    const subtitleText = firstMatching([
      utils.getTextBySelectors([
        ".job-detail-header__secondary-description",
        ".job-details .subtitle",
        ".title-and-id",
        '[class*="secondary-description"]',
        '[class*="job-id"]'
      ]),
      utils.getCapturedMatchFromText(rawText, [
        /\bjob\s*id\s*:\s*[^\n\r]{4,220}/i
      ])
    ]);

    const titleFromPath = (() => {
      try {
        const url = new URL(window.location.href);
        const pathMatch = url.pathname.match(/\/jobs\/\d+\/([^/?#]+)/i);
        if (!pathMatch?.[1]) return "";
        return decodeURIComponent(pathMatch[1]).replace(/[-_]+/g, " ").trim();
      } catch {
        return "";
      }
    })();

    const jobTitle = firstMatching([
      utils.getTextBySelectors([
        "h1.job-title",
        ".job-detail-header h1",
        ".title h1",
        "h1"
      ]),
      utils.stripLabelPrefix(utils.getMetaContent("og:title"), ["job", "amazon jobs"]),
      utils.stripLabelPrefix(document.title, ["job", "amazon jobs"]),
      titleFromPath
    ]);

    const company = utils.cleanCompanyName(
      firstMatching(
        [
          utils.getCapturedMatchFromText(subtitleText, [
            /\|\s*([^|]{2,120}?)(?:\s*-\s*[A-Za-z0-9]+)?$/i
          ]),
          utils.getCapturedMatchFromText(rawText, [
            /\bjob\s*id\s*:\s*\d+\s*\|\s*([^\n\r|]{2,120}?)(?:\s*-\s*[A-Za-z0-9]+)?(?:\n|\r|$)/i
          ]),
          utils.getCapturedMatchFromText(rawText, [
            /\bcompany\s*[:\-]?\s*([A-Za-z0-9 .,&'()-]{2,120})\b/i
          ]),
          "Amazon"
        ],
        isLikelyCompany
      )
    );

    const location = utils.cleanLocation(
      utils.firstNonEmpty([
        utils.getTextBySelectors([
          ".location-and-id .location",
          ".job-detail-location",
          ".location",
          '[data-testid*="location"]',
          '[class*="location"]'
        ]),
        utils.getCapturedMatchFromText(rawText, [
          /\b([A-Za-z .'-]{2,40},\s*[A-Za-z .'-]{2,40})\b/
        ])
      ])
    );

    const jobId = firstMatching([
      (() => {
        try {
          const url = new URL(window.location.href);
          const match = url.pathname.match(/\/jobs\/(\d+)/i);
          if (match?.[1]) return match[1];
          return "";
        } catch {
          return "";
        }
      })(),
      utils.getCapturedMatchFromText(subtitleText, [
        /\bjob\s*id\s*:\s*(\d{4,})\b/i
      ]),
      utils.getCapturedMatchFromText(rawText, [
        /\bjob\s*id\s*:\s*(\d{4,})\b/i
      ]),
      utils.extractJobIdFromUrl()
    ]);

    const jobDescription = utils.firstNonEmpty([
      utils.getTextBySelectors([
        "#job-detail-body",
        ".job-detail-body",
        ".description",
        "article",
        "main"
      ]),
      utils.getMetaContent("description")
    ]);

    const employmentType = utils.firstNonEmpty([
      utils.getCapturedMatchFromText(pageText, [
        /\b(full[\s-]?time|part[\s-]?time|contract|internship|temporary)\b/i
      ]),
      utils.inferEmploymentType(pageText)
    ]);

    // Keep trying until we have core details instead of storing half-empty payloads.
    if (!jobTitle || !company || !jobId) return null;

    const salary = utils.parseSalaryFromText(pageText);
    const job = utils.makeJobObject({
      job_title: jobTitle,
      company,
      location,
      job_description: jobDescription,
      job_id: jobId,
      employment_type: employmentType,
      job_type: utils.extractJobTypeFromText(pageText) || employmentType,
      salary_min: salary.salary_min,
      salary_max: salary.salary_max,
      salary_currency: salary.salary_currency,
      salary_period: salary.salary_period,
      location_type: utils.inferLocationType(pageText),
      department: utils.inferDepartment(pageText),
      notes: "",
      salary_source_text: pageText,
      url: window.location.href,
      ats_platform: "amazonjobs"
    });

    window.__ATRIVEO_CURRENT_JOB = job;
    chrome.runtime.sendMessage({ type: "JOB_EXTRACTED", payload: job }, () => {
      void chrome.runtime.lastError;
    });

    return job;
  };

  window.AtriveoExtractors.amazonjobs = extractAmazonJobs;
})();
