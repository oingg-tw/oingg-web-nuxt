import type { Stock } from '~/composables/stock/useStocks'

export interface NormalizedCompanyProfile {
  symbol: string
  reportDate: Date
  name: string
  shortName: string
  foreignRegistrationCountry: string | null
  industry: string
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
function hydrateCompanyProfile(raw: Record<string, unknown>): NormalizedCompanyProfile {
  return {
    symbol: String(raw.symbol),
    reportDate: toDate(raw.reportDate) ?? new Date(),
    name: String(raw.name),
    shortName: String(raw.shortName),
    foreignRegistrationCountry: (raw.foreignRegistrationCountry as string | null) ?? null,
    industry: String(raw.industry),
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

const INDUSTRIES = ['半導體業', '電子零組件業', '金融保險業', '通信網路業', '航運業', '鋼鐵工業', '塑膠工業', '食品工業', '水泥工業', '其他業']
const SURNAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭']
const GIVEN_NAMES = ['志明', '建宏', '文雄', '美玲', '淑芬', '俊傑', '家豪', '怡君', '宗翰', '雅婷', '柏勳', '思穎']
const TITLES = ['財務長', '副總經理', '行政副總經理', '財務部經理']
const AUDIT_FIRMS = ['勤業眾信聯合會計師事務所', '資誠聯合會計師事務所', '安永聯合會計師事務所', '安侯建業聯合會計師事務所']
const DISTRICTS = ['內湖區', '信義區', '中山區', '南港區', '大安區', '新店區']

function pickName(random: () => number) {
  return SURNAMES[Math.floor(random() * SURNAMES.length)] + GIVEN_NAMES[Math.floor(random() * GIVEN_NAMES.length)]
}

function pick<T>(random: () => number, list: T[]) {
  return list[Math.floor(random() * list.length)]!
}

function yearsAgo(random: () => number, min: number, max: number) {
  const years = min + Math.floor(random() * (max - min))
  const date = new Date()
  date.setFullYear(date.getFullYear() - years, Math.floor(random() * 12), 1 + Math.floor(random() * 28))
  return date
}

// Local dev fallback so the profile card still works before the backend exposes this
// endpoint (see useCompanyProfile) — all fields are seeded off the stock code so a
// given stock always shows the same mock officers/dates rather than re-rolling.
function generateMockCompanyProfile(stock: Stock): NormalizedCompanyProfile {
  const random = mulberry32(hashCode(`${stock.code}-profile`))

  const establishedDate = yearsAgo(random, 20, 45)
  const listedDate = new Date(establishedDate)
  listedDate.setFullYear(listedDate.getFullYear() + 3 + Math.floor(random() * 8))

  const paidInCapital = BigInt(Math.round(stock.marketCapB * 1e8 * (0.15 + random() * 0.15)))
  const issuedShares = paidInCapital / 10n // par value NT$10/share

  return {
    symbol: stock.code,
    reportDate: new Date(),
    name: `${stock.name}股份有限公司`,
    shortName: stock.name,
    foreignRegistrationCountry: null,
    industry: pick(random, INDUSTRIES),
    address: `台北市${pick(random, DISTRICTS)}${1 + Math.floor(random() * 300)}號`,
    taxId: String(10000000 + Math.floor(random() * 89999999)),
    chairman: pickName(random),
    generalManager: pickName(random),
    spokesperson: pickName(random),
    spokespersonTitle: pick(random, TITLES),
    deputySpokesperson: random() > 0.4 ? pickName(random) : null,
    phone: `02-${2700 + Math.floor(random() * 900)}-${1000 + Math.floor(random() * 9000)}`,
    establishedDate,
    listedDate,
    parValue: '10.00',
    paidInCapital,
    privatePlacementShares: 0n,
    preferredStockShares: 0n,
    financialReportType: '合併財務報表',
    stockTransferAgency: `${pick(random, ['中信託', '元大', '凱基', '統一'])}證券股份有限公司股務代理部`,
    transferAgencyPhone: `02-${2500 + Math.floor(random() * 900)}-${1000 + Math.floor(random() * 9000)}`,
    transferAgencyAddress: `台北市中正區${1 + Math.floor(random() * 200)}號`,
    auditingFirm: pick(random, AUDIT_FIRMS),
    auditor1: pickName(random),
    auditor2: random() > 0.3 ? pickName(random) : null,
    englishShortName: `${stock.code} Co., Ltd.`,
    englishAddress: `No. ${1 + Math.floor(random() * 300)}, Taipei, Taiwan`,
    faxNumber: random() > 0.2 ? `02-${2700 + Math.floor(random() * 900)}-${1000 + Math.floor(random() * 9000)}` : null,
    email: `ir@${stock.code}.com.tw`,
    website: `https://www.${stock.code}.com.tw`,
    issuedShares
  }
}

// Assumed contract: GET {apiBase}/api/company-profile/{symbol} -> raw JSON matching
// NormalizedCompanyProfile (dates as ISO strings, bigints as strings). Falls back to
// seeded mock data if that endpoint isn't reachable yet, same pattern as useStockUniverse.
export function useCompanyProfile(stock: Ref<Stock | undefined>) {
  const config = useRuntimeConfig()

  return useAsyncData<NormalizedCompanyProfile | null>(
    () => `company-profile-${stock.value?.code ?? 'none'}`,
    async () => {
      const current = stock.value
      if (!current) return null

      try {
        const raw = await $fetch<Record<string, unknown>>(`/api/company-profile/${current.code}`, {
          baseURL: config.public.apiBase
        })
        return hydrateCompanyProfile(raw)
      } catch (error) {
        if (import.meta.dev) {
          const reason = error instanceof Error ? error.message : String(error)
          console.warn(
            `[company-profile] GET ${config.public.apiBase}/api/company-profile/${current.code} unavailable (${reason}), using mock data instead`
          )
        }
        return generateMockCompanyProfile(current)
      }
    },
    { watch: [stock] }
  )
}
