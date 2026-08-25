(function registerGenericCareerExtractor() {
  window.AtriveoExtractors = window.AtriveoExtractors || {};

  const parseJsonLdJobPosting = () => {
    const scriptNodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));

    for (const scriptNode of scriptNodes) {
      const raw = String(scriptNode.textContent || "").trim();
      if (!raw) continue;

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.["@graph"])
          ? parsed["@graph"]
          : [parsed];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const type = String(item["@type"] || "").toLowerCase();
        if (!type.includes("jobposting")) continue;
        return item;
      }
    }

    return null;
  };

  const extractGenericCareerJob = () => {
    const utils = window.AtriveoUtils;
    if (!utils) return null;

    const pageText = utils.normalizeText(document.body?.innerText || "");
    const jsonLdJob = parseJsonLdJobPosting();

    const jobTitle = utils.firstNonEmpty([
      utils.firstNonEmpty([
        jsonLdJob?.title,
        jsonLdJob?.name
      ]),
      utils.getTextBySelectors([
        "h1",
        "[class*='job-title']",
        "[class*='position-title']",
        "[data-testid*='job-title']",
        "[data-automation-id*='jobTitle']"
      ]),
      utils.stripLabelPrefix(utils.getMetaContent("og:title"), ["careers", "job", "position"]),
      utils.stripLabelPrefix(document.title, ["careers", "job", "position"])
    ]);

    const orgName =
      jsonLdJob?.hiringOrganization?.name ||
      jsonLdJob?.hiringOrganization?.legalName ||
      jsonLdJob?.organization?.name;

    const company = utils.cleanCompanyName(
      utils.firstNonEmpty([
        orgName,
        utils.getTextBySelectors([
          "[class*='company']",
          "[data-testid*='company']",
          "[itemprop='hiringOrganization']"
        ]),
        utils.getMetaContent("og:site_name"),
        utils.getHostnameLabel(),
        utils.getCapturedMatchFromText(pageText, [
          /\b(?:company|employer|organization)\s*[:\-]?\s*([A-Za-z0-9 .,&'()-]{2,100})\b/i
        ])
      ])
    );

    const locationText =
      jsonLdJob?.jobLocation?.address?.addressLocality ||
      jsonLdJob?.jobLocation?.address?.streetAddress ||
      jsonLdJob?.jobLocation?.name ||
      (Array.isArray(jsonLdJob?.jobLocation)
        ? jsonLdJob.jobLocation
            .map((location) =>
              location?.address?.addressLocality ||
              location?.address?.addressRegion ||
              location?.name ||
              ""
            )
            .filter(Boolean)
            .join(", ")
        : "");

    const location = utils.cleanLocation(
      utils.firstNonEmpty([
        locationText,
        utils.getTextBySelectors([
          "[class*='location']",
          "[data-testid*='location']",
          "[data-automation-id*='location']"
        ]),
        utils.getCapturedMatchFromText(pageText, [
          /\blocations?\s*[:\-]?\s*([A-Za-z0-9,.\- ]{2,120})\b/i
        ])
      ])
    );

    const jobDescription = utils.firstNonEmpty([
      jsonLdJob?.description,
      utils.getTextBySelectors([
        "[class*='job-description']",
        "[id*='job-description']",
        "article",
        "main"
      ]),
      utils.getMetaContent("description")
    ]);

    const jobId = utils.firstNonEmpty([
      utils.firstNonEmpty([
        jsonLdJob?.identifier?.value,
        jsonLdJob?.identifier
      ]),
      utils.getCapturedMatchFromText(window.location.pathname, [
        /\/(?:jobs?|positions?|careers?|openings?|requisitions?)\/([^/?#]{3,})/i
      ]),
      utils.getCapturedMatchFromText(window.location.href, [
        /[?&#](?:jobId|job_id|gh_jid|opening|requisition|req_id)=([^&#]{3,})/i
      ]),
      utils.extractJobIdFromUrl()
    ]);

    const employmentType = utils.firstNonEmpty([
      utils.firstNonEmpty([
        jsonLdJob?.employmentType,
        Array.isArray(jsonLdJob?.employmentType) ? jsonLdJob.employmentType.join(", ") : ""
      ]),
      utils.getTextBySelectors([
        "[class*='employment-type']",
        "[class*='job-type']",
        "[data-testid*='employment']"
      ]),
      utils.inferEmploymentType(pageText)
    ]);

    const locationType = utils.firstNonEmpty([
      utils.firstNonEmpty([
        jsonLdJob?.jobLocationType,
        jsonLdJob?.workHours
      ]),
      utils.inferLocationType(location),
      utils.inferLocationType(jobDescription)
    ]);

    const department = utils.firstNonEmpty([
      utils.getTextBySelectors([
        "[class*='department']",
        "[data-testid*='department']",
        "[class*='team']"
      ]),
      utils.inferDepartment(pageText)
    ]);

    const salaryText = utils.normalizeText(
      [
        jsonLdJob?.baseSalary?.value?.minValue,
        jsonLdJob?.baseSalary?.value?.maxValue,
        jsonLdJob?.baseSalary?.currency,
        jsonLdJob?.baseSalary?.value?.unitText,
        jsonLdJob?.baseSalary?.value,
        pageText
      ]
        .filter(Boolean)
        .join(" ")
    );
    const salary = utils.parseSalaryFromText(salaryText);

    if (!jobTitle && !jobDescription) return null;

    const job = utils.makeJobObject({
      job_title: jobTitle,
      company,
      location,
      job_description: jobDescription,
      job_id: jobId,
      employment_type: employmentType,
      job_type: employmentType,
      salary_min: salary.salary_min,
      salary_max: salary.salary_max,
      salary_currency: salary.salary_currency,
      salary_period: salary.salary_period,
      location_type: locationType,
      department,
      notes: "Fallback extractor: generic career page",
      url: window.location.href,
      ats_platform: "genericcareer"
    });

    const confidence = [
      Boolean(job.job_title),
      Boolean(job.company),
      Boolean(job.url),
      Boolean(job.job_description),
      Boolean(job.location)
    ].filter(Boolean).length;

    job.extraction_confidence = confidence >= 4 ? "high" : confidence >= 3 ? "medium" : "low";

    window.__ATRIVEO_CURRENT_JOB = job;
    chrome.runtime.sendMessage({ type: "JOB_EXTRACTED", payload: job }, () => {
      void chrome.runtime.lastError;
    });

    return job;
  };

  window.AtriveoExtractors.genericcareer = extractGenericCareerJob;
})();
