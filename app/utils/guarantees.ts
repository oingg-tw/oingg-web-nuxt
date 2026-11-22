// 背書保證、資金貸與、關係人交易（數據中台第 4 項，2026-11-23；設計 https://claude.ai/artifact/BffXAybhLkibJSNAcRTDkz 的 4）。使用者 11-22
//「按照建議執行」：占淨值比只算合併報表以外的對象（判不出的當集團外），表格照列全部。三支端點都只給最新一期；那一期財報有讀到、附註
// 沒有列出時是空陣列（申報寫「無」與附表沒放分不出來，指標同樣算 0），所以寫「財報附註沒有列出」，不寫「沒有」。金額千元。
// 被 scripts/check-note-details.mjs 直接 import，所以零 import（金額的格式由呼叫端傳進來）

export interface NotePeriod {
  symbol: string
  // 最新一期（最新一期有資產負債表的季）；在公司名單但沒有任何一期財報是 null
  fiscalYear: number | null
  fiscalQuarter: number | null
  // 歸屬母公司權益（千元），占淨值的分母，跟指標一致
  equity: number | null
}

export interface ExposureTotals {
  endingBalance: number | null
  endingBalanceToEquity: number | null
  // 指標的分子：集團外加判不出（intraGroup 不是 true）
  externalEndingBalance: number | null
  externalEndingBalanceToEquity: number | null
}

export interface GuaranteeRow {
  endorser: string | null
  counterparty: string | null
  // 申報原文
  relationship: string | null
  // 處理準則附表註的關係代碼，從原文解析；只寫權益法、關聯企業這類文字的是 []
  relationshipCodes: number[]
  // true 集團內、false 集團外、null 判不出（指標裡當集團外）
  intraGroup: boolean | null
  endingBalance: number | null
  endingBalanceToEquity: number | null
  limitPerCounterparty: number | null
  // 每個背書者各寫一個
  limitOfTotalGuarantee: number | null
}

export interface EndorsementsGuarantees extends NotePeriod {
  totals: ExposureTotals
  rows: GuaranteeRow[]
}

export interface LoanRow {
  lender: string | null
  counterparty: string | null
  isRelatedParty: boolean | null
  intraGroup: boolean | null
  natureOfLoan: string | null
  // business、shortTermFinancing；兩種都寫或讀不出是 null。業務中台不寫死，出現新代碼照樣轉（2026-11-23）
  natureOfLoanKind: string | null
  // 期末餘額（董事會核准的額度），指標的分子用這一欄
  endingBalance: number | null
  actualAmountProvided: number | null
  // %；單一利率兩欄同值，無息是 0
  interestRateMin: number | null
  interestRateMax: number | null
}

export interface LoansToOthers extends NotePeriod {
  totals: ExposureTotals & { externalRelatedPartyEndingBalance: number | null; externalRelatedPartyEndingBalanceToEquity: number | null }
  rows: LoanRow[]
}

export interface RelatedPartyRow {
  // 申報原文（銷貨、進貨、取得不動產廠房及設備…）；申報沒寫科目是 null（數據中台 29dea30）
  account: string | null
  // 對象類別，申報原文
  category: string | null
  // 年報（第 4 季）只揭露全年，這兩欄是 null
  amountQuarter: number | null
  amountPriorYearQuarter: number | null
  amountYtd: number | null
  amountPriorYearYtd: number | null
}

export interface RelatedPartyTransactions extends NotePeriod {
  rows: RelatedPartyRow[]
}

type Money = (thousand: number) => string

export const notePeriodLabel = (note: NotePeriod): string | null => (note.fiscalYear === null ? null : `${note.fiscalYear} Q${note.fiscalQuarter}`)

// 兩位小數的百分比，負號是減號（同 fixedRateText；這個檔零 import）
export const percentText = (value: number | null): string => {
  if (value === null) return '－'
  const text = Math.abs(value).toFixed(2)
  return `${value < 0 && text !== '0.00' ? '−' : ''}${text}%`
}

export const groupText = (intraGroup: boolean | null): string => (intraGroup === true ? '集團內' : intraGroup === false ? '集團外' : '無法判斷')

// 處理準則附表註的七種關係（標籤照詞彙表）
const RELATIONSHIP_LABELS: Record<number, string> = {
  1: '有業務往來', 2: '直接及間接持股過半', 3: '對方直接及間接持股過半', 4: '持股九成以上的公司間', 5: '承攬工程互保', 6: '共同投資', 7: '預售屋履約保證'
}
// 沒有代碼的（只寫權益法、關聯企業）照申報原文
export const relationshipText = (row: GuaranteeRow): string => row.relationshipCodes.map(code => RELATIONSHIP_LABELS[code]).filter(Boolean).join('、') || row.relationship || '－'

