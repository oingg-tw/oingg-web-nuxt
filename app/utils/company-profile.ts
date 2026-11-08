import type { FactItem } from '~/components/shared/SharedFactList.vue'
import type { CompanyOfficer, CompanyProfileDetail } from '~/composables/stock/useCompanyProfile'

// 個股的基本資料怎麼寫（2026-11-08，指標速覽的基本資料卡與基本資料頁共用；設計頁 https://claude.ai/artifact/56HsmA1SowvPxnZ4vJzha4）。
// 金額與股數用全站的有效位數（formatMoney、formatSignificantDigits），沒有值寫「－」。scripts/check-company-profile.mjs 用 node 跑
// fullYears 與 officerText，所以這兩支不碰自動匯入的東西

// 上市寫上市日、上櫃寫上櫃日、興櫃寫興櫃登錄日（「登錄 2 年」）
export const MARKET_TEXT: Record<string, { name: string; date: string; since: string; joined: string }> = {
  sii: { name: '上市', date: '上市日', since: '上市', joined: '上市' },
  otc: { name: '上櫃', date: '上櫃日', since: '上櫃', joined: '上櫃' },
  rotc: { name: '興櫃', date: '興櫃登錄日', since: '登錄', joined: '登錄興櫃' }
}

// from 到 today 滿幾年（都是台北日期 YYYY-MM-DD）；讀不懂或在 today 之後是 null
export function fullYears(from: string | null, today: string): number | null {
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return null
  const years = Number(today.slice(0, 4)) - Number(from.slice(0, 4)) - (today.slice(5) < from.slice(5) ? 1 : 0)
  return years >= 0 ? years : null
}

const ROLE_NAMES: Record<CompanyOfficer['role'], string> = { chairman: '董事長', general_manager: '總經理', spokesperson: '發言人', deputy_spokesperson: '代理發言人' }

// 一個人怎麼寫（使用者 2026-11-08 確認）：職稱跟角色不同時放括號（「魏哲家（總裁）」），代理標出來（「（代理，總裁）」），法人董事寫代表人、
// 後面附法人全名（「蔡明興（富邦金融控股股份有限公司代表人）」）；法人沒寫代表人只寫法人名稱
export function officerText(officer: CompanyOfficer): string {
  if (!officer.name) return officer.corporationName ?? '－'
  const notes = [
    officer.isActing ? '代理' : null,
    officer.title && officer.title !== ROLE_NAMES[officer.role] ? officer.title : null,
    officer.corporationName ? `${officer.corporationName}代表人` : null
  ].filter(Boolean)
  return notes.length ? `${officer.name}（${notes.join('，')}）` : officer.name
}

// 某個角色：有 officers 讀 officers（同角色多人用頓號接，[] 是真的沒有），沒有就讀舊的字串欄
export function officersOf(detail: CompanyProfileDetail, role: CompanyOfficer['role']): string | null {
  if (detail.officers) {
    const people = detail.officers.filter(officer => officer.role === role).map(officerText)
    return people.length ? people.join('、') : null
  }
  if (role === 'chairman') return detail.chairman
  if (role === 'general_manager') return detail.generalManager
  if (role === 'spokesperson') return detail.spokesperson && (detail.spokespersonTitle ? `${detail.spokesperson}（${detail.spokespersonTitle}）` : detail.spokesperson)
  return detail.deputySpokesperson
}

const dash = (value: string | null | undefined) => value || '－'
const money = (value: number | null) => (value === null ? '－' : formatMoney(value))
// 特別股、私募是 0 的寫「無」
const shares = (value: number | null) => (value === null ? '－' : value === 0 ? '無' : `${formatSignificantDigits(value, 4)}股`)
export const sectorNameOf = (detail: CompanyProfileDetail) => (detail.sectorCode && SECTORS[detail.sectorCode]?.name) || null

function listingFact(detail: CompanyProfileDetail, today: string): FactItem {
  const market = MARKET_TEXT[detail.market ?? '']
  const years = fullYears(detail.listingDate, today)
  return { label: market?.date ?? '上市櫃日', value: dash(detail.listingDate), note: market && years !== null ? `${market.since} ${years} 年` : undefined }
}

function establishedFact(detail: CompanyProfileDetail, today: string): FactItem {
  const years = fullYears(detail.establishedDate, today)
  return { label: '成立日', value: dash(detail.establishedDate), note: years !== null ? `成立 ${years} 年` : undefined }
}

// 指標速覽的卡片：固定 8 列，卡片不能比圖表卡高（index.vue 的 .stock-quick-view-page__facts）
export function profileCardFacts(detail: CompanyProfileDetail, today: string): FactItem[] {
  return [
    { label: '產業類股', value: dash(sectorNameOf(detail)) },
    listingFact(detail, today),
    establishedFact(detail, today),
    { label: '董事長', value: dash(officersOf(detail, 'chairman')) },
    { label: '總經理', value: dash(officersOf(detail, 'general_manager')) },
    { label: '實收資本額', value: money(detail.paidInCapitalNtd) },
    { label: '簽證會計師', value: dash(detail.auditingFirm) },
    { label: '公司網站', value: dash(detail.website) }
  ]
}

// 基本資料頁的四張表
export function profilePageFacts(detail: CompanyProfileDetail, today: string): Record<'company' | 'officers' | 'capital' | 'contact', FactItem[]> {
  return {
    company: [
      { label: '公司全名', value: dash(detail.companyFullName) },
      { label: '英文簡稱', value: dash(detail.englishShortName) },
      { label: '產業類股', value: dash(sectorNameOf(detail)) },
      { label: '市場', value: MARKET_TEXT[detail.market ?? '']?.name ?? '－' },
      listingFact(detail, today),
      establishedFact(detail, today),
      { label: '統一編號', value: dash(detail.taxId) },
      ...(detail.foreignRegistrationCountryName ? [{ label: '註冊地', value: detail.foreignRegistrationCountryName }] : [])
    ],
    officers: [
      { label: '董事長', value: dash(officersOf(detail, 'chairman')) },
      { label: '總經理', value: dash(officersOf(detail, 'general_manager')) },
      { label: '發言人', value: dash(officersOf(detail, 'spokesperson')) },
      { label: '代理發言人', value: dash(officersOf(detail, 'deputy_spokesperson')) }
    ],
    capital: [
      { label: '實收資本額', value: money(detail.paidInCapitalNtd) },
      { label: '已發行股數', value: shares(detail.issuedShares) },
      { label: '特別股', value: shares(detail.numberOfPreferenceShares) },
      { label: '私募股數', value: shares(detail.privatePlacementShares) },
      { label: '財報類型', value: dash(detail.declaredDataTypeName) },
      { label: '會計師事務所', value: dash(detail.auditingFirm) },
      { label: '簽證會計師', value: dash([detail.auditor1, detail.auditor2].filter(Boolean).join('、')) }
    ],
    contact: [
      { label: '地址', value: dash(detail.address) },
      { label: '電話', value: dash(detail.phone) },
      { label: '傳真', value: dash(detail.faxNumber) },
      { label: '公司網站', value: dash(detail.website) },
      { label: '電子郵件', value: dash(detail.email) },
      { label: '股務代理', value: dash(detail.stockTransferAgency) },
      { label: '股務電話', value: dash(detail.transferAgencyPhone) },
      { label: '股務地址', value: dash(detail.transferAgencyAddress) }
    ]
  }
}
