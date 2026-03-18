// Atriveo-curated list of top US target companies.
// Keep in sync with apps/web/src/lib/topTargetCompanies.ts.
export const TOP_TARGET_COMPANIES: string[] = [
  "Google",
  "Amazon",
  "Meta",
  "Apple",
  "Microsoft",
  "Netflix",
  "NVIDIA",
  "OpenAI",
  "Salesforce",
  "Adobe",
  "Uber",
  "Airbnb",
  "Stripe",
  "Coinbase",
  "Databricks",
  "Snowflake",
  "Palantir",
  "Atlassian",
  "Shopify",
  "Intuit",
  "Oracle",
  "Cisco",
  "LinkedIn",
  "Dropbox",
  "Zoom",
  "Twilio",
  "Block",
  "PayPal",
  "Robinhood",
  "DoorDash",
  "Instacart",
  "Pinterest",
  "Reddit",
  "Snap",
  "Lyft",
  "Asana",
  "Notion",
  "Canva",
  "Figma",
  "Miro",
  "HubSpot",
  "ServiceNow",
  "Workday",
  "Okta",
  "Datadog",
  "Cloudflare",
  "MongoDB",
  "Confluent",
  "Elastic",
  "GitHub",
  "GitLab",
  "Vercel",
  "Replit",
  "Anthropic",
  "Perplexity",
  "xAI",
  "Tesla",
  "Rivian",
  "SpaceX",
  "Anduril",
  "Northrop Grumman",
  "Lockheed Martin",
  "Boeing",
  "Raytheon",
  "JPMorgan Chase",
  "Goldman Sachs",
  "Morgan Stanley",
  "American Express",
  "Capital One",
  "Visa",
  "Mastercard",
  "BlackRock",
  "Bloomberg",
  "McKinsey & Company",
  "Boston Consulting Group",
  "Bain & Company",
  "Deloitte",
  "PwC",
  "EY",
  "KPMG",
  "Walmart",
  "Target",
  "Costco",
  "Procter & Gamble",
  "PepsiCo",
  "Coca-Cola",
  "Johnson & Johnson",
  "Pfizer",
  "Moderna",
  "Gilead",
  "AbbVie",
  "Merck",
  "UnitedHealth Group",
  "CVS Health",
  "Humana",
  "Intel",
  "AMD",
  "Qualcomm",
  "Broadcom",
  "Texas Instruments",
];

// Common name variations → canonical name. Keys are lowercase.
export const TOP_TARGET_COMPANY_ALIASES: Record<string, string> = {
  "alphabet": "Google",
  "alphabet inc": "Google",
  "google llc": "Google",
  "google inc": "Google",
  "amazon.com": "Amazon",
  "amazon inc": "Amazon",
  "meta platforms": "Meta",
  "facebook": "Meta",
  "facebook inc": "Meta",
  "microsoft corporation": "Microsoft",
  "apple inc": "Apple",
  "nvidia corporation": "NVIDIA",
  "jpmorgan": "JPMorgan Chase",
  "jpmorgan chase & co": "JPMorgan Chase",
  "goldman sachs group": "Goldman Sachs",
  "morgan stanley inc": "Morgan Stanley",
};

/**
 * Returns a Set of lowercase canonical/alias names for fast membership checks.
 * Includes both the canonical names and all alias keys.
 */
export function buildTargetCompanyLookup(): Set<string> {
  const set = new Set<string>();
  for (const name of TOP_TARGET_COMPANIES) {
    set.add(name.toLowerCase());
  }
  for (const alias of Object.keys(TOP_TARGET_COMPANY_ALIASES)) {
    set.add(alias.toLowerCase());
  }
  return set;
}

/**
 * Returns a sorted array of all lowercase strings (canonical names + aliases)
 * suitable for passing as a SQL ANY($n::text[]) parameter.
 */
export function targetCompanyMatchList(): string[] {
  return Array.from(buildTargetCompanyLookup()).sort();
}