const NATURE_LABELS: Record<string, string> = { business: '業務往來', shortTermFinancing: '短期融通' }
// 不認得的新代碼也寫「－」，不留空格
export const natureText = (row: LoanRow): string => (row.natureOfLoanKind && NATURE_LABELS[row.natureOfLoanKind]) || '－'

export const interestRateText = (row: LoanRow): string => {
  const { interestRateMin: min, interestRateMax: max } = row
  if (min === null && max === null) return '－'
  return min === null || max === null || min === max ? percentText(min ?? max) : `${percentText(min)}～${percentText(max)}`
}

// 兩種限額都是背書者自己訂的（母公司、子公司各一組），所以每一列寫它的背書者的：單一對象／總額
export const guaranteeLimitText = (row: GuaranteeRow, money: Money): string =>
  (row.limitPerCounterparty === null && row.limitOfTotalGuarantee === null ? '－' : [row.limitPerCounterparty, row.limitOfTotalGuarantee].map(value => (value === null ? '－' : money(value))).join('／'))

// 母公司與子公司各自替別人背書、借錢時，才多一欄寫是哪一家：只有一家時那一欄每列都一樣
export const hasSeveral = (names: (string | null)[]): boolean => new Set(names.filter(Boolean)).size > 1

// 集團外（指標算進去的）在前，各自照金額大到小；表格先列 10 筆，所以比率算的那幾筆不會被集團內的擠到後面
export function exposureOrder<T extends { intraGroup: boolean | null; endingBalance: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => Number(a.intraGroup === true) - Number(b.intraGroup === true) || (b.endingBalance ?? -1) - (a.endingBalance ?? -1))
}

export function guaranteeAnswer(note: EndorsementsGuarantees, money: Money): string | null {
  const period = notePeriodLabel(note)
  if (!period) return null
  if (!note.rows.length) return `${period} 財報附註沒有列出背書保證。`
  const external = note.totals.externalEndingBalance ?? 0
  const internal = (note.totals.endingBalance ?? 0) - external
  if (!external) return `${period} 只替集團內的公司背書保證，共 ${money(internal)}。`
  const ratio = note.totals.externalEndingBalanceToEquity
  return `${period} 替集團外背書保證 ${money(external)}${ratio === null ? '' : `，占淨值 ${percentText(ratio)}`}${internal > 0 ? `；另替集團內的公司保證 ${money(internal)}` : ''}。`
}

export function loanAnswer(note: LoansToOthers, money: Money): string | null {
  const period = notePeriodLabel(note)
  if (!period) return null
  if (!note.rows.length) return `${period} 財報附註沒有列出資金貸與。`
  const external = note.totals.externalEndingBalance ?? 0
  const internal = (note.totals.endingBalance ?? 0) - external
  if (!external) return `${period} 只借給集團內的公司，資金貸與餘額共 ${money(internal)}。`
  const ratio = note.totals.externalEndingBalanceToEquity
  const related = note.totals.externalRelatedPartyEndingBalance ?? 0
  return `${period} 對集團外的資金貸與餘額 ${money(external)}${ratio === null ? '' : `，占淨值 ${percentText(ratio)}`}`
    + `${related > 0 ? `，借給關係人的占 ${percentText(related / external * 100)}` : ''}${internal > 0 ? `；集團內另有 ${money(internal)}` : ''}。`
}

// 比率是指標的單季值（第 4 季是全年減前三季推出來的），跟端點同一期
export function relatedPartyAnswer(note: RelatedPartyTransactions, sales: number | null, purchases: number | null): string | null {
  const period = notePeriodLabel(note)
  if (!period) return null
  if (!note.rows.length) return `${period} 財報附註沒有列出關係人交易。`
  const clauses = [sales === null ? null : `向關係人銷貨占營收 ${percentText(sales)}`, purchases === null ? null : `向關係人進貨占營業成本 ${percentText(purchases)}`].filter(Boolean)
  return clauses.length ? `${period}（單季）${clauses.join('，')}。` : `${period} 財報附註列了 ${note.rows.length} 筆關係人交易。`
}

// 表格的兩欄：有單季數字就列本季與去年同季；年報（第 4 季）只有全年，整張表都沒有單季時改列年初至今
export function relatedPartyColumns(note: RelatedPartyTransactions): { ytd: boolean; labels: [string, string] } {
  if (note.rows.some(row => row.amountQuarter !== null || row.amountPriorYearQuarter !== null)) return { ytd: false, labels: ['本季', '去年同季'] }
  return { ytd: true, labels: note.fiscalQuarter === 4 ? ['全年', '去年全年'] : ['年初至今', '去年同期'] }
}
