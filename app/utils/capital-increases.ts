// 現金增資頁（/calendar/capital-increases，2026-11-25 使用者「只做現增」；設計 https://claude.ai/artifact/B88jqF2TnNYFetB3omEftY）：
// 數據中台的 GET /market/capital-increases（業務中台轉發）三個陣列，各自排好序、「今天」照台北判斷，網站不自己算日期。
// 抽籤日與中籤率沒有授權來源，頁面連到兩所的公告；初次上市櫃的張數拿掉（公司公告只有含競價拍賣的合計，使用者「拿掉這一欄」）。
// 被 scripts/check-capital-increases.mjs 直接 import，所以零 import

export interface UpcomingCapitalIncrease {
  symbol: string
  companyName: string | null
  // 公開觀測站還沒公告除權日是 null，排在最後
  exRightsDate: string | null
  // 原股東每仟股可認購的股數
  stockHoldingRatio: number | null
  // 還沒定價是 null
  subscriptionPricePerShare: number | null
}

export interface PayingCapitalIncrease extends UpcomingCapitalIncrease {
  // 原股東及員工的繳款起訖；截止日當天照列，過了就不在這裡（使用者：繳款一結束就拿掉）
  subscriptionPaymentStartDate: string | null
  subscriptionPaymentEndDate: string | null
  paymentPhase: 'in_progress' | 'not_started' | 'unknown'
  // unknown 時是 not_announced
  paymentPeriodNullReason: string | null
}

export interface PublicSubscription {
  symbol: string
  companyName: string | null
  market: 'sii' | 'otc' | string
  publicSubscriptionStartDate: string | null
  publicSubscriptionEndDate: string | null
  underwritingPrice: number | null
  underwritingPriceStatus: 'provisional' | 'final' | string | null
}

export interface CapitalIncreasesResponse {
  upcoming: UpcomingCapitalIncrease[]
  paying: PayingCapitalIncrease[]
  publicSubscriptions: PublicSubscription[]
}

