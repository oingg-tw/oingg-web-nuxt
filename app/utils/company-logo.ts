// company_profile's `website` field used to come back in inconsistent shapes (scheme, trailing
// slash, www. prefix) — analysis-ts now normalizes it to a clean bare domain at the source
// (confirmed 2026-09-04, tested against 351 symbols including 2330→tsmc.com, 5609→dimerco.com),
// so this only builds the Brandfetch URL — the one part that's legitimately a frontend concern
// since it's tied to whichever logo vendor is in use, not a data-quality fix.
//
// clientId is Brandfetch's own public identifier (not a secret) — see
// project_company_logo_source_pending memory for the vendor-selection rationale (Clearbit's
// own Logo API shut down 2025-12-01) and fair-use check (informational display of a public
// company's own logo, not implying endorsement/affiliation).
export function companyLogoUrl(website: string, clientId: string): string {
  return `https://cdn.brandfetch.io/${website}/fallback/404/icon?c=${clientId}`
}
