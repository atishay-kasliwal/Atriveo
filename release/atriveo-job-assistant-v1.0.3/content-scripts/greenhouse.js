(function registerGreenhouseExtractor() {
  window.AtriveoExtractors = window.AtriveoExtractors || {};

  const extractGreenhouseJob = () => {
    const utils = window.AtriveoUtils;
    if (!utils) return null;
    const pageText = utils.normalizeText(document.body.innerText || "");

    // Required selectors for Greenhouse pages.
    const jobTitle = utils.firstNonEmpty([
      utils.getTextBySelectors([".greenhouse-job-title", "h1.app-title", "h1"]),
      utils.stripLabelPrefix(utils.getMetaContent("og:title"), ["job"]),
      utils.stripLabelPrefix(document.title, ["job"])
    ]);

    const companyRaw = utils.firstNonEmpty([
      utils.getTextBySelectors([
        ".company-name",
        ".app-title + .company-name",
        ".app-header .company"
      ]),
      utils.getCapturedMatchFromText(document.title, [/at\s+(.+)$/i]),
      utils.getMetaContent("og:site_name"),
      utils.getHostnameLabel()
    ]);

    const company = utils.cleanCompanyName(companyRaw);

    const department = utils.firstNonEmpty([
      utils.getTextBySelectors([".department"]),
      utils.getCapturedMatchFromText(companyRaw, [/(.+?)\s+at\s+/i]),
      utils.inferDepartment(`${utils.getTextBySelectors([".breadcrumb"])} ${pageText}`)
    ]);

    const locationRaw = utils.firstNonEmpty([
      utils.getTextBySelectors([".location", ".location-name", ".app-header .location"]),
      utils.getCapturedMatchFromText(pageText, [/\blocation\s*[:\-]?\s*([A-Za-z0-9,.\- ]{2,80})/i])
    ]);
    const location = utils.cleanLocation(locationRaw);

    const jobDescription = utils.firstNonEmpty([
      utils.getTextBySelectors(["#content", "#job-description", ".job__description", "main"]),
      utils.getMetaContent("description")
    ]);

    const jobId = utils.firstNonEmpty([
      utils.getCapturedMatchFromText(pageText, [
        /\b(?:req(?:uisition)?\s*id|job\s*id)\s*[:#\-]?\s*([A-Za-z0-9-]{3,})\b/i
      ]),
      utils.extractJobIdFromUrl()
    ]);

    const metaItems = utils.getTextListBySelectors([
      ".content-meta li",
      ".job-meta li",
      ".opening .location",
      ".employment-type"
    ]);
    const employmentType = utils.firstNonEmpty([
      ...metaItems.filter((entry) => /(full|part|contract|intern|temporary|seasonal)/i.test(entry)),
      utils.inferEmploymentType(metaItems.join(" ")),
      utils.inferEmploymentType(pageText)
    ]);

    const locationType = utils.firstNonEmpty([
      utils.inferLocationType(locationRaw),
      utils.inferLocationType(metaItems.join(" ")),
      utils.inferLocationType(jobDescription)
    ]);

    const salaryText = utils.firstNonEmpty([
      utils.getTextBySelectors([
        ".salary",
        ".compensation",
        ".pay-range",
        ".opening .salary"
      ]),
      metaItems.join(" ")
    ]);
    const salary = utils.parseSalaryFromText(`${salaryText} ${jobDescription} ${pageText}`);

    const jobType = utils.firstNonEmpty([
      utils.getCapturedMatchFromText(metaItems.join(" "), [
        /\bjob\s*type\s*[:\-]?\s*([A-Za-z/ -]{3,40})\b/i,
        /\bemployment\s*type\s*[:\-]?\s*([A-Za-z/ -]{3,40})\b/i
      ]),
      utils.extractJobTypeFromText(`${salaryText} ${metaItems.join(" ")} ${pageText}`),
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
      salary_source_text: `${salaryText} ${metaItems.join(" ")} ${pageText}`,
      url: window.location.href,
      ats_platform: "greenhouse"
    });

    window.__ATRIVEO_CURRENT_JOB = job;
    chrome.runtime.sendMessage({ type: "JOB_EXTRACTED", payload: job }, () => {
      void chrome.runtime.lastError;
    });

    return job;
  };

  window.AtriveoExtractors.greenhouse = extractGreenhouseJob;
})();
