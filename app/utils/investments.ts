// 大陸投資與轉投資（數據中台第 5 項，2026-11-23；設計 https://claude.ai/artifact/BffXAybhLkibJSNAcRTDkz 的 5）。使用者 11-22「按照建議
// 執行」：大陸投資占淨值比用帳面；11-23 選「要分」：被投資公司分出子公司（集團內）與關聯企業。兩支端點都只給最新一期，空陣列寫「財報附註
// 沒有列出」（同 guarantees.ts）。金額千元。被 scripts/check-note-details.mjs 直接 import，所以只 import 型別（金額的格式由呼叫端傳進來）
import type { NotePeriod } from './guarantees'

export interface MainlandInvestee {
  investee: string | null
  mainBusinesses: string | null
  // 層層相乘的實質持股（%）
  ownershipPct: number | null
  bookValue: number | null
  investmentIncomeRecognized: number | null
}

export interface MainlandChinaInvestments extends NotePeriod {
  totals: {
    // 指標的分子
    bookValue: number | null
    bookValueToEquity: number | null
    // 限額表各公司的合計：本期期末累計自台灣匯出、經濟部投審會核准，與用掉的比率
    accumulatedInvestment: number | null
    authorizedAmount: number | null
    authorizedUsage: number | null
  }
  // 帳面大到小，沒有金額的放最後
  investees: MainlandInvestee[]
}

export interface Investee {
  investor: string | null
  investee: string | null
  location: string | null
  mainBusinesses: string | null
  ownershipPct: number | null
  bookValue: number | null
  investeeNetIncome: number | null
  investmentIncomeRecognized: number | null
  // true 子公司（持股加總過半或列在合併個體表）、false 關聯企業等、null 判不出
  intraGroup: boolean | null
}

export interface Investees extends NotePeriod {
  // 同一家被兩個投資人持有時出現兩列，家數看這裡（同名算一家）
  totals: { intraGroupCount: number; externalCount: number; unresolvedCount: number }
  // 帳面大到小，沒有金額的放最後
  rows: Investee[]
}

type Money = (thousand: number) => string

const periodOf = (note: NotePeriod): string | null => (note.fiscalYear === null ? null : `${note.fiscalYear} Q${note.fiscalQuarter}`)
const percent = (value: number): string => `${value < 0 && Math.abs(value).toFixed(2) !== '0.00' ? '−' : ''}${Math.abs(value).toFixed(2)}%`

export const investeeKindText = (intraGroup: boolean | null): string => (intraGroup === true ? '子公司' : intraGroup === false ? '關聯企業' : '無法判斷')

export function mainlandAnswer(note: MainlandChinaInvestments, money: Money): string | null {
  const period = periodOf(note)
  if (!period) return null
  if (!note.investees.length) return `${period} 財報附註沒有列出大陸投資。`
  const { bookValue, bookValueToEquity, accumulatedInvestment, authorizedUsage } = note.totals
  // KY 公司不是台灣公司，沒有限額表：只寫帳面
  const remittance = accumulatedInvestment === null ? '' : `；累計從台灣匯出 ${money(accumulatedInvestment)}${authorizedUsage === null ? '' : `，用掉經濟部核准額度的 ${percent(authorizedUsage)}`}`
  return `${period} 大陸投資帳面 ${money(bookValue ?? 0)}${bookValueToEquity === null ? '' : `，占淨值 ${percent(bookValueToEquity)}`}${remittance}。`
}

export function investeesAnswer(note: Investees, money: Money): string | null {
  const period = periodOf(note)
  if (!period) return null
  if (!note.rows.length) return `${period} 財報附註沒有列出被投資公司。`
  const { intraGroupCount, externalCount, unresolvedCount } = note.totals
  const counts = [intraGroupCount && `子公司 ${intraGroupCount} 家`, externalCount && `關聯企業 ${externalCount} 家`, unresolvedCount && `無法判斷 ${unresolvedCount} 家`].filter(Boolean).join('、')
  const top = note.rows[0]!
  // 所在地寫「其他」的不寫在哪
  const place = top.location && top.location !== '其他' ? `，在${top.location}` : ''
  return `${period} ${counts}${top.bookValue === null ? '' : `；帳面最大的是 ${top.investee} ${money(top.bookValue)}${place}`}。`
}
