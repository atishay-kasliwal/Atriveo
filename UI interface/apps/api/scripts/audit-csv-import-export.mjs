const API_URL = process.env.API_URL || "http://127.0.0.1:8787";
const EMAIL = process.env.DASHBOARD_EMAIL || "";
const PASSWORD = process.env.DASHBOARD_PASSWORD || "";
const LIMIT = 100;

if (!EMAIL || !PASSWORD) {
  console.error("Missing DASHBOARD_EMAIL or DASHBOARD_PASSWORD.");
  process.exit(1);
}

function nowIsoDay() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

const RUN_ID = `CSV_AUDIT_${Date.now()}`;
const PREFIXES = {
  alias: `${RUN_ID}_ALIAS_`,
  appliedOnly: `${RUN_ID}_APPLIED_`,
  dateOnly: `${RUN_ID}_DATE_ONLY_`,
  formula: `${RUN_ID}_FORMULA_`,
  invalid: `${RUN_ID}_INVALID_`,
  bulk: `${RUN_ID}_BULK_`,
};

const results = [];
let token = "";

function csvEscape(value) {
  const raw = String(value ?? "");
  if (/[,"\n]/.test(raw)) return `"${raw.replace(/"/g, "\"\"")}"`;
  return raw;
}

function toCsv(headers, rows) {
  return [headers.join(","), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))].join("\n");
}

function parseCsvText(csv) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i];
    const next = csv[i + 1];
    if (inQuotes) {
      if (ch === "\"") {
        if (next === "\"") {
          cell += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === "\"") {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  row.push(cell);
  if (row.some((entry) => entry.length > 0)) rows.push(row);
  return rows;
}

function parseCsvObjects(csvText) {
  const rows = parseCsvText(csvText);
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] ?? "";
    });
    return obj;
  });
}

function assertTrue(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, { method = "GET", body, auth = true } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const data = text ? (() => {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  })() : null;
  if (!res.ok) {
    throw new Error(`API ${res.status} ${method} ${path}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data;
}

async function login() {
  const payload = await api("/auth/login", {
    method: "POST",
    auth: false,
    body: { email: EMAIL, password: PASSWORD },
  });
  if (!payload?.token) throw new Error("Login response missing token.");
  token = payload.token;
}

async function importCsv(csv) {
  return api("/api/jobs/import/csv", { method: "POST", body: { csv } });
}

async function exportCsvAll() {
  const res = await fetch(`${API_URL}/api/jobs/export/csv?range=all`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Export failed (${res.status}): ${await res.text()}`);
  }
  return res.text();
}

async function getJobsPage({ page = 1, limit = LIMIT, company = "", status = "all" } = {}) {
  const q = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    status,
  });
  if (company) q.set("company", company);
  return api(`/api/jobs?${q.toString()}`);
}

async function getAllJobsByPrefix(prefix) {
  const rows = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (rows.length < total) {
    const payload = await getJobsPage({ page, company: prefix, status: "all" });
    const data = Array.isArray(payload?.data) ? payload.data : [];
    total = Number(payload?.total ?? rows.length + data.length);
    rows.push(...data);
    if (!data.length || data.length < LIMIT) break;
    page += 1;
  }
  return rows.filter((r) => String(r.company ?? "").startsWith(prefix));
}

async function getAllReferralsByPrefix(prefix) {
  const rows = [];
  let page = 1;
  while (true) {
    const payload = await api(`/api/referrals?page=${page}&limit=${LIMIT}`);
    const data = Array.isArray(payload?.data) ? payload.data : [];
    rows.push(...data.filter((r) => String(r.company ?? "").startsWith(prefix)));
    if (!data.length || data.length < LIMIT) break;
    page += 1;
  }
  return rows;
}

async function getTrendByDay(days = 60) {
  const q = new URLSearchParams({
    days: String(days),
    anchorDay: nowIsoDay(),
  });
  const payload = await api(`/api/jobs/trend?${q.toString()}`);
  const out = new Map();
  for (const row of payload?.data ?? []) {
    out.set(String(row.day), Number(row.applied ?? 0));
  }
  return out;
}

function sumTrendCountsByDay(trendMap) {
  let total = 0;
  for (const value of trendMap.values()) {
    total += Number(value ?? 0);
  }
  return total;
}

async function deleteJob(id) {
  await api(`/api/jobs/${id}`, { method: "DELETE" });
}

async function deleteReferral(id) {
  await api(`/api/referrals/${id}`, { method: "DELETE" });
}

async function runCase(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS: ${name}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ name, ok: false, error: message });
    console.error(`FAIL: ${name}`);
    console.error(`  ${message}`);
  }
}

async function cleanup() {
  const prefixes = Object.values(PREFIXES);
  for (const prefix of prefixes) {
    const jobs = await getAllJobsByPrefix(prefix);
    for (const row of jobs) {
      await deleteJob(row.id);
    }
    const referrals = await getAllReferralsByPrefix(prefix);
    for (const row of referrals) {
      await deleteReferral(row.id);
    }
  }
}

