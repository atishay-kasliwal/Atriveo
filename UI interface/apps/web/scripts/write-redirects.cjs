const fs = require("fs");
const path = require("path");
const out = path.join(__dirname, "..", "dist", "_redirects");

function normalizeBasePath(raw) {
  const value = String(raw || "/").trim();
  if (!value || value === "/") return "/";
  const withLeading = value.startsWith("/") ? value : `/${value}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

const base = normalizeBasePath(process.env.VITE_APP_BASE);
const redirectRule = base === "/" ? "/*  /index.html  200\n" : `${base}*  ${base}index.html  200\n`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, redirectRule);
console.log("Wrote dist/_redirects");
