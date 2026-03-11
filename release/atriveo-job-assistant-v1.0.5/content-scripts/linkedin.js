(function registerLinkedInExtractor() {
  window.AtriveoExtractors = window.AtriveoExtractors || {};

  const normalizeTitle = (utils, value = "") => {
    const raw = utils.normalizeText(String(value || ""));
    if (!raw) return "";

    const parts = raw
      .split("|")
      .map((part) => utils.normalizeText(part))
      .filter(Boolean);
    if (parts.length >= 2 && /^linkedin$/i.test(parts[parts.length - 1])) {
      return parts[0];
    }

    return raw
      .replace(/\s*\|\s*linkedin\s*$/i, "")
      .replace(/\s*-\s*linkedin\s*$/i, "")
      .trim();
  };

  const getCompanyFromCompanyLink = (utils) => {
    const links = Array.from(document.querySelectorAll('a[href*="/company/"]'));
    for (const link of links) {
      const text = utils.cleanCompanyName(link.textContent || "");
      if (text && !/^linkedin$/i.test(text)) return text;
    }
    return "";
  };

  const cleanCompany = (utils, value = "") => {
    const cleaned = utils.cleanCompanyName(value);
    if (!cleaned) return "";
    if (/^(hirer|recruiter|employer)$/i.test(cleaned)) return "";
    return cleaned;
  };

  const getLinkedInJobIdFromUrl = () => {
    try {
      const url = new URL(window.location.href);
      const pathMatch = url.pathname.match(/\/jobs\/view\/(\d+)/i);
      if (pathMatch?.[1]) return pathMatch[1];

      const queryId = url.searchParams.get("currentJobId") || url.searchParams.get("jobId");
      return String(queryId || "").trim();
    } catch {
      return "";
    }
  };

  const extractLinkedInJob = () => {
    const utils = window.AtriveoUtils;
    if (!utils) return null;

    const pageText = utils.normalizeText(document.body.innerText || "");

    const rawJobTitle = utils.firstNonEmpty([
      utils.getTextBySelectors([
        ".job-details-jobs-unified-top-card__job-title h1",
        ".job-details-jobs-unified-top-card__job-title",
        ".jobs-unified-top-card__job-title h1",
        ".jobs-unified-top-card__job-title",
        ".jobs-details-top-card__job-title",
        "h1.t-24.t-bold.inline",
        '[class*="jobs-unified-top-card__job-title"]',
        '[class*="job-title"]',
        "main h1"
      ]),
      utils.stripLabelPrefix(document.title, ["linkedin", "job"])
    ]);
    const jobTitle = normalizeTitle(utils, rawJobTitle);

    const company = cleanCompany(
      utils,
      utils.firstNonEmpty([
        getCompanyFromCompanyLink(utils),
        utils.getTextBySelectors([
          ".job-details-jobs-unified-top-card__company-name a",
          ".job-details-jobs-unified-top-card__company-name",
          ".jobs-unified-top-card__company-name a",
          ".jobs-unified-top-card__company-name",
          ".jobs-details-top-card__company-url",
          ".jobs-company__name",
          '[class*="company-name"] a',
          '[class*="company-name"]'
        ]),
        utils.getCapturedMatchFromText(document.body.innerText || "", [
          /\b([A-Za-z0-9 .,&'()-]{2,100})\s+is hiring\b/i
        ])
      ])
    );

    const location = utils.cleanLocation(
      utils.firstNonEmpty([
        utils.getTextBySelectors([
          ".job-details-jobs-unified-top-card__tertiary-description-container",
          ".jobs-unified-top-card__bullet",
          ".jobs-unified-top-card__primary-description-container",
          ".jobs-details-top-card__bullet"
        ]),
        utils.getCapturedMatchFromText(document.body.innerText || "", [
          /\b([A-Za-z .'-]{2,40},\s*[A-Za-z .'-]{2,40})\b/
        ])
      ])
    );

    const jobDescription = utils.firstNonEmpty([
      utils.getTextBySelectors([
        ".jobs-description-content__text",
        ".jobs-box__html-content",
        ".job-details-about-the-job-module__description",
        "#job-details"
      ]),
      utils.getMetaContent("description")
    ]);

    const jobId = utils.firstNonEmpty([
      getLinkedInJobIdFromUrl(),
      utils.getCapturedMatchFromText(document.body.innerText || "", [
        /\b(?:job\s*id|posting\s*id)\s*[:#\-]?\s*([0-9]{5,})\b/i
      ]),
      utils.extractJobIdFromUrl()
    ]);

    const employmentType = utils.firstNonEmpty([
      utils.getCapturedMatchFromText(document.body.innerText || "", [
        /\b(full[\s-]?time|part[\s-]?time|contract|internship|temporary)\b/i
      ]),
      utils.inferEmploymentType(pageText)
    ]);

    if (!jobTitle && !jobDescription) return null;

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
      ats_platform: "linkedin"
    });

    window.__ATRIVEO_CURRENT_JOB = job;
    chrome.runtime.sendMessage({ type: "JOB_EXTRACTED", payload: job }, () => {
      void chrome.runtime.lastError;
    });

    return job;
  };

  window.AtriveoExtractors.linkedin = extractLinkedInJob;
})();
