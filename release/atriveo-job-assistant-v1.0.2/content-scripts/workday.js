(function registerWorkdayExtractor() {
  window.AtriveoExtractors = window.AtriveoExtractors || {};

  const extractWorkdayJob = () => {
    const utils = window.AtriveoUtils;
    if (!utils) return null;
    const pageText = utils.normalizeText(document.body.innerText || "");

    // Workday pages consistently expose data-automation-id attributes.
    const jobTitle = utils.firstNonEmpty([
      utils.getTextBySelectors([
        '[data-automation-id="jobPostingHeader"]',
        '[data-automation-id="jobPostingTitle"]',
        "h1[data-automation-id]"
      ]),
      utils.stripLabelPrefix(utils.getMetaContent("og:title"), ["job details", "job"]),
      utils.stripLabelPrefix(document.title, ["job details", "job"])
    ]);

    const company = utils.cleanCompanyName(
      utils.firstNonEmpty([
        utils.getTextBySelectors([
          '[data-automation-id="companyName"]',
          '[data-automation-id="brandName"]',
          '[data-automation-id="recruitingCompany"]'
        ]),
        utils.getCapturedMatchFromText(pageText, [
          /\bcompany\s*[:\-]?\s*([A-Za-z0-9 .,&'()-]{2,100})\b/i
        ]),
        utils.getMetaContent("og:site_name"),
        utils.getHostnameLabel()
      ])
    );

    const locationRaw = utils.firstNonEmpty([
      utils.getTextBySelectors([
        '[data-automation-id="jobPostingLocation"]',
        '[data-automation-id="locations"]',
        '[data-automation-id="primaryLocation"]'
      ]),
      utils.getCapturedMatchFromText(pageText, [
        /\blocations?\s*[:\-]?\s*([A-Za-z0-9,.\- ]{2,80})/i
      ])
    ]);
    const location = utils.cleanLocation(locationRaw);

    const department = utils.firstNonEmpty([
      utils.getTextBySelectors([
        '[data-automation-id="jobCategory"]',
        '[data-automation-id="jobFamily"]',
        '[data-automation-id="jobFamilyGroup"]'
      ]),
      utils.getCapturedMatchFromText(pageText, [
        /\b(?:job\s+category|job\s+family(?:group)?)\s*[:\-]?\s*([A-Za-z0-9 &/-]{2,40})/i
      ]),
      utils.inferDepartment(pageText)
    ]);

    const jobDescription = utils.firstNonEmpty([
      utils.getTextBySelectors([
        '[data-automation-id="jobPostingDescription"]',
        '[data-automation-id="jobDescription"]',
        '[data-automation-id="description"]'
      ]),
      utils.getMetaContent("description"),
      utils.getTextBySelectors(["main"])
    ]);

    const reqIdText = utils.firstNonEmpty([
      utils.getTextBySelectors([
        '[data-automation-id="jobPostingReqId"]',
        '[data-automation-id="requisitionId"]',
        '[data-automation-id="jobReqId"]'
      ]),
      utils.getCapturedMatchFromText(pageText, [
        /\b(?:job\s+requisition\s+id|requisition\s+id|req(?:uisition)?(?:\s+id)?)\s*[:#\-]?\s*([A-Za-z0-9_-]{3,})\b/i
      ]),
      utils.getFirstMatchFromText(pageText, [/\b(?:REQ|JR|R)-?\d{3,}\b/i]),
      utils.extractJobIdFromUrl()
    ]);
    const jobId = utils.firstNonEmpty([
      utils.getCapturedMatchFromText(reqIdText, [/\b([A-Za-z]*\d{3,}[A-Za-z0-9-]*)\b/]),
      utils.getCapturedMatchFromText(reqIdText, [/_([A-Za-z0-9-]{3,})\b/]),
      utils.getCapturedMatchFromText(reqIdText, [/\b([A-Za-z0-9_-]{3,})\b/])
    ]);

    const employmentType = utils.firstNonEmpty([
      utils.getTextBySelectors([
        '[data-automation-id="jobPostingWorkerType"]',
        '[data-automation-id="timeType"]',
        '[data-automation-id="jobPostingTimeType"]',
        '[data-automation-id="jobPostingSchedule"]'
      ]),
      utils.getCapturedMatchFromText(pageText, [
        /\b(?:worker\s+type|employment\s+type|time\s+type|schedule)\s*[:\-]?\s*([A-Za-z/ -]{3,40})\b/i
      ]),
      utils.inferEmploymentType(pageText)
    ]);

    const locationType = utils.firstNonEmpty([
      utils.getTextBySelectors([
        '[data-automation-id="flexibleWorkFormat"]',
        '[data-automation-id="remoteType"]',
        '[data-automation-id="jobPostingLocationType"]'
      ]),
      utils.inferLocationType(locationRaw),
      utils.inferLocationType(jobDescription)
    ]);

    const salaryText = utils.getTextListBySelectors([
      '[data-automation-id*="salary"]',
      '[data-automation-id*="compensation"]',
      '[data-automation-id*="pay"]',
      '[data-automation-id*="minimum"]',
      '[data-automation-id*="maximum"]'
    ]).join(" ");
    const salary = utils.parseSalaryFromText(`${salaryText} ${pageText}`);

    const jobType = utils.firstNonEmpty([
      utils.getTextBySelectors([
        '[data-automation-id="jobPostingWorkerType"]',
        '[data-automation-id="timeType"]',
        '[data-automation-id="jobPostingTimeType"]'
      ]),
      utils.extractJobTypeFromText(`${salaryText} ${pageText}`),
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
      salary_source_text: `${salaryText} ${pageText}`,
      url: window.location.href,
      ats_platform: "workday"
    });

    window.__ATRIVEO_CURRENT_JOB = job;
    chrome.runtime.sendMessage({ type: "JOB_EXTRACTED", payload: job }, () => {
      void chrome.runtime.lastError;
    });

    return job;
  };

  window.AtriveoExtractors.workday = extractWorkdayJob;
})();
