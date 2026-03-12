(function registerGenericAtsExtractors() {
  window.AtriveoExtractors = window.AtriveoExtractors || {};

  const GENERIC_PLATFORMS = [
    "smartrecruiters",
    "icims",
    "jobvite",
    "bamboohr",
    "jazzhr",
    "taleo",
    "successfactors",
    "adp",
    "paylocity",
    "teamtailor",
    "recruitee",
    "workable",
    "jobscore",
    "clearcompany",
    "avature"
  ];

  const extractGenericAtsJob = (atsPlatform) => {
    const utils = window.AtriveoUtils;
    if (!utils) return null;

    const pageText = utils.normalizeText(document.body.innerText || "");
    const metaText = utils.getTextListBySelectors([
      ".job-meta",
      ".job-details",
      ".job-info",
      ".posting-meta",
      ".position-meta",
      '[class*="job-meta"]',
      '[class*="job-detail"]',
      '[class*="job-info"]',
      '[data-testid*="job"]'
    ]).join(" ");

    const jobTitle = utils.firstNonEmpty([
      utils.getTextBySelectors([
        "h1.job-title",
        "h1.position-title",
        ".job-title",
        ".position-title",
        '[data-testid*="job-title"]',
        '[data-automation-id*="jobTitle"]',
        "h1"
      ]),
      utils.stripLabelPrefix(utils.getMetaContent("og:title"), ["job", "position", "careers"]),
      utils.stripLabelPrefix(document.title, ["job", "position", "careers"]),
      utils.getCapturedMatchFromText(pageText, [
        /\b(?:position\s*title|job\s*title|role)\s*[:\-]?\s*([A-Za-z0-9 .,&'()\/+-]{3,120})\b/i
      ])
    ]);

    const company = utils.cleanCompanyName(
      utils.firstNonEmpty([
        utils.getTextBySelectors([
          ".company-name",
          ".company",
          ".employer",
          '[data-testid*="company"]',
          '[class*="company"]'
        ]),
        utils.getMetaContent("og:site_name"),
        utils.getCapturedMatchFromText(pageText, [
          /\b(?:company|employer)\s*[:\-]?\s*([A-Za-z0-9 .,&'()-]{2,100})\b/i
        ]),
        utils.getHostnameLabel()
      ])
    );

    const locationRaw = utils.firstNonEmpty([
      utils.getTextBySelectors([
        ".location",
        ".job-location",
        ".position-location",
        '[data-testid*="location"]',
        '[class*="location"]'
      ]),
      utils.getCapturedMatchFromText(pageText, [
        /\blocations?\s*[:\-]?\s*([A-Za-z0-9,.\- ]{2,120})\b/i
      ])
    ]);
    const location = utils.cleanLocation(locationRaw);

    const department = utils.firstNonEmpty([
      utils.getTextBySelectors([
        ".department",
        ".job-department",
        ".team",
        '[data-testid*="department"]',
        '[class*="department"]'
      ]),
      utils.inferDepartment(`${metaText} ${pageText}`)
    ]);

    const jobDescription = utils.firstNonEmpty([
      utils.getTextBySelectors([
        "#job-description",
        ".job-description",
        ".position-description",
        ".description",
        "article",
        "main"
      ]),
      utils.getMetaContent("description")
    ]);

    const jobId = utils.firstNonEmpty([
      utils.getCapturedMatchFromText(window.location.pathname, [
        /\/(?:jobs?|job|positions?|requisition|requisitions|apply)\/([^/?#]+)/i
      ]),
      utils.getCapturedMatchFromText(pageText, [
        /\b(?:req(?:uisition)?\s*id|job\s*id|posting\s*id|opening\s*id)\s*[:#\-]?\s*([A-Za-z0-9_-]{3,})\b/i
      ]),
      utils.extractJobIdFromUrl()
    ]);

    const employmentType = utils.firstNonEmpty([
      utils.getTextBySelectors([
        ".employment-type",
        ".job-type",
        ".position-type",
        '[data-testid*="employment"]',
        '[class*="employment"]'
      ]),
      utils.inferEmploymentType(`${metaText} ${pageText}`)
    ]);

    const locationType = utils.firstNonEmpty([
      utils.inferLocationType(locationRaw),
      utils.inferLocationType(metaText),
      utils.inferLocationType(jobDescription)
    ]);

    const salary = utils.parseSalaryFromText(`${metaText} ${jobDescription} ${pageText}`);
    const jobType = utils.firstNonEmpty([
      utils.extractJobTypeFromText(`${metaText} ${pageText}`),
      employmentType
    ]);

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
      location_type: locationType,
      department,
      notes: "",
      salary_source_text: `${metaText} ${pageText}`,
      url: window.location.href,
      ats_platform: atsPlatform
    });

    window.__ATRIVEO_CURRENT_JOB = job;
    chrome.runtime.sendMessage({ type: "JOB_EXTRACTED", payload: job }, () => {
      void chrome.runtime.lastError;
    });

    return job;
  };

  for (const platform of GENERIC_PLATFORMS) {
    window.AtriveoExtractors[platform] = () => extractGenericAtsJob(platform);
  }
})();
