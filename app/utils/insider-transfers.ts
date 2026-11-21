import { groupThousands } from '../../shared/utils/number-format.ts'

// 內部人申報轉讓（數據中台 B 批第 12 項，2026-11-22；詞彙表二之五之八；設計 https://claude.ai/artifact/BffXAybhLkibJSNAcRTDkz）：
// 董監、經理人與大股東轉讓持股前的事前申報，上市取自證交所、上櫃取自櫃買（2026-09、11 起），興櫃沒有來源。一位申報人一列，新到舊。
// 使用者 11-22 決定不帶姓名（受讓人多半是家人；也不做依人名查詢），申報早於開始收資料、期滿沒轉讓對不上的那種不列（「先不列」）
export interface InsiderShares {
  own: number | null
  trust: number | null
}

export interface InsiderTransfer {
  // 出表日（交易所產生這份資料的日期），頁面依它分組
  generatedDate: string
  // 身分、轉讓方式照原文
  declarantRole: string
  transferMethod: string
  // 一般交易沒有特定受讓人時是 0
  transfereeCount: number
  plannedTransferShares: InsiderShares
  sharesBefore: InsiderShares
  sharesAfter: InsiderShares
  transferStartDate: string | null
  transferEndDate: string | null
  // 期滿沒轉讓的申報；沒有是 null
  untransferred: { reason: string | null; ownShares: number | null; trustShares: number | null } | null
}

export interface InsiderTransfers {
  symbol: string
  entries: InsiderTransfer[]
}

export const sharesOf = (shares: InsiderShares) => (shares.own ?? 0) + (shares.trust ?? 0)
const lots = (shares: number) => groupThousands(Math.round(shares / 1000))

// 1 張是 1,000 股；不到 1 張的零股寫「不到 1 張」（1540 的董事配偶轉讓後剩 36 股）
export const lotsText = (shares: number) => (shares > 0 && shares < 1000 ? '不到 1 張' : `${lots(shares)} 張`)

// 原文太長的方式換成短的（手機上一格放得下），其他照原文；贈與這種有受讓人的寫幾人，不寫是誰
const METHOD_TEXT: Record<string, string> = { '一般交易(每日得轉讓股數限制)': '一般交易（每日有上限）' }
export const transferMethodText = (entry: InsiderTransfer) => `${METHOD_TEXT[entry.transferMethod] ?? entry.transferMethod}${entry.transfereeCount > 0 ? `（${entry.transfereeCount} 人）` : ''}`

export function holdingChangeText(entry: InsiderTransfer): string {
  const before = sharesOf(entry.sharesBefore)
  const after = sharesOf(entry.sharesAfter)
  return after > 0 && after < 1000 ? `${lotsText(before)} → 不到 1 張` : `${lots(before)} → ${lots(after)} 張`
}

// 日期寫 M/D；兩端跨年才帶年份（同停止買賣那一句）
const monthDay = (iso: string, withYear: boolean) => `${withYear ? `${iso.slice(0, 4)}/` : ''}${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`
export function transferPeriodText(entry: InsiderTransfer): string {
  const { transferStartDate: start, transferEndDate: end } = entry
  if (!start || !end) return start ? `${monthDay(start, false)} 起` : '－'
  const withYear = start.slice(0, 4) !== end.slice(0, 4)
  return `${monthDay(start, withYear)}～${monthDay(end, withYear)}`
}

// 期滿沒轉讓的那一列底下寫一句
export function untransferredText(entry: InsiderTransfer): string | null {
  const left = entry.untransferred
  if (!left) return null
  const shares = (left.ownShares ?? 0) + (left.trustShares ?? 0)
  return `期間內沒有轉讓${shares > 0 ? ` ${lotsText(shares)}` : ''}${left.reason ? `：${left.reason}` : ''}。`
}

// 依出表日分組（上游已經新到舊排好）
export function insiderTransferGroups(entries: InsiderTransfer[]): { day: string; items: InsiderTransfer[] }[] {
  const groups: { day: string; items: InsiderTransfer[] }[] = []
  for (const entry of entries) {
    if (groups.at(-1)?.day !== entry.generatedDate) groups.push({ day: entry.generatedDate, items: [] })
    groups.at(-1)!.items.push(entry)
  }
  return groups
}

// 答句寫最新那一天：幾位、合計幾張、占普通股多少、轉讓期間到哪天
export function insiderTransferAnswer(entries: InsiderTransfer[], issuedShares: number | null): string | null {
  const [latest] = insiderTransferGroups(entries)
  if (!latest) return null
  const planned = latest.items.reduce((sum, entry) => sum + sharesOf(entry.plannedTransferShares), 0)
  // 大型股的一筆申報常常不到 0.01%（2890 的 150 張），四捨五入成 0.00% 讀起來像沒有
  const pct = issuedShares ? planned / issuedShares * 100 : null
  const share = pct === null ? '' : `，占普通股${pct < 0.005 ? '不到 0.01%' : ` ${pct.toFixed(2)}%`}`
  const end = latest.items.map(entry => entry.transferEndDate).filter((date): date is string => !!date).sort().at(-1)
  return `${monthDay(latest.day, false)} 有 ${latest.items.length} 位內部人申報轉讓，合計 ${lotsText(planned)}${share}${end ? `；轉讓期間到 ${monthDay(end, false)}` : ''}。`
}
