// company_profile's `website` field comes back in at least 3 inconsistent shapes (confirmed
// by analysis-ts 2026-09-04): bare domain ("www.acc.com.tw"), scheme+trailing slash
// ("http://www.ancang.com/"), trailing slash with no scheme ("www.tactc.com.tw/"). Brandfetch's
// Logo API expects a bare domain, so this strips scheme, trailing slash, and the www. prefix
// before building that URL — kept here (not analysis-ts's API layer) since it's pure string
// handling tightly coupled to whichever logo vendor is in use.
export function normalizeWebsiteDomain(website: string): string {
  return website
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/^www\./, '')
}

// clientId is Brandfetch's own public identifier (not a secret) — see
// project_company_logo_source_pending memory for the vendor-selection rationale (Clearbit's
// own Logo API shut down 2025-12-01) and fair-use check (informational display of a public
// company's own logo, not implying endorsement/affiliation).
export function companyLogoUrl(website: string, clientId: string): string {
  return `https://cdn.brandfetch.io/${normalizeWebsiteDomain(website)}/fallback/404/icon?c=${clientId}`
}
