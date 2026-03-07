(function initAtriveoUtils() {
  const normalizeText = (value = "") => value.replace(/\s+/g, " ").trim();

  const firstNonEmpty = (values = []) => {
    for (const value of values) {
      const normalized = normalizeText(String(value || ""));
      if (normalized) return normalized;
    }
    return "";
  };

  const getTextBySelectors = (selectors = [], root = document) => {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      if (!node) continue;

      const text = normalizeText(node.innerText || node.textContent || "");
      if (text) return text;
    }
    return "";
  };

  const getTextListBySelectors = (selectors = [], root = document) => {
    const result = [];
    for (const selector of selectors) {
      const nodes = root.querySelectorAll(selector);
      for (const node of nodes) {
        const text = normalizeText(node.innerText || node.textContent || "");
        if (text && !result.includes(text)) {
          result.push(text);
        }
      }
    }
    return result;
  };

  const getAttributeBySelectors = (selectors = [], attribute = "", root = document) => {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      if (!node) continue;

      const value = normalizeText(node.getAttribute(attribute) || "");
      if (value) return value;
    }
    return "";
  };

  const getMetaContent = (name) => {
    if (!name) return "";

    const byName = document.querySelector(`meta[name="${name}"]`);
    if (byName) {
      const value = normalizeText(byName.getAttribute("content") || "");
      if (value) return value;
    }

    const byProperty = document.querySelector(`meta[property="${name}"]`);
    if (byProperty) {
      const value = normalizeText(byProperty.getAttribute("content") || "");
      if (value) return value;
    }

    return "";
  };

  const getFirstMatchFromText = (text = "", patterns = []) => {
    const source = String(text || "");
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match && match[0]) {
        return normalizeText(match[0]);
      }
    }
    return "";
  };

  const getCapturedMatchFromText = (text = "", patterns = []) => {
    const source = String(text || "");
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (!match) continue;

      if (match[1]) return normalizeText(match[1]);
      if (match[0]) return normalizeText(match[0]);
    }
    return "";
  };

  const stripLabelPrefix = (value = "", labels = []) => {
    let result = normalizeText(value);
    for (const label of labels) {
      const escaped = String(label || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!escaped) continue;

      const pattern = new RegExp(`^${escaped}\\s*[:\\-]?\\s*`, "i");
      result = result.replace(pattern, "");
    }
    return normalizeText(result);
  };

  const inferEmploymentType = (input = "") => {
    const text = normalizeText(String(input || "")).toLowerCase();
    if (!text) return "";

    const map = [
      { pattern: /\bfull[\s-]?time\b/, value: "Full-time" },
      { pattern: /\bpart[\s-]?time\b/, value: "Part-time" },
      { pattern: /\bcontract(or)?\b/, value: "Contract" },
      { pattern: /\bintern(ship)?\b/, value: "Internship" },
      { pattern: /\btemporary\b|\btemp\b/, value: "Temporary" },
      { pattern: /\bseasonal\b/, value: "Seasonal" },
      { pattern: /\bapprentice(ship)?\b/, value: "Apprenticeship" }
    ];

    for (const entry of map) {
      if (entry.pattern.test(text)) return entry.value;
    }

    return "";
  };

  const cleanCompanyName = (value = "") => {
    let text = normalizeText(value);
    text = text.replace(/^jobs?\s+at\s+/i, "");
    text = text.replace(/\s+[|:-]\s+careers?.*$/i, "");
    text = text.replace(/\s+[|:-]\s+jobs?.*$/i, "");
    return normalizeText(text);
  };

  const cleanLocation = (value = "") =>
    stripLabelPrefix(value, ["location", "locations", "city", "office"]);

  const normalizeCurrency = (value = "") => {
    const text = normalizeText(value).toUpperCase();
    const map = {
      "$": "USD",
      "USD": "USD",
      "US$": "USD",
      "€": "EUR",
      "EUR": "EUR",
      "£": "GBP",
      "GBP": "GBP",
      "₹": "INR",
      "INR": "INR",
      "CAD": "CAD",
      "AUD": "AUD",
      "CHF": "CHF",
      "JPY": "JPY"
    };

    return map[text] || (/[A-Z]{3}/.test(text) ? text : "");
  };

  const normalizePeriod = (value = "") => {
    const text = normalizeText(value).toLowerCase();
    if (!text) return "";
    if (/(year|yr|annual|annum)/.test(text)) return "year";
    if (/(month|mo)/.test(text)) return "month";
    if (/(week|wk)/.test(text)) return "week";
    if (/(day|daily)/.test(text)) return "day";
    if (/(hour|hr|hourly)/.test(text)) return "hour";
    return "";
  };

  const normalizeSalaryNumber = (value = "") => {
    const raw = normalizeText(String(value || "")).toLowerCase().replace(/[^0-9.k]/g, "");
    if (!raw) return "";

    const hasK = raw.includes("k");
    const numeric = parseFloat(raw.replace(/k/g, ""));
    if (!Number.isFinite(numeric)) return "";

    const amount = hasK ? numeric * 1000 : numeric;
    if (!Number.isFinite(amount) || amount <= 0) return "";

    if (amount % 1 === 0) return String(Math.round(amount));
    return amount.toFixed(2).replace(/\.?0+$/, "");
  };

  const inferCurrencyFromText = (text = "") => {
    const source = normalizeText(text);
    const codeMatch = source.match(/\b(USD|EUR|GBP|INR|CAD|AUD|CHF|JPY)\b/i);
    if (codeMatch) return normalizeCurrency(codeMatch[1]);

    const symbolMatch = source.match(/([$€£₹])/);
    if (symbolMatch) return normalizeCurrency(symbolMatch[1]);

    return "";
  };

  const inferPeriodFromText = (text = "") => {
    const source = normalizeText(text);
    const explicit = source.match(
      /\b(per\s*(year|yr|annual|annum|month|mo|week|wk|day|hour|hr)|\/\s*(year|yr|month|mo|week|wk|day|hour|hr)|annual(?:ly)?|yearly|monthly|weekly|daily|hourly)\b/i
    );
    return normalizePeriod(explicit ? explicit[0] : "");
  };

  const parseSalaryFromText = (input = "") => {
    const text = normalizeText(String(input || ""));
    if (!text) {
      return {
        salary_min: "",
        salary_max: "",
        salary_currency: "",
        salary_period: ""
      };
    }

    let salaryMin = "";
    let salaryMax = "";
    let salaryCurrency = "";
    let salaryPeriod = "";

    const minMatch = text.match(
      /\bmin(?:imum)?\.?\s*salary(?:\s*\([^)]+\))?\s*[:\-]?\s*([$€£₹]|USD|EUR|GBP|INR|CAD|AUD|CHF|JPY)?\s*([0-9][0-9,.\s]*k?)\b/i
    );
    if (minMatch) {
      salaryCurrency = normalizeCurrency(minMatch[1] || "");
      salaryMin = normalizeSalaryNumber(minMatch[2] || "");
    }

    const maxMatch = text.match(
      /\bmax(?:imum)?\.?\s*salary(?:\s*\([^)]+\))?\s*[:\-]?\s*([$€£₹]|USD|EUR|GBP|INR|CAD|AUD|CHF|JPY)?\s*([0-9][0-9,.\s]*k?)\b/i
    );
    if (maxMatch) {
      salaryCurrency = salaryCurrency || normalizeCurrency(maxMatch[1] || "");
      salaryMax = normalizeSalaryNumber(maxMatch[2] || "");
    }

    const rangeMatch = text.match(
      /\b(?:salary|compensation|pay|range)?\s*[:\-]?\s*([$€£₹]|USD|EUR|GBP|INR|CAD|AUD|CHF|JPY)\s*([0-9][0-9,.\s]*k?)\s*(?:-|to)\s*(?:[$€£₹]|USD|EUR|GBP|INR|CAD|AUD|CHF|JPY)?\s*([0-9][0-9,.\s]*k?)\b/i
    );
    if (rangeMatch) {
      salaryCurrency = salaryCurrency || normalizeCurrency(rangeMatch[1] || "");
      salaryMin = salaryMin || normalizeSalaryNumber(rangeMatch[2] || "");
      salaryMax = salaryMax || normalizeSalaryNumber(rangeMatch[3] || "");
    }

    if (!salaryMin && !salaryMax) {
      const singleMatch = text.match(
        /\b(?:salary|compensation|pay)\s*[:\-]?\s*([$€£₹]|USD|EUR|GBP|INR|CAD|AUD|CHF|JPY)?\s*([0-9][0-9,.\s]*k?)\b/i
      );
      if (singleMatch) {
        salaryCurrency = salaryCurrency || normalizeCurrency(singleMatch[1] || "");
        salaryMin = normalizeSalaryNumber(singleMatch[2] || "");
        salaryMax = salaryMin;
      }
    }

    const currencyLabel = text.match(/\bcurrency\s*[:\-]?\s*([A-Z]{3}|[$€£₹])\b/i);
    if (currencyLabel) {
      salaryCurrency = salaryCurrency || normalizeCurrency(currencyLabel[1] || "");
    }
    salaryCurrency = salaryCurrency || inferCurrencyFromText(text);

    const periodLabel = text.match(
      /\bperiod\s*[:\-]?\s*(year|yr|annual|annum|month|mo|week|wk|day|hour|hr)\b/i
    );
    if (periodLabel) {
      salaryPeriod = normalizePeriod(periodLabel[1] || "");
    }
    salaryPeriod = salaryPeriod || inferPeriodFromText(text);

    return {
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_currency: salaryCurrency,
      salary_period: salaryPeriod
    };
  };

  const extractJobTypeFromText = (text = "") => {
    const explicit = getCapturedMatchFromText(text, [
      /\bjob\s*type\s*[:\-]?\s*([A-Za-z/ -]{3,40})\b/i,
      /\bemployment\s*type\s*[:\-]?\s*([A-Za-z/ -]{3,40})\b/i,
      /\bworker\s*type\s*[:\-]?\s*([A-Za-z/ -]{3,40})\b/i
    ]);

    return normalizeText(explicit || inferEmploymentType(text));
  };

  const cleanApplicationStatus = (value = "") =>
    stripLabelPrefix(value, ["application status", "status"]);

  const makeJobObject = (fields = {}) => {
    const jobTitle = normalizeText(fields.job_title || fields.position_title || "");
    const jobDescription = normalizeText(fields.job_description || "");
    const salaryFallback = parseSalaryFromText(
      `${fields.salary_source_text || ""} ${jobDescription} ${jobTitle}`
    );

    const salaryMin = normalizeText(fields.salary_min || fields.min_salary || salaryFallback.salary_min);
    const salaryMax = normalizeText(fields.salary_max || fields.max_salary || salaryFallback.salary_max);
    const salaryCurrency = normalizeText(
      fields.salary_currency || fields.currency || salaryFallback.salary_currency
    );
    const salaryPeriod = normalizeText(
      fields.salary_period || fields.period || salaryFallback.salary_period
    );

    const employmentType =
      normalizeText(fields.employment_type || "") ||
      inferEmploymentType(`${jobDescription} ${jobTitle}`);
    const jobType =
      normalizeText(fields.job_type || "") ||
      extractJobTypeFromText(`${fields.salary_source_text || ""} ${jobDescription}`) ||
      employmentType;

    const url = normalizeText(fields.url || window.location.href);
    const applicationStatus = cleanApplicationStatus(fields.application_status || "");
    const notes = normalizeText(fields.notes || "");

    return {
      job_title: jobTitle,
      position_title: jobTitle,
      company: cleanCompanyName(fields.company || ""),
      location: cleanLocation(fields.location || ""),
      job_description: jobDescription,
      job_id: normalizeText(fields.job_id || ""),
      employment_type: employmentType,
      job_type: jobType,
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_currency: normalizeCurrency(salaryCurrency),
      salary_period: normalizePeriod(salaryPeriod),
      min_salary: salaryMin,
      max_salary: salaryMax,
      currency: normalizeCurrency(salaryCurrency),
      period: normalizePeriod(salaryPeriod),
      notes,
      application_status: applicationStatus || "Not Applied",
      url,
      job_posting_url: url,
      ats_platform: normalizeText(fields.ats_platform || "")
    };
  };

  const extractJobIdFromUrl = (href = window.location.href) => {
    try {
      const url = new URL(href);
      const fromQuery =
        url.searchParams.get("jobId") ||
        url.searchParams.get("job_id") ||
        url.searchParams.get("gh_jid");

      if (fromQuery) return normalizeText(fromQuery);

      let fallback = "";
      const segments = url.pathname.split("/").filter(Boolean).reverse();
      for (const segment of segments) {
        const cleaned = normalizeText(decodeURIComponent(segment));
        if (!cleaned) continue;
        if (/^(jobs?|careers?|posting|job)$/i.test(cleaned)) continue;

        // Prefer IDs that contain digits (e.g. R106021, 12345, DEV-9876).
        const embeddedId = cleaned.match(/\b([A-Za-z]*\d{3,}[A-Za-z0-9-]*)\b/);
        if (embeddedId?.[1]) {
          return normalizeText(embeddedId[1]);
        }

        // Workday-style slugs often contain title + "_" + requisition token.
        const underscoredParts = cleaned.split("_").filter(Boolean).reverse();
        for (const part of underscoredParts) {
          if (/\b[A-Za-z]*\d{3,}[A-Za-z0-9-]*\b/.test(part)) {
            return normalizeText(part);
          }
        }

        if (!fallback && /^[A-Za-z0-9_-]{3,}$/.test(cleaned)) {
          fallback = cleaned;
        }
      }

      return fallback;
    } catch (error) {
      console.debug("[Atriveo] Unable to parse URL for job ID", error);
    }

    return "";
  };

  const getHostnameLabel = () => {
    const host = (window.location.hostname || "").toLowerCase();
    const parts = host.split(".").filter(Boolean);
    const ignored = new Set(["www", "jobs", "job", "careers", "career"]);

    for (const part of parts) {
      if (
        !ignored.has(part) &&
        !part.includes("greenhouse") &&
        !part.includes("lever") &&
        !part.includes("myworkdayjobs")
      ) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }
    }

    const fallback = parts[0] || "";
    return fallback ? fallback.charAt(0).toUpperCase() + fallback.slice(1) : "";
  };

  window.AtriveoUtils = {
    cleanApplicationStatus,
    cleanCompanyName,
    cleanLocation,
    extractJobIdFromUrl,
    extractJobTypeFromText,
    firstNonEmpty,
    getAttributeBySelectors,
    getCapturedMatchFromText,
    getFirstMatchFromText,
    getHostnameLabel,
    getMetaContent,
    getTextBySelectors,
    getTextListBySelectors,
    inferEmploymentType,
    makeJobObject,
    normalizeCurrency,
    normalizePeriod,
    normalizeText,
    parseSalaryFromText,
    stripLabelPrefix
  };
})();
