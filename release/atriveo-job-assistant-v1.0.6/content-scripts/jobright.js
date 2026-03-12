(function registerJobRightExtractor() {
  window.AtriveoExtractors = window.AtriveoExtractors || {};

  const extractJobRightJob = () => {
    const utils = window.AtriveoUtils;
    if (!utils) return null;

    // JobRight job page structure analysis based on common patterns
    const pageText = utils.normalizeText(document.body?.innerText || "");

    // Job Title Extraction
    const jobTitle = utils.firstNonEmpty([
      // Try primary heading
      utils.getTextBySelectors([
        "h1",
        "[data-testid='job-title']",
        "[class*='JobTitle']",
        "[class*='job-header'] h1",
        "[class*='position-title']"
      ]),
      // Try meta tags
      utils.stripLabelPrefix(utils.getMetaContent("og:title"), ["jobright", "job", "position"]),
      // Try structured data
      utils.getCapturedMatchFromText(pageText, [
        /^([A-Za-z0-9\s\-\/\(\)&.,]{5,100}?)(?:\s*[-–]|at\s|job|position)/i
      ])
    ]);

    // Company Name Extraction
    const company = utils.cleanCompanyName(
      utils.firstNonEmpty([
        // Try company link/section
        utils.getTextBySelectors([
          "a[href*='/company/']",
          "[data-testid='company-name']",
          "[class*='company-name']",
          "[class*='CompanyName']",
          "[class*='company'] a"
        ]),
        // Try meta tags
        utils.getMetaContent("og:site_name"),
        // Try page structure patterns
        utils.getCapturedMatchFromText(pageText, [
          /company\s*[:\-]?\s*([A-Za-z0-9 .,&'()-]{2,80})/i,
          /(?:apply to|job at|hiring for)\s+([A-Za-z0-9 .,&'()-]{2,80})/i
        ]),
        // Fallback
        utils.getHostnameLabel()
      ])
    );

    // Location Extraction
    const location = utils.firstNonEmpty([
      // Try location badge
      utils.getTextBySelectors([
        "[data-testid='job-location']",
        "[class*='JobLocation']",
        "[class*='location'] span",
        "[class*='Location']",
        "[itemprop='jobLocation']"
      ]),
      // Try inline text patterns
      utils.getCapturedMatchFromText(pageText, [
        /(?:location|place|based in|located in)\s*[:\-]?\s*([A-Za-z0-9\s,\-\/]+?)(?:\n|\s{2,}|•|,(?!\s*\d))/i
      ])
    ]);

    // Salary Extraction
    const salary = utils.firstNonEmpty([
      // Try salary tag/badge
      utils.getTextBySelectors([
        "[data-testid='salary']",
        "[class*='Salary']",
        "[class*='salary'] span",
        "[class*='compensation']"
      ]),
      // Try inline patterns
      utils.getCapturedMatchFromText(pageText, [
        /(?:salary|comp|compensation)\s*[:\-]?\s*(\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*\/\s*(?:year|yr|hour|hr))?)/i,
        /(\$[\d,]+(?:\s*-\s*\$[\d,]+)?)\s*(?:per\s)?(?:year|yr|hour|hr|pa|annually)/i
      ])
    ]);

    // Employment Type Extraction
    const employmentType = utils.firstNonEmpty([
      utils.getTextBySelectors([
        "[data-testid='employment-type']",
        "[class*='EmploymentType']",
        "[class*='employment-type']",
        "[class*='job-type']"
      ]),
      utils.getCapturedMatchFromText(pageText, [
        /(?:employment\s+type|job\s+type)\s*[:\-]?\s*(Full-?Time|Part-?Time|Contract|Temporary|Internship|Freelance)/i
      ])
    ]);

    // Experience Level Extraction
    const experienceLevel = utils.firstNonEmpty([
      utils.getTextBySelectors([
        "[data-testid='experience-level']",
        "[class*='ExperienceLevel']",
        "[class*='experience-level']",
        "[class*='seniority']"
      ]),
      utils.getCapturedMatchFromText(pageText, [
        /(?:level|seniority|experience)\s*[:\-]?\s*(Entry|Entry-Level|Mid-?Level|Senior|Executive|Lead|Manager)/i
      ])
    ]);

    // Job Description Extraction
    const jobDescription = utils.firstNonEmpty([
      utils.getTextBySelectors([
        "[data-testid='job-description']",
        "[class*='JobDescription']",
        "[class*='job-description']",
        "article",
        "main"
      ]),
      document.body?.innerText || ""
    ]);

    // Job URL (current page)
    const jobUrl = window.location.href;

    // Extract job ID from URL if available
    const jobIdMatch = window.location.href.match(/\/jobs\/info\/([a-f0-9]+)/);
    const jobId = jobIdMatch ? jobIdMatch[1] : null;

    // Confidence scoring
    let confidence = 0;
    if (jobTitle) confidence++;
    if (company && company !== utils.getHostnameLabel()) confidence++;
    if (location) confidence++;
    if (salary) confidence++;
    if (employmentType) confidence++;
    if (jobDescription && jobDescription.length > 100) confidence++;

    const job = {
      job_title: jobTitle || null,
      company: company || null,
      location: location || null,
      salary: salary || null,
      employment_type: employmentType || null,
      experience_level: experienceLevel || null,
      job_description: jobDescription || null,
      url: jobUrl,
      job_id: jobId,
      source: "jobright.ai",
      extracted_at: new Date().toISOString(),
      extraction_confidence: confidence >= 5 ? "high" : confidence >= 3 ? "medium" : "low"
    };

    return job;
  };

  window.AtriveoExtractors.jobright = extractJobRightJob;
})();
