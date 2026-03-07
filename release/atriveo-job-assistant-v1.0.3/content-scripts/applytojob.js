(function registerApplyToJobExtractor() {
  window.AtriveoExtractors = window.AtriveoExtractors || {};

  const safeDecodeURIComponent = (value = "") => {
    try {
      return decodeURIComponent(String(value || ""));
    } catch {
      return String(value || "");
    }
  };

  const slugToLabel = (value = "") => {
    const decoded = safeDecodeURIComponent(value)
      .replace(/\+/g, " ")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return decoded;
  };

  const toMoneyString = (value) => {
    if (value === null || value === undefined || value === "") return "";
    const numeric = Number(String(value).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(numeric) || numeric <= 0) return "";
    return String(Math.round(numeric));
  };

  const readJsonLdJobPosting = () => {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const script of scripts) {
      const raw = String(script.textContent || "").trim();
      if (!raw) continue;

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      const candidates = [];
      if (Array.isArray(parsed)) {
        candidates.push(...parsed);
      } else if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed["@graph"])) {
          candidates.push(...parsed["@graph"]);
        } else {
          candidates.push(parsed);
        }
      }

      for (const item of candidates) {
        if (!item || typeof item !== "object") continue;
        const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
        const hasJobPostingType = types.some(
          (entry) => String(entry || "").toLowerCase() === "jobposting"
        );
        if (hasJobPostingType) return item;
      }
    }
    return null;
  };

  const getJsonLdLocation = (posting = {}) => {
    const normalizeLocationItem = (item) => {
      if (!item) return "";
      if (typeof item === "string") return item;

      const address = item.address || {};
      const parts = [
        address.addressLocality,
        address.addressRegion,
        address.addressCountry
      ]
        .map((entry) => String(entry || "").trim())
        .filter(Boolean);

      if (parts.length > 0) return parts.join(", ");
      return String(item.name || "").trim();
    };

    const locations = Array.isArray(posting.jobLocation)
      ? posting.jobLocation
      : posting.jobLocation
        ? [posting.jobLocation]
        : [];

    const values = locations.map((item) => normalizeLocationItem(item)).filter(Boolean);
    return values.join(" | ");
  };

  const getJsonLdCompany = (posting = {}) => {
    const org = posting.hiringOrganization;
    if (!org) return "";
    if (typeof org === "string") return org;
    return String(org.name || "").trim();
  };

  const getJsonLdJobId = (posting = {}) => {
    const identifier = posting.identifier;
    if (!identifier) return "";
    if (typeof identifier === "string" || typeof identifier === "number") {
      return String(identifier).trim();
    }
    return String(identifier.value || identifier.name || "").trim();
  };

  const getJsonLdSalary = (posting = {}, utils) => {
    const empty = {
      salary_min: "",
      salary_max: "",
      salary_currency: "",
      salary_period: ""
    };

    const baseSalary = posting.baseSalary;
    if (!baseSalary || typeof baseSalary !== "object") return empty;

    const value = baseSalary.value && typeof baseSalary.value === "object"
      ? baseSalary.value
      : baseSalary;
    const salaryMin = toMoneyString(value.minValue ?? value.value);
    const salaryMax = toMoneyString(value.maxValue ?? value.value ?? value.minValue);
    const salaryCurrency = utils.normalizeCurrency(baseSalary.currency || value.currency || "");
    const salaryPeriod = utils.normalizePeriod(value.unitText || value.unitCode || "");

    return {
      salary_min: salaryMin,
      salary_max: salaryMax || salaryMin,
      salary_currency: salaryCurrency,
      salary_period: salaryPeriod
    };
  };

  const extractApplyToJob = () => {
    const utils = window.AtriveoUtils;
    if (!utils) return null;

    const pageText = utils.normalizeText(document.body.innerText || "");
    const detailText = utils.getTextListBySelectors([
      ".job-details",
      ".job-detail",
      ".job-meta",
      ".job-info",
      ".position-meta",
      ".application-meta",
      '[data-testid*="job"]',
      '[class*="job-detail"]',
      '[class*="job-meta"]'
    ]).join(" ");

    const parsedUrl = new URL(window.location.href);
    const segments = parsedUrl.pathname.split("/").filter(Boolean);
    const applyIndex = segments.findIndex((part) => part.toLowerCase() === "apply");
    const pathJobId = applyIndex >= 0 ? slugToLabel(segments[applyIndex + 1] || "") : "";
    const pathJobTitle = applyIndex >= 0 ? slugToLabel(segments[applyIndex + 2] || "") : "";
    const queryJobTitle = utils.firstNonEmpty([
      parsedUrl.searchParams.get("position"),
      parsedUrl.searchParams.get("role"),
      parsedUrl.searchParams.get("title"),
      parsedUrl.searchParams.get("jobTitle")
    ]);
    const queryJobId = utils.firstNonEmpty([
      parsedUrl.searchParams.get("jobId"),
      parsedUrl.searchParams.get("job_id"),
      parsedUrl.searchParams.get("id")
    ]);

    const jsonLdPosting = readJsonLdJobPosting();
    const jsonLdTitle = String(jsonLdPosting?.title || jsonLdPosting?.name || "").trim();
    const jsonLdCompany = getJsonLdCompany(jsonLdPosting || {});
    const jsonLdLocation = getJsonLdLocation(jsonLdPosting || {});
    const jsonLdDescription = String(jsonLdPosting?.description || "").trim();
    const jsonLdEmploymentType = Array.isArray(jsonLdPosting?.employmentType)
      ? jsonLdPosting.employmentType.join(", ")
      : String(jsonLdPosting?.employmentType || "").trim();
    const jsonLdJobId = getJsonLdJobId(jsonLdPosting || {});
    const jsonLdSalary = getJsonLdSalary(jsonLdPosting || {}, utils);

    const titleFromText = utils.getCapturedMatchFromText(pageText, [
      /\b(?:position\s*title|job\s*title|role)\s*[:\-]?\s*([A-Za-z0-9 .,&'()\/+-]{3,120})\b/i,
      /\bapply\s+for\s+([A-Za-z0-9 .,&'()\/+-]{3,120})\b/i
    ]);

    const jobTitle = utils.firstNonEmpty([
      utils.getTextBySelectors([
        "h1.job-title",
        "h1.position-title",
        ".job-title",
        ".position-title",
        '[data-testid*="job-title"]',
        '[class*="jobTitle"]',
        '[class*="positionTitle"]',
        "h1"
      ]),
      jsonLdTitle,
      pathJobTitle,
      queryJobTitle,
      utils.stripLabelPrefix(utils.getMetaContent("og:title"), ["job", "apply", "position"]),
      utils.stripLabelPrefix(document.title, ["job", "apply", "position"]),
      titleFromText
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
        jsonLdCompany,
        utils.getCapturedMatchFromText(pageText, [
          /\b(?:company|employer)\s*[:\-]?\s*([A-Za-z0-9 .,&'()-]{2,100})\b/i
        ]),
        utils.getMetaContent("og:site_name"),
        utils.getHostnameLabel()
      ])
    );

    const locationRaw = utils.firstNonEmpty([
      utils.getTextBySelectors([
        ".location",
        ".job-location",
        ".position-location",
        '[data-testid*="location"]',
        '[class*="location"]',
        ".resumator-job-location",
        ".resumator-location"
      ]),
      jsonLdLocation,
      utils.getCapturedMatchFromText(pageText, [
        /\blocations?\s*[:\-]?\s*([A-Za-z0-9,.\- ]{2,100})\b/i
      ])
    ]);
    const location = utils.cleanLocation(locationRaw);

    const department = utils.firstNonEmpty([
      utils.getTextBySelectors([
        ".department",
        ".job-department",
        ".resumator-department",
        '[data-testid*="department"]',
        '[class*="department"]'
      ]),
      utils.inferDepartment(`${detailText} ${pageText}`)
    ]);

    const jobDescription = utils.firstNonEmpty([
      utils.getTextBySelectors([
        "#job-description",
        ".job-description",
        ".position-description",
        ".description",
        "main"
      ]),
      jsonLdDescription,
      utils.getMetaContent("description")
    ]);

    const jobId = utils.firstNonEmpty([
      queryJobId,
      pathJobId,
      jsonLdJobId,
      utils.getCapturedMatchFromText(pageText, [
        /\b(?:req(?:uisition)?\s*id|job\s*id|posting\s*id)\s*[:#\-]?\s*([A-Za-z0-9_-]{3,})\b/i
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
      jsonLdEmploymentType,
      utils.inferEmploymentType(`${detailText} ${pageText}`)
    ]);

    const locationType = utils.firstNonEmpty([
      utils.inferLocationType(locationRaw),
      utils.inferLocationType(detailText),
      utils.inferLocationType(jobDescription)
    ]);

    const parsedSalary = utils.parseSalaryFromText(`${detailText} ${jobDescription} ${pageText}`);
    const salary = {
      salary_min: parsedSalary.salary_min || jsonLdSalary.salary_min,
      salary_max: parsedSalary.salary_max || jsonLdSalary.salary_max,
      salary_currency: parsedSalary.salary_currency || jsonLdSalary.salary_currency,
      salary_period: parsedSalary.salary_period || jsonLdSalary.salary_period
    };

    const jobType = utils.firstNonEmpty([
      utils.extractJobTypeFromText(`${detailText} ${pageText}`),
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
      salary_source_text: `${detailText} ${pageText}`,
      url: window.location.href,
      ats_platform: "applytojob"
    });

    window.__ATRIVEO_CURRENT_JOB = job;
    chrome.runtime.sendMessage({ type: "JOB_EXTRACTED", payload: job }, () => {
      void chrome.runtime.lastError;
    });

    return job;
  };

  window.AtriveoExtractors.applytojob = extractApplyToJob;
})();
