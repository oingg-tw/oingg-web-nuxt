import { groupThousands } from '~/utils/stock-answers'

// 持股頁的金額寫法，兩頁共用（持股總覽、績效）。名字帶 holdings 前綴：app/utils 的 export 會自動匯入到
// 整個 app，通名（money、signedMoney）遲早被某個檔案的同名區域函式靜默遮蔽。

export function holdingsMoney(value: number): string {
  return groupThousands(Math.round(value))
}

// 損益同時用正負號與 ▲／▼ 表示，不只靠顏色；0 不加箭頭（平盤不是漲也不是跌）。
export function holdingsSignedMoney(value: number | null): string {
  if (value === null) return '－'
  const rounded = Math.round(value)
  if (rounded === 0) return '0 元'
  return `${rounded > 0 ? '▲ +' : '▼ '}${groupThousands(rounded)} 元`
}

// 報酬率（小數，例如 0.123456）→「+12.35%」。0 不加正號；null 是「－」。
export function holdingsSignedPct(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return '－'
  const fixed = (ratio * 100).toFixed(2)
  if (Number(fixed) === 0) return '0.00%'
  return `${ratio > 0 ? '+' : ''}${fixed}%`
}

// ---- 持股頁的期間選擇（交易績效、風險共用） ----

// 交易日期以台北時間為準：使用者在國外、或伺服器跑 UTC 時，每天前 8 小時會差一天。
export function holdingsTaipeiDate(offsetYears = 0): string {
  const now = new Date(Date.now() + 8 * 3600_000)
  now.setUTCFullYear(now.getUTCFullYear() + offsetYears)
  return now.toISOString().slice(0, 10)
}

export const HOLDINGS_RANGE_SHORTCUTS = [
  { text: '近三個月', value: () => { const end = new Date(); const start = new Date(); start.setMonth(start.getMonth() - 3); return [start, end] } },
  { text: '近一年', value: () => { const end = new Date(); const start = new Date(); start.setFullYear(start.getFullYear() - 1); return [start, end] } },
  { text: '今年以來', value: () => { const end = new Date(); return [new Date(end.getFullYear(), 0, 1), end] } },
  { text: '近三年', value: () => { const end = new Date(); const start = new Date(); start.setFullYear(start.getFullYear() - 3); return [start, end] } }
]

// el-date-picker 給的是本地午夜的 Date；用本地日期比，不要 toISOString（UTC+8 會倒退一天）。
export function holdingsIsFutureDate(date: Date): boolean {
  const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return local > holdingsTaipeiDate()
}
