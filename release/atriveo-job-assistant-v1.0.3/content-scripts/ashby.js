(function registerAshbyExtractor() {
  window.AtriveoExtractors = window.AtriveoExtractors || {};

  const readAppData = () => {
    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const text = String(script.textContent || "");
      const marker = "window.__appData";
      const startIndex = text.indexOf(marker);
      if (startIndex === -1) continue;

      // Find the opening brace after the assignment.
      const braceStart = text.indexOf("{", startIndex + marker.length);
      if (braceStart === -1) continue;

      // Use brace counting to find the matching closing brace.
      let depth = 0;
      let braceEnd = -1;
      for (let i = braceStart; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === "{") {
          depth += 1;
        } else if (ch === "}") {
          depth -= 1;
          if (depth === 0) {
            braceEnd = i;
            break;
          }
        }
      }

      if (braceEnd === -1) continue;

      try {
        return JSON.parse(text.slice(braceStart, braceEnd + 1));
      } catch {
        continue;
      }
    }
    return null;
  };

  const readJsonLdJobPosting = () => {
    const scripts = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]')
    );
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
        const types = Array.isArray(item["@type"])
          ? item["@type"]
          : [item["@type"]];
        const isJobPosting = types.some(
          (t) => String(t || "").toLowerCase() === "jobposting"
        );
        if (isJobPosting) return item;
      }
    }
    return null;
  };

  const asText = (value) => {
    const text = String(value || "").trim();
    return text === "-" ? "" : text;
  };

  const titleCase = (value = "") => {
    const text = asText(value);
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const normalizeEmploymentType = (value = "") => {
    const raw = asText(value).toLowerCase();
    if (!raw) return "";
    if (raw === "fulltime" || raw === "full_time" || raw === "full-time")
      return "Full-time";
    if (raw === "parttime" || raw === "part_time" || raw === "part-time")
      return "Part-time";
    if (raw === "contract" || raw === "contractor") return "Contract";
    if (raw === "internship" || raw === "intern") return "Internship";
    if (raw === "temporary" || raw === "temp") return "Temporary";
    return titleCase(value);
  };

  const getCompanyFromUrl = () => {
    try {
      const segments = window.location.pathname.split("/").filter(Boolean);
      if (segments.length >= 1) {
        const slug = segments[0];
        // Skip UUID-like segments and generic path parts.
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(slug)) return "";
        if (/^(jobs?|careers?|posting|apply)$/i.test(slug)) return "";
        return titleCase(slug.replace(/[-_]+/g, " "));
      }
    } catch {
      // ignore
    }
    return "";
  };

  const getCompanyFromTitle = () => {
    const title = asText(document.title);
    const match = title.match(/@\s+(.+)$/);
    if (match && match[1]) return asText(match[1]);
    return "";
  };

  const getJsonLdCompany = (posting = {}) => {
    const org = posting.hiringOrganization;
    if (!org) return "";
    if (typeof org === "string") return org;
    return asText(org.name);
  };

  const getJsonLdLocation = (posting = {}) => {
    const locations = Array.isArray(posting.jobLocation)
      ? posting.jobLocation
      : posting.jobLocation
        ? [posting.jobLocation]
        : [];

    const values = locations
      .map((item) => {
        if (!item) return "";
        if (typeof item === "string") return item;
        const address = item.address || {};
        const parts = [
          address.addressLocality,
          address.addressRegion,
          address.addressCountry
        ]
          .map((v) => asText(v))
          .filter(Boolean);
        if (parts.length > 0) return parts.join(", ");
        return asText(item.name);
      })
      .filter(Boolean);

    return values.join(" | ");
  };

  const extractAshbyJob = () => {
    const utils = window.AtriveoUtils;
    if (!utils) return null;

    const appData = readAppData();
    const jsonLd = readJsonLdJobPosting();

    const org = appData?.organization || {};
    const posting = appData?.posting || {};

    // --- Job Title ---
    const jobTitle = utils.firstNonEmpty([
      asText(posting.title),
      asText(jsonLd?.title || jsonLd?.name),
      utils.getTextBySelectors(["h1"]),
      utils.stripLabelPrefix(utils.getMetaContent("og:title"), [
        "job",
        "position"
      ]),
      utils.stripLabelPrefix(document.title, ["job", "position"])
    ]);

    // --- Company ---
    const company = utils.cleanCompanyName(
      utils.firstNonEmpty([
        asText(org.name),
        getJsonLdCompany(jsonLd || {}),
        getCompanyFromTitle(),
        getCompanyFromUrl(),
        utils.getMetaContent("og:site_name"),
        utils.getHostnameLabel()
      ])
    );

    // --- Location ---
    const location = utils.cleanLocation(
      utils.firstNonEmpty([
        asText(posting.locationName || posting.locationExternalName),
        getJsonLdLocation(jsonLd || {}),
        utils.getTextBySelectors([
          ".location",
          ".job-location",
          '[data-testid*="location"]'
        ])
      ])
    );

    // --- Employment Type ---
    const rawEmploymentType = utils.firstNonEmpty([
      asText(posting.employmentType),
      asText(jsonLd?.employmentType)
    ]);
    const employmentType = normalizeEmploymentType(rawEmploymentType);

    // --- Location Type (Hybrid / Remote / On-site) ---
    const locationTypeRaw = asText(posting.workplaceType);
    const locationType = titleCase(locationTypeRaw);

    // --- Department ---
    const department = utils.firstNonEmpty([
      asText(posting.departmentName || posting.departmentExternalName),
      asText(posting.teamName || posting.teamExternalName)
    ]);

    // --- Job Description ---
    const jobDescription = utils.firstNonEmpty([
      asText(posting.descriptionPlainText),
      utils.getTextBySelectors([
        "#job-description",
        ".job-description",
        ".description",
        "main"
      ]),
      utils.getMetaContent("description")
    ]);

    // --- Job ID ---
    // Ashby uses UUIDs internally. Only use jobRequisitionId if it's meaningful
    // (not just "1" or a single digit).
    const reqId = asText(posting.jobRequisitionId);
    const jobId = reqId && reqId.length > 2 ? reqId : "";

    // --- Salary ---
    const pageText = utils.normalizeText(document.body.innerText || "");
    const salary = utils.parseSalaryFromText(
      `${jobDescription} ${pageText}`
    );

    // --- Job Type ---
    const jobType = utils.firstNonEmpty([
      utils.extractJobTypeFromText(pageText),
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
      salary_source_text: `${jobDescription} ${pageText}`,
      url: window.location.href,
      ats_platform: "ashby"
    });

    window.__ATRIVEO_CURRENT_JOB = job;
    chrome.runtime.sendMessage(
      { type: "JOB_EXTRACTED", payload: job },
      () => {
        void chrome.runtime.lastError;
      }
    );

    return job;
  };

  window.AtriveoExtractors.ashby = extractAshbyJob;
})();
