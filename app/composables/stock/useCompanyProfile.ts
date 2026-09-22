export interface NormalizedCompanyProfile {
  symbol: string
  market: 'TWSE' | 'TPEx'
  reportDate: Date
  name: string
  shortName: string
  foreignRegistrationCountry: string | null
  industry: string
  // TWSE-only for now (bff-ts 2026-09-02) — TPEx's own source data has no industry-name
  // mapping yet, so this is null for TPEx-listed companies until tpex-ts adds one. Don't
  // assume it'll always be present just because `industry` (the raw code) is.
  industryName: string | null
  address: string
  taxId: string
  chairman: string
  generalManager: string
  spokesperson: string
  spokespersonTitle: string
  deputySpokesperson: string | null
  phone: string
  establishedDate: Date | null
  listedDate: Date | null
  parValue: string | null
  paidInCapital: bigint | null
  privatePlacementShares: bigint | null
  preferredStockShares: bigint | null
  // ⚠ TWO FIELDS, INVERTED CONVENTIONS. Read this before using either.
  //
  //   financialReportType（交易所代碼）  "1" = 合併    "2" = 個別
  //   metricDataType                    "2" = 合併    "1" = 個體
  //
  // They mean the same thing and number it the opposite way round, so a value copied from one to
  // the other silently inverts. The comment that used to sit here documented "1" -> 個別財報 /
  // "2" -> 合併財報, which was the mapping analysis-ts shipped BACKWARDS and corrected on
  // 2026-09-22 (21fdd2d4). Verified live after that fix: 2330/2317/2891 all return
  // financialReportType "1" with financialReportTypeName「合併財報」.
  //
  // Nothing has ever RENDERED financialReportTypeName — it is mapped here and read nowhere — so
  // the inverted label never reached a visitor. Kept mapped, with the mapping now stated correctly,
  // rather than deleted: the field is the natural one to show beside a financial statement, and a
  // page that shows the wrong one would be making a factual claim about which entity's numbers a
  // reader is looking at.
  financialReportType: string
  financialReportTypeName: string | null
  // Which basis this company's METRICS were computed on, added 2026-09-22 (21fdd2d4). Distinct
  // from the two fields above, which describe what the company FILES: 249 companies file only
  // individual statements and so had no computed metrics at all until analysis-ts started deriving
  // them from the individual report.
  //
  // This is the field to check before labelling anything「個體報表」. Verified live: "2"（合併）on
  // every symbol sampled. The "1"（個體）side is analysis-ts's stated contract but NOT yet observed
  // here — 20 symbols sampled the day it shipped were all "2", with their backfill still running,
  // so treat a "1" as expected-but-unseen rather than confirmed.
  metricDataType: string | null
  stockTransferAgency: string
  transferAgencyPhone: string
  transferAgencyAddress: string
  auditingFirm: string
  auditor1: string
  auditor2: string | null
  englishShortName: string
  englishAddress: string
  faxNumber: string | null
  email: string | null
  website: string | null
  issuedShares: bigint | null
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date
}

function toBigInt(value: unknown): bigint | null {
  if (value === null || value === undefined || value === '') return null
  try {
    return BigInt(value as string | number)
  } catch {
    return null
  }
}

