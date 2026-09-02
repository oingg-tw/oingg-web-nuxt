import type { Stock } from '~/composables/stock/useStocks'

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
  financialReportType: string
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
// financialReportType still arrives as a raw code (e.g. "1"), not a readable label — flagged
// to bff-ts 2026-09-02, waiting on twse-ts to confirm the official definition. Don't guess a
// mapping; StockProfileCard.vue shows the raw code as-is until one is confirmed.
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
export function useCompanyProfile(stock: Ref<Stock | undefined>) {
  const config = useRuntimeConfig()

  return useAsyncData<NormalizedCompanyProfile | null>(
    () => `company-profile-${stock.value?.code ?? 'none'}`,
    async () => {
      const current = stock.value
      if (!current) return null

      try {
        const raw = await $fetch<Record<string, unknown>>(`/stocks/${current.code}/profile`, {
          baseURL: config.public.apiBase
        })
        return hydrateCompanyProfile(raw)
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(`[company-profile] GET ${config.public.apiBase}/stocks/${current.code}/profile unavailable (${reason})`)
        }
        return null
      }
    },
    { watch: [stock] }
  )
}