await login();

const localDay = nowIsoDay();
let expectedReferralCount = 0;

try {
  await runCase("accepts old template aliases", async () => {
    const headers = [
      "Date",
      "Position",
      "Company Name",
      "Location",
      "Link",
      "Application ID",
      "OA Deadline",
      "Keyword Match",
      "OA",
      "Referral",
      "Response",
      "Status",
      "Comment",
    ];
    const rows = [
      {
        Date: localDay,
        Position: "Software Engineer",
        "Company Name": `${PREFIXES.alias}1`,
        Location: "NY",
        Link: "https://example.com/alias/1",
        "Application ID": "ALIAS-1",
        "OA Deadline": localDay,
        "Keyword Match": "Strong",
        OA: "Yes",
        Referral: "Yes",
        Response: "Interview",
        Status: "Applied",
        Comment: "old template row 1",
      },
      {
        Date: localDay,
        Position: "Backend Engineer",
        "Company Name": `${PREFIXES.alias}2`,
        Location: "CA",
        Link: "https://example.com/alias/2",
        "Application ID": "ALIAS-2",
        "OA Deadline": "",
        "Keyword Match": "Medium",
        OA: "No",
        Referral: "Requested",
        Response: "Review",
        Status: "Applied",
        Comment: "old template row 2",
      },
      {
        Date: localDay,
        Position: "Data Engineer",
        "Company Name": `${PREFIXES.alias}3`,
        Location: "",
        Link: "",
        "Application ID": "",
        "OA Deadline": "",
        "Keyword Match": "",
        OA: "",
        Referral: "No",
        Response: "",
        Status: "",
        Comment: "",
      },
    ];
    const result = await importCsv(toCsv(headers, rows));
    assertTrue(result.imported === 3, `expected imported=3 got ${result.imported}`);

    const jobs = await getAllJobsByPrefix(PREFIXES.alias);
    assertTrue(jobs.length === 3, `expected 3 jobs for alias prefix, got ${jobs.length}`);
    expectedReferralCount += 2;
  });

  await runCase("accepts applied_at only (without date_saved)", async () => {
    const headers = ["applied_at", "role", "company", "referral_status"];
    const rows = [
      {
        applied_at: `${localDay}T09:35:00-05:00`,
        role: "ML Engineer",
        company: `${PREFIXES.appliedOnly}1`,
        referral_status: "Yes",
      },
      {
        applied_at: `${localDay}T11:00:00-05:00`,
        role: "Platform Engineer",
        company: `${PREFIXES.appliedOnly}2`,
        referral_status: "Requested",
      },
    ];
    const result = await importCsv(toCsv(headers, rows));
    assertTrue(result.imported === 2, `expected imported=2 got ${result.imported}`);

    const jobs = await getAllJobsByPrefix(PREFIXES.appliedOnly);
    assertTrue(jobs.length === 2, `expected 2 jobs, got ${jobs.length}`);
    for (const row of jobs) {
      const dateSaved = String(row.date_saved ?? "");
      assertTrue(dateSaved.startsWith(localDay), `date_saved not derived from applied_at for job ${row.id}`);
    }
    expectedReferralCount += 2;
  });

  await runCase("defaults date_saved-only rows to 12:07 AM applied_at", async () => {
    const headers = ["date_saved", "role", "company", "referral_status"];
    const rows = [
      {
        date_saved: localDay,
        role: "No Time Role",
        company: `${PREFIXES.dateOnly}1`,
        referral_status: "No",
      },
    ];
    const result = await importCsv(toCsv(headers, rows));
    assertTrue(result.imported === 1, `expected imported=1 got ${result.imported}`);

    const csv = await exportCsvAll();
    const exported = parseCsvObjects(csv).find((r) => String(r.company ?? "") === `${PREFIXES.dateOnly}1`);
    assertTrue(Boolean(exported), "date_saved-only row not present in export");
    assertTrue(
      String(exported?.applied_at ?? "").startsWith(`${localDay}T00:07:00`),
      `expected applied_at to default to ${localDay}T00:07:00*, got ${String(exported?.applied_at ?? "")}`,
    );
  });

  await runCase("skips invalid date rows and imports recoverable rows", async () => {
    const headers = ["role", "company", "date_saved", "applied_at", "referral_status"];
    const rows = [
      {
        role: "Bad Date Role",
        company: `${PREFIXES.invalid}1`,
        date_saved: "not-a-date",
        applied_at: "not-a-time",
        referral_status: "Yes",
      },
      {
        role: "Recoverable Role",
        company: `${PREFIXES.invalid}2`,
        date_saved: "invalid",
        applied_at: `${localDay}T14:00:00-05:00`,
        referral_status: "Yes",
      },
    ];
    const result = await importCsv(toCsv(headers, rows));
    assertTrue(result.imported === 1, `expected imported=1 got ${result.imported}`);
    assertTrue(result.skippedInvalidDate === 1, `expected skippedInvalidDate=1 got ${result.skippedInvalidDate}`);
    expectedReferralCount += 1;
  });

  await runCase("imports 150 rows and pagination total reflects all rows", async () => {
    const beforeTrend = await getTrendByDay(60);
    const beforeTotal = sumTrendCountsByDay(beforeTrend);

    const headers = [
      "date_saved",
      "applied_at",
      "role",
      "company",
      "location_raw",
      "job_link",
      "job_application_id",
      "oa_deadline_date",
      "keyword_matching",
      "oa_status",
      "referral_status",
      "response_status",
      "application_status",
      "notes",
    ];
    const rows = [];
    for (let i = 0; i < 150; i += 1) {
      const status = i % 3 === 0 ? "Yes" : i % 3 === 1 ? "Requested" : "No";
      rows.push({
        date_saved: localDay,
        applied_at: `${localDay}T${String(8 + (i % 12)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}:00-05:00`,
        role: `Bulk Role ${i + 1}`,
        company: `${PREFIXES.bulk}${i + 1}`,
        location_raw: "Test City",
        job_link: `https://example.com/bulk/${i + 1}`,
        job_application_id: `BULK-${i + 1}`,
        oa_deadline_date: "",
        keyword_matching: i % 2 === 0 ? "Medium" : "Strong",
        oa_status: i % 2 === 0 ? "No" : "Yes",
        referral_status: status,
        response_status: "Review",
        application_status: "Applied",
        notes: `bulk-import-${i + 1}`,
      });
    }

    const result = await importCsv(toCsv(headers, rows));
    assertTrue(result.imported === 150, `expected imported=150 got ${result.imported}`);
    expectedReferralCount += rows.filter((row) => row.referral_status === "Yes" || row.referral_status === "Requested").length;

    const page1 = await getJobsPage({ page: 1, limit: 25, company: PREFIXES.bulk, status: "all" });
    assertTrue(Number(page1.total ?? 0) === 150, `expected total=150 got ${page1.total}`);
    assertTrue((page1.data ?? []).length === 25, `expected page1 length=25 got ${(page1.data ?? []).length}`);

    const page2 = await getJobsPage({ page: 2, limit: 25, company: PREFIXES.bulk, status: "all" });
    assertTrue((page2.data ?? []).length === 25, `expected page2 length=25 got ${(page2.data ?? []).length}`);

    const afterTrend = await getTrendByDay(60);
    const afterTotal = sumTrendCountsByDay(afterTrend);
    assertTrue(afterTotal >= beforeTotal + 150, `expected trend delta >= 150, got ${afterTotal - beforeTotal}`);
  });

  await runCase("export includes new header and all imported bulk rows", async () => {
    const csv = await exportCsvAll();
    const parsed = parseCsvText(csv);
    assertTrue(parsed.length > 1, "export returned no data rows");
    const headers = parsed[0].map((h) => String(h).trim().toLowerCase());
    assertTrue(headers.includes("applied_at"), "export header missing applied_at");

    const rows = parseCsvObjects(csv);
    const bulkRows = rows.filter((r) => String(r.company ?? "").startsWith(PREFIXES.bulk));
    assertTrue(bulkRows.length === 150, `expected 150 bulk rows in export, got ${bulkRows.length}`);
    assertTrue(
      bulkRows.every((r) => String(r.applied_at ?? "").trim().length > 0),
      "some exported bulk rows are missing applied_at",
    );
  });

  await runCase("export sanitizes formula-like cells", async () => {
    const headers = ["date_saved", "role", "company", "notes", "referral_status"];
    const rows = [
      {
        date_saved: localDay,
        role: "Formula Test",
        company: `${PREFIXES.formula}1`,
        notes: '=HYPERLINK("https://example.com","click")',
        referral_status: "No",
      },
    ];
    const result = await importCsv(toCsv(headers, rows));
    assertTrue(result.imported === 1, `expected imported=1 got ${result.imported}`);

    const csv = await exportCsvAll();
    const exported = parseCsvObjects(csv).find((r) => String(r.company ?? "") === `${PREFIXES.formula}1`);
    assertTrue(Boolean(exported), "formula test row not present in export");
    assertTrue(
      String(exported?.notes ?? "").startsWith("'="),
      `expected notes to be CSV-sanitized, got ${String(exported?.notes ?? "")}`,
    );
  });

  await runCase("referral records sync for all imported Yes/Requested rows", async () => {
    const referrals = await getAllReferralsByPrefix(RUN_ID);
    assertTrue(
      referrals.length === expectedReferralCount,
      `expected ${expectedReferralCount} referrals for this run, got ${referrals.length}`,
    );
  });
} finally {
  try {
    await cleanup();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Cleanup warning: ${message}`);
  }
}

const failed = results.filter((r) => !r.ok);
console.log("\nCSV import/export audit summary");
for (const row of results) {
  console.log(`${row.ok ? "PASS" : "FAIL"} - ${row.name}`);
}
if (failed.length) {
  process.exit(1);
}
