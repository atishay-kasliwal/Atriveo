# Top US Companies Career Page URLs
## For Extension Coverage Expansion

**Purpose:** Track major US companies' job board URLs to expand Atriveo extension host permissions.

---

## Major Tech Companies (Non-ATS Tracked)

| Company | Careers URL(s) | ATS Type | Status | Notes |
|---|---|---|---|---|
| Apple | careers.apple.com | Custom | ✓ Research | Main careers portal |
| Meta | metacareers.com | Custom | ✓ Research | Facebook/Instagram parent |
| Microsoft | microsoft.com/careers, careers.microsoft.com | Custom | ✓ Research | Separate careers portal |
| Google | careers.google.com | Workday* | Already covered | Uses Workday |
| Amazon | amazon.jobs | Amazon Jobs* | Already covered | Uses Amazon Jobs ATS |
| Tesla | tesla.com/careers | Custom | ✓ Research | Direct careers page |
| Netflix | jobs.netflix.com | Custom | ✓ Research | Tech jobs |
| Oracle | oracle.com/careers | Custom | ✓ Research | Enterprise software |
| IBM | ibm.com/careers | Custom | ✓ Research | Legacy tech |
| Intel | intel.com/careers | Custom | ✓ Research | Semiconductor |
| Nvidia | nvidia.com/careers | Custom | ✓ Research | Semiconductor/AI |
| AMD | amd.com/careers | Custom | ✓ Research | Semiconductor |
| Qualcomm | qualcomm.com/careers | Custom | ✓ Research | Wireless |
| Cisco | cisco.com/careers, jobs.cisco.com | Custom | ✓ Research | Networking |
| Broadcom | broadcom.com/careers | Custom | ✓ Research | Semiconductor |

---

## Major Finance/Banking Companies

| Company | Careers URL(s) | ATS Type | Status | Notes |
|---|---|---|---|---|
| JPMorgan Chase | jpmorganchase.com/careers | Custom | ✓ Research | Major bank |
| Bank of America | bankofamerica.com/careers | Custom | ✓ Research | Major bank |
| Wells Fargo | wellsfargo.com/careers | Custom | ✓ Research | Major bank |
| Goldman Sachs | goldmansachs.com/careers | Custom | ✓ Research | Investment bank |
| Morgan Stanley | morganstanley.com/careers | Custom | ✓ Research | Investment bank |
| Citigroup | citigroup.com/careers | Custom | ✓ Research | Major bank |
| Vanguard | vanguard.com/careers | Custom | ✓ Research | Asset management |
| BlackRock | blackrock.com/careers | Custom | ✓ Research | Asset management |
| Fidelity | fidelity.com/careers | Custom | ✓ Research | Financial services |
| Charles Schwab | schwab.com/careers | Custom | ✓ Research | Brokerage |

---

## Major Retail/E-commerce

| Company | Careers URL(s) | ATS Type | Status | Notes |
|---|---|---|---|---|
| Walmart | walmart.com/careers | Custom | ✓ Research | Largest retailer |
| Target | target.com/careers | Custom | ✓ Research | Retail |
| Best Buy | bestbuy.com/careers | Custom | ✓ Research | Electronics |
| Home Depot | homedepot.com/careers | Custom | ✓ Research | Home improvement |
| Costco | costco.com/careers | Custom | ✓ Research | Warehouse club |
| ShopifyJobs | shopify.com/careers | ATS TBD | ✓ Research | E-commerce platform |
| eBay | ebay.com/careers | Custom | ✓ Research | Marketplace |

---

## Major Consumer/Pharma/Healthcare

