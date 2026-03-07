(function registerNjoynExtractor() {
  window.AtriveoExtractors = window.AtriveoExtractors || {};

  const getLabelValue = (utils, labels = []) => {
    const labelSet = new Set(
      labels
        .map((label) => String(label || "").toLowerCase().replace(/:\s*$/, "").trim())
        .filter(Boolean)
    );

    const nodes = Array.from(document.querySelectorAll("th,td,dt,dd,strong,b,label,span,div,p"));

    for (const node of nodes) {
      const raw = utils.normalizeText(node.textContent || "");
      if (!raw) continue;

      const normalizedRaw = raw.toLowerCase().replace(/:\s*$/, "").trim();

      const inline = raw.match(/^([^:]{2,40}):\s*(.+)$/);
      if (inline) {
        const key = utils.normalizeText(inline[1] || "").toLowerCase().trim();
        const value = utils.normalizeText(inline[2] || "");
        if (labelSet.has(key) && value) return value;
      }

      if (!labelSet.has(normalizedRaw)) continue;

      const sibling = node.nextElementSibling;
      if (sibling) {
        const value = utils.normalizeText(sibling.textContent || "");
        if (value) return value;
      }

      const parent = node.parentElement;
      if (parent) {
        const children = Array.from(parent.children);
        const index = children.indexOf(node);
        if (index >= 0) {
          for (let i = index + 1; i < children.length; i += 1) {
            const value = utils.normalizeText(children[i].textContent || "");
            if (value) return value;
          }
        }
      }
    }

    return "";
  };

  const extractCompanyFromBrand = (utils) => {
    const candidates = [
      utils.getMetaContent("og:site_name"),
      utils.getMetaContent("application-name"),
      utils.getAttributeBySelectors(["header img[alt]", "img[alt*='careers' i]", "img[alt*='jobs' i]"], "alt"),
      utils.getTextBySelectors(["header .logo", "header [class*='logo']", "header [id*='logo']", "header a", "header h1"]),
      utils.getCapturedMatchFromText(document.body.innerText || "", [
        /\b([A-Za-z0-9&.,' -]{2,80})\s+careers\b/i
      ])
    ];

    for (const candidate of candidates) {
      const cleaned = utils.cleanCompanyName(String(candidate || "").replace(/\s+careers\b/i, "").trim());
      if (cleaned && !/^careers?$/i.test(cleaned)) return cleaned;
    }

    return "";
  };

  const extractNjoyn = () => {
    const utils = window.AtriveoUtils;
    if (!utils) return null;

    const pageText = utils.normalizeText(document.body.innerText || "");

    const jobTitle = utils.firstNonEmpty([
      getLabelValue(utils, ["title", "job title", "position title", "role"]),
      utils.getTextBySelectors(["h1", ".job-title", ".position-title"]),
      utils.getCapturedMatchFromText(document.body.innerText || "", [
        /\btitle\s*:\s*([^\n\r]{3,140})/i,
        /\bposition\s*title\s*:\s*([^\n\r]{3,140})/i
      ])
    ]);

    const company = utils.firstNonEmpty([
      getLabelValue(utils, ["company", "employer"]),
      extractCompanyFromBrand(utils)
    ]);

    const location = utils.cleanLocation(
      utils.firstNonEmpty([
        getLabelValue(utils, ["location", "city", "office"]),
        utils.getCapturedMatchFromText(document.body.innerText || "", [
          /\blocation\s*:\s*([^\n\r]{2,120})/i
        ])
      ])
    );

    const jobId = utils.firstNonEmpty([
      getLabelValue(utils, ["position id", "job id", "requisition id", "req id"]),
      (() => {
        try {
          const parsedUrl = new URL(window.location.href);
          return parsedUrl.searchParams.get("jobid") || parsedUrl.searchParams.get("jobId") || "";
        } catch {
          return "";
        }
      })(),
      utils.extractJobIdFromUrl()
    ]);

    const jobDescription = utils.firstNonEmpty([
      utils.getTextBySelectors(["main", "article", ".job-description", "#job-description"]),
      pageText
    ]);

    if (!jobTitle && !jobDescription) return null;

    const job = utils.makeJobObject({
      job_title: jobTitle,
      company,
      location,
      job_description: jobDescription,
      job_id: jobId,
      employment_type: utils.inferEmploymentType(pageText),
      job_type: utils.extractJobTypeFromText(pageText),
      location_type: utils.inferLocationType(pageText),
      department: utils.inferDepartment(pageText),
      notes: "",
      salary_source_text: pageText,
      url: window.location.href,
      ats_platform: "njoyn"
    });

    window.__ATRIVEO_CURRENT_JOB = job;
    chrome.runtime.sendMessage({ type: "JOB_EXTRACTED", payload: job }, () => {
      void chrome.runtime.lastError;
    });

    return job;
  };

  window.AtriveoExtractors.njoyn = extractNjoyn;
})();