// 「11/27」：同 dividend-event.ts 的 monthDay，這支檔零 import 所以自己寫一行
const md = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8))}`
// 每仟股最多 4 位小數（上游有 120.45708866 這種），同個股配息頁
const perShare = (value: number) => String(Number(value.toFixed(4)))

export const ratioText = (row: { stockHoldingRatio: number | null }) => (row.stockHoldingRatio ? perShare(row.stockHoldingRatio) : '－')
export const priceText = (price: number | null) => (price ? perShare(price) : '待定價')
export const dayText = (day: string | null) => (day ? md(day) : '還沒公告')
// 期間分兩段，模板各放一個 span：手機上表格放不下時只在「～」後面折成兩行，不會拆成「11/20」「～」「11/26」三行
export const periodParts = (start: string | null, end: string | null) => (start && end ? [`${md(start)}～`, md(end)] : ['還沒公告'])
export const periodText = (start: string | null, end: string | null) => periodParts(start, end).join('')
export const MARKET_LABELS: Record<string, string> = { sii: '上市', otc: '上櫃' }

const nameOf = (row: { symbol: string; companyName: string | null }) => row.companyName ?? row.symbol

// 頁首那一句：接下來幾家要除權、最近的是誰；已除權的幾家正在繳款
export function leadText(data: CapitalIncreasesResponse): string {
  const next = data.upcoming.find(row => row.exRightsDate)
  const paying = data.paying.filter(row => row.paymentPhase === 'in_progress').length
  const parts = [
    data.upcoming.length ? `接下來 ${data.upcoming.length} 家公司現金增資除權${next ? `，最近的是${nameOf(next)} ${md(next.exRightsDate!)}` : ''}` : '目前沒有已公告、還沒除權的現金增資',
    paying ? `已除權的有 ${paying} 家正在繳款` : ''
  ].filter(Boolean)
  return `${parts.join('；')}。`
}

// 第一張表的答句：幾家、最近那家的每仟股與認購價，還沒定價、還沒公告除權日的各幾家
export function upcomingAnswer(rows: UpcomingCapitalIncrease[]): string {
  if (!rows.length) return '目前沒有已公告、還沒除權的現金增資。'
  const next = rows.find(row => row.exRightsDate)
  const unpriced = rows.filter(row => !row.subscriptionPricePerShare).length
  const undated = rows.filter(row => !row.exRightsDate).length
  const nextText = next
    ? `${nameOf(next)} ${md(next.exRightsDate!)} 最近${next.stockHoldingRatio ? `，每仟股認購 ${perShare(next.stockHoldingRatio)} 股` : ''}${next.subscriptionPricePerShare ? `、認購價 ${perShare(next.subscriptionPricePerShare)} 元` : ''}`
    : ''
  const tail = [unpriced ? `${unpriced} 家還沒定價` : '', undated ? `${undated} 家還沒公告除權日` : ''].filter(Boolean).join('、')
  return `${rows.length} 家${nextText ? `：${nextText}` : ''}${tail ? `；${tail}` : ''}。`
}

// 第二張表照繳款狀態分組：繳款中、還沒開始繳、繳款期間還沒公告（後兩組沒有就不畫）
export function payingGroups(rows: PayingCapitalIncrease[]): { phase: PayingCapitalIncrease['paymentPhase']; label: string; rows: PayingCapitalIncrease[] }[] {
  const labels = { in_progress: '繳款中', not_started: '還沒開始繳', unknown: '繳款期間還沒公告' } as const
  return (['in_progress', 'not_started', 'unknown'] as const)
    .map(phase => ({ phase, label: labels[phase], rows: rows.filter(row => row.paymentPhase === phase) }))
    .filter(group => group.rows.length)
}

export function payingAnswer(rows: PayingCapitalIncrease[]): string {
  if (!rows.length) return '目前沒有已除權、還在繳款期間的現金增資。'
  const paying = rows.filter(row => row.paymentPhase === 'in_progress')
  const first = paying.find(row => row.subscriptionPaymentEndDate)
  const later = rows.filter(row => row.paymentPhase === 'not_started').length
  const unknown = rows.filter(row => row.paymentPhase === 'unknown').length
  const parts = [
    paying.length ? `${paying.length} 家正在繳款${first ? `，最早截止的是${nameOf(first)} ${md(first.subscriptionPaymentEndDate!)}` : ''}` : '',
    later ? `另外 ${later} 家還沒開始繳` : '',
    unknown ? `${unknown} 家繳款期間還沒公告` : ''
  ].filter(Boolean)
  return `${parts.join('；')}。`
}

// 個股配息頁「下次除權息」卡片下那一行（使用者 11-25「好 案照建議」：卡片只寫股利，這家公司有現增在進行時一行連到現增頁）：
// 還沒除權寫除權日，已除權寫繳款期間；沒有進行中的現增是 null
export function stockCapitalIncreaseLine(data: CapitalIncreasesResponse, symbol: string): string | null {
  const upcoming = data.upcoming.find(row => row.symbol === symbol)
  if (upcoming) return upcoming.exRightsDate ? `${md(upcoming.exRightsDate)} 現金增資除權` : '辦理現金增資，除權日還沒公告'
  const paying = data.paying.find(row => row.symbol === symbol)
  if (!paying) return null
  return paying.subscriptionPaymentStartDate && paying.subscriptionPaymentEndDate
    ? `現金增資繳款 ${periodText(paying.subscriptionPaymentStartDate, paying.subscriptionPaymentEndDate)}`
    : '現金增資已除權，繳款期間還沒公告'
}

export function publicSubscriptionAnswer(rows: PublicSubscription[]): string {
  if (!rows.length) return '目前沒有正在公開申購的初次上市櫃公司。'
  const first = rows[0]!
  const period = first.publicSubscriptionStartDate && first.publicSubscriptionEndDate ? ` ${periodText(first.publicSubscriptionStartDate, first.publicSubscriptionEndDate)} 公開申購` : ''
  const price = first.underwritingPrice ? `，${first.underwritingPriceStatus === 'provisional' ? '暫定' : ''}承銷價 ${perShare(first.underwritingPrice)} 元` : ''
  return `${rows.length} 家${period || price ? `：${nameOf(first)}${period}${price}` : ''}。`
}