| Company | Careers URL(s) | ATS Type | Status | Notes |
|---|---|---|---|---|
| Pfizer | pfizer.com/careers | Custom | ✓ Research | Pharmaceutical |
| Johnson & Johnson | jnj.com/careers | Custom | ✓ Research | Healthcare |
| Merck | merck.com/careers | Custom | ✓ Research | Pharmaceutical |
| Eli Lilly | lilly.com/careers | Custom | ✓ Research | Pharmaceutical |
| AbbVie | abbvie.com/careers | Custom | ✓ Research | Pharmaceutical |
| Thermo Fisher Scientific | thermofisher.com/careers | Custom | ✓ Research | Life sciences |
| Danaher | danaher.com/careers | Custom | ✓ Research | Conglomerate |
| 3M | 3m.com/careers | Custom | ✓ Research | Manufacturing |
| Procter & Gamble | pg.com/careers | Custom | ✓ Research | Consumer goods |
| Coca-Cola | cocacola.com/careers | Custom | ✓ Research | Beverage |

---

## Major Automotive/Energy

| Company | Careers URL(s) | ATS Type | Status | Notes |
|---|---|---|---|---|
| General Motors | gm.com/careers | Custom | ✓ Research | Automotive |
| Ford | ford.com/careers | Custom | ✓ Research | Automotive |
| Stellantis | stellantis.com/careers | Custom | ✓ Research | Automotive |
| BP | bp.com/careers | Custom | ✓ Research | Oil & Gas |
| ExxonMobil | exxonmobil.com/careers | Custom | ✓ Research | Oil & Gas |
| Chevron | chevron.com/careers | Custom | ✓ Research | Oil & Gas |
| NextEra Energy | nexteraenergy.com/careers | Custom | ✓ Research | Energy |
| Duke Energy | dukeenergy.com/careers | Custom | ✓ Research | Utilities |

---

## Major Aerospace/Defense

| Company | Careers URL(s) | ATS Type | Status | Notes |
|---|---|---|---|---|
| Boeing | boeing.com/careers | Custom | ✓ Research | Aerospace |
| Lockheed Martin | lockheedmartin.com/careers | Custom | ✓ Research | Defense |
| Raytheon Technologies | rtx.com/careers | Custom | ✓ Research | Defense/Aerospace |
| Northrop Grumman | northropgrumman.com/careers | Custom | ✓ Research | Defense |
| General Dynamics | generaldynamics.com/careers | Custom | ✓ Research | Defense |

---

## Hospitality/Travel

| Company | Careers URL(s) | ATS Type | Status | Notes |
|---|---|---|---|---|
| Marriott | marriott.com/careers | Custom | ✓ Research | Hospitality |
| Hilton | hilton.com/careers | Custom | ✓ Research | Hospitality |
| Delta Air Lines | delta.com/careers | Custom | ✓ Research | Airlines |
| American Airlines | aa.com/careers | Custom | ✓ Research | Airlines |
| United Airlines | united.com/careers | Custom | ✓ Research | Airlines |
| Southwest Airlines | southwest.com/careers | Custom | ✓ Research | Airlines |

---

## How to Use This List

1. **Verify URLs:** Visit each company's main website, find Careers/Jobs link
2. **Detect ATS:** Use `detector.js` patterns or manually check page HTML for ATS indicators
3. **Populate Manifest:** Add verified `https://[domain]/careers/*` and `https://[domain]/jobs/*` patterns
4. **Test:** Add to test tracker and verify extraction works
5. **Commit:** Once tested, add to manifest for next release

---

## Research Pattern

For each company:
```
1. Go to company.com
2. Find "Careers" or "Jobs" link → Note the URL
3. Check page source for ATS indicators:
   - Form action handlers
   - JavaScript job board library names
   - Specific job listing URL patterns
4. Add domain(s) to manifest
5. Increment counter below
```

---

## Progress Tracker

- [ ] Tech companies (15)
- [ ] Finance/Banking (10)
- [ ] Retail/E-commerce (7)
- [ ] Consumer/Pharma/Healthcare (10)
- [ ] Automotive/Energy (8)
- [ ] Aerospace/Defense (5)
- [ ] Hospitality/Travel (6)

**Total researched:** 0 / 61
**Total added to manifest:** 0
