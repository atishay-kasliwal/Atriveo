(function registerLeverExtractor() {
  window.AtriveoExtractors = window.AtriveoExtractors || {};

  const extractLeverJob = () => {
    const utils = window.AtriveoUtils;
    if (!utils) return null;
    const pageText = utils.normalizeText(document.body.innerText || "");

    // Required selectors for Lever pages.
    const jobTitle = utils.firstNonEmpty([
      utils.getTextBySelectors([".posting-headline h2", ".posting-headline h1", ".posting-headline"]),
      utils.stripLabelPrefix(utils.getMetaContent("og:title"), ["job"]),
      utils.stripLabelPrefix(document.title, ["job"])
    ]);

    const company = utils.cleanCompanyName(
      utils.firstNonEmpty([
        utils.getAttributeBySelectors([".main-header-logo img", ".main-header img"], "alt"),
        utils.getTextBySelectors([
          ".posting-headline h3",
          ".posting-headline .company",
          ".main-header-logo",
          ".main-header"
        ]),
        utils.getMetaContent("og:site_name"),
        utils.getHostnameLabel()
      ])
    );

    const locationRaw = utils.firstNonEmpty([
      utils.getTextBySelectors([
        ".posting-categories .sort-by-location",
        ".posting-categories .location"
      ]),
      utils.getCapturedMatchFromText(pageText, [/\blocation\s*[:\-]?\s*([A-Za-z0-9,.\- ]{2,80})/i])
    ]);
    const location = utils.cleanLocation(locationRaw);

    const categoryText = utils.getTextBySelectors([".posting-categories"]);

    const department = utils.firstNonEmpty([
      utils.getTextBySelectors([
        ".posting-categories .sort-by-team",
        ".posting-categories .department",
        ".department"
      ]),
      utils.inferDepartment(`${categoryText} ${pageText}`)
    ]);

    const jobDescription = utils.firstNonEmpty([
      utils.getTextBySelectors([
        ".posting-page .section-wrapper",
        ".posting .content",
        ".posting .section",
        "main"
      ]),
      utils.getMetaContent("description")
    ]);

    const employmentType = utils.firstNonEmpty([
      utils.getTextBySelectors([
        ".posting-categories .sort-by-commitment",
        ".posting-categories .commitment",
        ".posting-categories .sort-by-employment-type"
      ]),
      utils.inferEmploymentType(categoryText),
      utils.inferEmploymentType(pageText)
    ]);

    const locationType = utils.firstNonEmpty([
      utils.getTextBySelectors([".posting-categories .workplaceTypes"]),
      utils.inferLocationType(locationRaw),
      utils.inferLocationType(categoryText),
      utils.inferLocationType(jobDescription)
    ]);

    const jobId = utils.firstNonEmpty([
      utils.getCapturedMatchFromText(pageText, [
        /\b(?:req(?:uisition)?\s*id|job\s*id)\s*[:#\-]?\s*([A-Za-z0-9-]{3,})\b/i
      ]),
      utils.getTextBySelectors([
        '[data-qa="job-id"]',
        '[data-qa="requisition-id"]',
        '[data-automation-id="jobPostingReqId"]'
      ]),
      utils.extractJobIdFromUrl()
    ]);

    const salaryText = utils.firstNonEmpty([
      utils.getTextBySelectors([".posting-categories .salary", ".posting .salary", ".compensation"]),
      categoryText
    ]);
    const salary = utils.parseSalaryFromText(`${salaryText} ${jobDescription} ${pageText}`);

    const jobType = utils.firstNonEmpty([
      utils.extractJobTypeFromText(`${categoryText} ${salaryText} ${pageText}`),
      employmentType
    ]);

    const applicationStatus = utils.cleanApplicationStatus(
      utils.getCapturedMatchFromText(pageText, [
        /\bapplication\s*status\s*[:\-]?\s*([A-Za-z ]{3,40})\b/i
      ])
    );

    if (!jobTitle && !jobDescription) return null;

    const job = utils.makeJobObject({
      job_title: jobTitle,
      company,
      location,
      job_description: jobDescription,
      job_id: jobId,
      employment_type: employmentType,
      job_type: jobType,
      salary_min: salary.salary_min,
      salary_max: salary.salary_max,
      salary_currency: salary.salary_currency,
      salary_period: salary.salary_period,
      application_status: applicationStatus,
      location_type: locationType,
      department,
      notes: "",
      salary_source_text: `${salaryText} ${categoryText} ${pageText}`,
      url: window.location.href,
      ats_platform: "lever"
    });

    window.__ATRIVEO_CURRENT_JOB = job;
    chrome.runtime.sendMessage({ type: "JOB_EXTRACTED", payload: job }, () => {
      void chrome.runtime.lastError;
    });

    return job;
  };

  window.AtriveoExtractors.lever = extractLeverJob;
})();