// Real backend responses can't carry Date/bigint over JSON, so the raw payload arrives
// as ISO date strings and stringified numbers — hydrate it into the typed shape here.
function hydrateCompanyProfile(raw: Record<string, unknown>): NormalizedCompanyProfile {
  return {
    symbol: String(raw.symbol),
    market: raw.market === 'TPEx' ? 'TPEx' : 'TWSE',
    reportDate: toDate(raw.reportDate) ?? new Date(),
    name: String(raw.name),
    shortName: String(raw.shortName),
    foreignRegistrationCountry: (raw.foreignRegistrationCountry as string | null) ?? null,
    industry: String(raw.industry),
    industryName: (raw.industryName as string | null) ?? null,
    address: String(raw.address),
    taxId: String(raw.taxId),
    chairman: String(raw.chairman),
    generalManager: String(raw.generalManager),
    spokesperson: String(raw.spokesperson),
    spokespersonTitle: String(raw.spokespersonTitle),
    deputySpokesperson: (raw.deputySpokesperson as string | null) ?? null,
    phone: String(raw.phone),
    establishedDate: toDate(raw.establishedDate),
    listedDate: toDate(raw.listedDate),
    parValue: (raw.parValue as string | null) ?? null,
    paidInCapital: toBigInt(raw.paidInCapital),
    privatePlacementShares: toBigInt(raw.privatePlacementShares),
    preferredStockShares: toBigInt(raw.preferredStockShares),
    financialReportType: String(raw.financialReportType),
    financialReportTypeName: (raw.financialReportTypeName as string | null) ?? null,
    metricDataType: (raw.metricDataType as string | null) ?? null,
    stockTransferAgency: String(raw.stockTransferAgency),
    transferAgencyPhone: String(raw.transferAgencyPhone),
    transferAgencyAddress: String(raw.transferAgencyAddress),
    auditingFirm: String(raw.auditingFirm),
    auditor1: String(raw.auditor1),
    auditor2: (raw.auditor2 as string | null) ?? null,
    englishShortName: String(raw.englishShortName),
    englishAddress: String(raw.englishAddress),
    faxNumber: (raw.faxNumber as string | null) ?? null,
    email: (raw.email as string | null) ?? null,
    website: (raw.website as string | null) ?? null,
    issuedShares: toBigInt(raw.issuedShares)
  }
}

// GET /stocks/{symbol}/profile — confirmed live by bff-ts 2026-09-02 (tested against 2330/
// 台積電 and 8299/群聯), replacing the earlier /api/company-profile/{symbol} guess that turned
// out to be entirely wrong (see this file's git history / project_stock_chart_lookback_window_
// research memory). Field names match NormalizedCompanyProfile exactly — no renaming needed.
// 404 means the symbol has no company-profile record on either market (not an error to log).
// TPEx companies always have englishAddress: null (that field doesn't exist in TPEx's own
// source data, not a bug). Returns null on any failure rather than fabricating officer/
// registration data, since that used to render real-looking company details (chairman,
// auditor, tax ID, etc.) that were actually seeded random values. stock/[code].vue shows
// StockProfileCardShell when this comes back null, same treatment as the other unbacked
// per-stock charts.
//
// Signature changed 2026-09-14 from `stock: Ref<Stock | undefined>` to a plain `symbol` ref —
// the old signature only ever read `stock.value.code`, but required a resolved Stock object to
// exist first. On stock/[code].vue that Stock came from useStockUniverse()'s own fake fallback
// universe (see that file's own comment), so this fetch silently never fired for any symbol
// outside that ~20-stock mock list — the profile card, and everything gated on `profile` (e.g.
// the summary card's website/logo), just stayed empty for most of the real market. Taking the
// route param directly removes that dependency entirely.
//
// Fetched through this app's own cached passthrough（/api/bff, server/api/bff/[...path].get.ts）
// since 2026-09-19 — same path and shape, cached 24h on the server.
export function useCompanyProfile(symbol: Ref<string | undefined>) {
  return useAsyncData<NormalizedCompanyProfile | null>(
    () => `company-profile-${symbol.value ?? 'none'}`,
    async () => {
      const current = symbol.value
      if (!current) return null

      try {
        const raw = await $fetch<Record<string, unknown>>(`/stocks/${current}/profile`, {
          baseURL: '/api/bff',
          retry: 0
        })
        return hydrateCompanyProfile(raw)
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(`[company-profile] GET /api/bff/stocks/${current}/profile unavailable (${reason})`)
        }
        return null
      }
    },
    { watch: [symbol] }
  )
}
