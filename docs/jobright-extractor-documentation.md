# JobRight Extractor Documentation

## Platform Support: JobRight.ai

**URL Pattern:** `https://jobright.ai/jobs/info/{jobId}`  
**Status:** ✅ Newly Added (v1.0.6)  
**Extractor Type:** Dedicated platform extractor  
**File:** `content-scripts/jobright.js`

---

## What We Extract From JobRight

### Supported Fields & Extraction Strategies

| Field | Extraction Strategy | Confidence Score |
|---|---|---|
| **Job Title** | H1 heading, `[data-testid='job-title']`, meta og:title | High (if found) |
| **Company Name** | Company link, meta og:site_name, hostname label | High (if found) |
| **Location** | Location badge, inline text patterns | Medium-High |
| **Salary** | Salary badge, currency pattern matching | Medium |
| **Employment Type** | Employment type badge, text patterns | Medium |
| **Experience Level** | Seniority level badge, text patterns | Medium |
| **Job Description** | Full job body content | High (always present) |
| **Job URL** | Window.location.href | High (always present) |
| **Job ID** | Extracted from URL `/jobs/info/{jobId}` | High (always present) |
| **Extraction Source** | Hardcoded as `jobright.ai` | High |
| **Timestamp** | Current date/time of extraction | High |

---

## Detailed Field Breakdown

### 1. Job Title
**What it is:** The primary job position name  
**Extraction Order:**
```
1. Primary <h1> or [data-testid='job-title']
2. Meta og:title (stripped of non-title prefixes)
3. Text pattern matching at start of page text
```
**Example Output:** "Senior Software Engineer" or "Product Manager"  
**Confidence:** High if found in selectors 1-2, Medium if text pattern match

---

### 2. Company Name
**What it is:** The hiring company/organization  
**Extraction Order:**
```
1. Company link or [class*='company-name']
2. Meta og:site_name
3. Text patterns: "company: X", "apply to X", "job at X"
4. Fallback: Website hostname label (e.g., jobright.ai)
```
**Example Output:** "Google", "Microsoft", "Tesla"  
**Confidence:** High if found in company section, Medium if text pattern, Low if fallback

---

### 3. Location
**What it is:** Job location (city, state, country)  
**Extraction Order:**
```
1. Location badge [data-testid='job-location']
2. Text pattern: "location: X", "based in X", "place: X"
3. Inline location markers
```
**Example Output:** "San Francisco, CA" or "Remote (US)"  
**Confidence:** High if badge found, Medium if text pattern

---

### 4. Salary
**What it is:** Compensation range and frequency  
**Extraction Order:**
```
1. Salary badge [class*='Salary']
2. Text patterns: "$X-$Y/year", "$X-$Y annually"
3. Inline currency patterns
```
**Example Output:** "$120,000 - $160,000 per year"  
**Confidence:** High if badge, Medium if pattern match

---

### 5. Employment Type
**What it is:** Full-Time, Part-Time, Contract, Internship, etc.  
**Extraction Order:**
```
1. Employment type badge [data-testid='employment-type']
2. Text pattern matching: "Full-Time", "Part-Time", "Contract"
```
**Example Output:** "Full-Time" or "Contract"  
**Confidence:** High if badge, Medium if pattern match

---

### 6. Experience Level
**What it is:** Required/implied seniority: Entry, Mid, Senior, Executive  
**Extraction Order:**
```
1. Experience level badge [data-testid='experience-level']
2. Text pattern: "Entry-Level", "Mid-Level", "Senior", "Executive"
```
**Example Output:** "Mid-Level" or "Senior"  
**Confidence:** Medium (not always present on JobRight)

---

### 7. Job Description
**What it is:** Full job posting text content  
**Extraction Order:**
```
1. Job description block [data-testid='job-description']
2. Article or main tag
3. Full body text fallback
```
**Example Output:** Full HTML-stripped text of job posting  
**Confidence:** High (always captured in some form)

---

### 8. Job URL
**What it is:** Current page URL  
**Value:** `window.location.href`  
**Example Output:** `https://jobright.ai/jobs/info/69b1fe79548f140066e82ddb?utm_source=1100&utm_campaign=...`  
**Confidence:** High (100% - always present)

---

### 9. Job ID
**What it is:** Unique JobRight job identifier  
**Extraction:** Regex from URL pattern `/jobs/info/([a-f0-9]+)`  
**Example Output:** `69b1fe79548f140066e82ddb`  
**Confidence:** High (100% - always in URL)

---

## Overall Confidence Scoring

| Score | Level | Meaning |
|---|---|---|
| **6+ fields** | `high` | All major fields extracted successfully |
| **3-5 fields** | `medium` | Core fields present, some missing |
| **< 3 fields** | `low` | Partial extraction, manual review needed |

---

## Sample Extraction Output

```json
{
  "job_title": "Senior Software Engineer",
  "company": "TechCorp Inc.",
  "location": "San Francisco, CA",
  "salary": "$150,000 - $200,000 per year",
  "employment_type": "Full-Time",
  "experience_level": "Senior",
  "job_description": "We are looking for a Senior Software Engineer...",
  "url": "https://jobright.ai/jobs/info/69b1fe79548f140066e82ddb",
  "job_id": "69b1fe79548f140066e82ddb",
  "source": "jobright.ai",
  "extracted_at": "2024-03-11T15:30:45.123Z",
  "extraction_confidence": "high"
}
```

---

## Limitations & Edge Cases

1. **Dynamic Content:** JobRight uses JavaScript to render some job details. If the page loads very quickly, some fields may be empty. Solution: Detector retries after 40ms delay.

2. **Sponsored/Ad Content:** JobRight mixes job listings with sponsored content. Our selectors are designed to avoid these, but may occasionally capture ad CTAs.

3. **Custom Job Fields:** Some JobRight listings may have custom fields (e.g., "Level of Urgency", "Visa Sponsorship") not captured by our extractor. These would need manual entry in the form.

4. **Location Ambiguity:** Remote roles may show as "Remote (US)" or "Fully Remote" with varying formats. Our regex normalizes common patterns.

5. **Salary Privacy:** Some roles don't include salary. In those cases, `salary` field will be `null`.

---

## Testing Strategy

### Real-World Test Case
**URL:** `https://jobright.ai/jobs/info/69b1fe79548f140066e82ddb`

**Expected Results:**
- ✅ Job title extracted from page heading
- ✅ Company name visible in company section
- ✅ Location badge shows job location
- ✅ Salary (if present) captured from badge
- ✅ Employment type badge detected
- ✅ Full job description scraped
- ✅ Job ID parsed from URL

**Confidence Level Prediction:** High (most major fields should be present)

---

## Future Enhancements

- [ ] Add JobRight-specific utm parameter parsing
- [ ] Detect "matched score" for recommender confidence
- [ ] Extract "quick apply" vs full application requirement
- [ ] Parse benefits list if available
- [ ] Detect "application deadline" if shown
- [ ] Add JobRight's internal job matching score to payload

---

## Integration Timeline

- ✅ **v1.0.5** (Current): Generic career page fallback (works but partial extraction)
- ✅ **v1.0.6**: Dedicated JobRight extractor (full extraction module added)
- **v1.0.7+**: Consider adding other popular job boards (Indeed, LinkedIn Jobs, ZipRecruiter, etc.)
