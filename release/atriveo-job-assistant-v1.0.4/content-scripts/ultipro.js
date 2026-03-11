(function registerUltiProExtractor() {
  window.AtriveoExtractors = window.AtriveoExtractors || {};

  const getLabelValue = (utils, labels = []) => {
    const targets = new Set(
      labels
        .map((label) => String(label || "").toLowerCase().replace(/:\s*$/, "").trim())
        .filter(Boolean)
    );

    const nodes = Array.from(document.querySelectorAll("th,td,dt,dd,strong,b,label,span,div,p"));
    for (const node of nodes) {
      const text = utils.normalizeText(node.textContent || "");
      if (!text) continue;

      const normalized = text.toLowerCase().replace(/:\s*$/, "").trim();
      const inline = text.match(/^([^:]{2,40}):\s*(.+)$/);
      if (inline) {
        const key = utils.normalizeText(inline[1] || "").toLowerCase().trim();
        const value = utils.normalizeText(inline[2] || "");
        if (targets.has(key) && value) return value;
      }

      if (!targets.has(normalized)) continue;

      const sibling = node.nextElementSibling;
      if (sibling) {
        const value = utils.normalizeText(sibling.textContent || "");
        if (value) return value;
      }

      const parent = node.parentElement;
      if (parent) {
        const children = Array.from(parent.children);
        const idx = children.indexOf(node);
        if (idx >= 0) {
          for (let i = idx + 1; i < children.length; i += 1) {
            const value = utils.normalizeText(children[i].textContent || "");
            if (value) return value;
          }
        }
      }
    }

    return "";
  };

  const getCompanyFromBrand = (utils) => {
    const fromImg = utils.getAttributeBySelectors(
      ["header img[alt]", ".header img[alt]", ".navbar img[alt]", "img[alt*='logo' i]"],
      "alt"
    );

    const fromText = utils.getTextBySelectors([
      "header [class*='logo']",
      "header [class*='brand']",
      ".header [class*='logo']",
      ".header [class*='brand']"
    ]);

    const fromMeta = utils.firstNonEmpty([
      utils.getMetaContent("og:site_name"),
      utils.getMetaContent("application-name")
    ]);

    const candidates = [fromImg, fromText, fromMeta];
    for (const candidate of candidates) {
      const cleaned = utils.cleanCompanyName(String(candidate || "").replace(/\s+careers?\b/i, ""));
      if (cleaned && !/^(ultipro|career|careers|job board)$/i.test(cleaned)) return cleaned;
    }

    return "";
  };

  const extractUltiPro = () => {
    const utils = window.AtriveoUtils;
    if (!utils) return null;

    const rawText = document.body.innerText || "";
    const pageText = utils.normalizeText(rawText);

    const jobTitle = utils.firstNonEmpty([
      utils.getTextBySelectors([
        "h1",
        ".opportunity-title",
        ".job-title",
        '[class*="opportunity"][class*="title"]',
        '[class*="job"][class*="title"]'
      ]),
      utils.getCapturedMatchFromText(rawText, [
        /^\s*([^\n\r]{4,120})\n\s*job\s+category\s*:/im
      ]),
      utils.stripLabelPrefix(utils.getMetaContent("og:title"), ["job", "opportunity", "careers"]),
      utils.stripLabelPrefix(document.title, ["job", "opportunity", "careers"])
    ]);

    const company = utils.firstNonEmpty([
      getCompanyFromBrand(utils),
      getLabelValue(utils, ["company", "employer"]),
      utils.cleanCompanyName("UltiPro Employer")
    ]);

    const location = utils.cleanLocation(
      utils.firstNonEmpty([
        getLabelValue(utils, ["location", "city", "office"]),
        utils.getCapturedMatchFromText(rawText, [/\b([A-Za-z .'-]{2,40},\s*[A-Za-z .'-]{2,40})\b/])
      ])
    );

    const jobId = utils.firstNonEmpty([
      getLabelValue(utils, ["requisition number", "requisition id", "job id", "req id"]),
      (() => {
        try {
          const parsed = new URL(window.location.href);
          return (
            parsed.searchParams.get("opportunityId") ||
            parsed.searchParams.get("opportunityid") ||
            parsed.searchParams.get("jobId") ||
            parsed.searchParams.get("jobid") ||
            ""
          );
        } catch {
          return "";
        }
      })(),
      utils.extractJobIdFromUrl()
    ]);

    const jobDescription = utils.firstNonEmpty([
      utils.getTextBySelectors([
        "#job-details",
        ".job-details",
        ".opportunity-details",
        "article",
        "main"
      ]),
      utils.getMetaContent("description")
    ]);

    if (!jobTitle || !company) return null;

    const salary = utils.parseSalaryFromText(pageText);
    const job = utils.makeJobObject({
      job_title: jobTitle,
      company,
      location,
      job_description: jobDescription,
      job_id: jobId,
      employment_type: utils.inferEmploymentType(pageText),
      job_type: utils.extractJobTypeFromText(pageText),
      salary_min: salary.salary_min,
      salary_max: salary.salary_max,
      salary_currency: salary.salary_currency,
      salary_period: salary.salary_period,
      location_type: utils.inferLocationType(pageText),
      department: utils.inferDepartment(pageText),
      notes: "",
      salary_source_text: pageText,
      url: window.location.href,
      ats_platform: "ultipro"
    });

    window.__ATRIVEO_CURRENT_JOB = job;
    chrome.runtime.sendMessage({ type: "JOB_EXTRACTED", payload: job }, () => {
      void chrome.runtime.lastError;
    });

    return job;
  };

  window.AtriveoExtractors.ultipro = extractUltiPro;
})();
