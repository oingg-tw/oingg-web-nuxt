import type { MetricsHistoryEntry } from '#shared/types/metrics-history'
// 杜邦三項的期別篩選與數值格式（2026-10-14 從 pages/stock/[code]/dupont.vue 抽出：StockDupontChart 也要用，指標速覽可以釘杜邦分析之後）。

// 三因子、權益乘數是其中之一（2026-09-22「杜邦分析用三部分，權益乘數要是其中一個因子」）。上線時是五因子版，理由是三因子當時量到
// 82/83；analysis-ts 改用平均分母重算之後重量（恆等式 ±0.05pp／15 檔完整覆蓋）：三項近四季 109/109／13 檔、單季 115/115／15 檔，
// 五項近四季 101/101／12 檔——五項不再換到精度、反而少覆蓋（掉的正是三個獲利階段因子 insufficient_history 的公司，例如 2207）。
const DUPONT_REQUIRED = ['roe', 'netProfitMargin', 'assetTurnover', 'equityMultiplier']

export const isDupontComplete = (entry: MetricsHistoryEntry): boolean => DUPONT_REQUIRED.every(metricCode => entry.values[metricCode]?.value != null)

// 每一期都留著、缺因子的也不濾掉（2026-09-23 修正）。濾掉會讓圖對時間說謊：類別軸只認識給它的列，2330 的近四季序列把
// 「2021 Q3、2021 Q4、2024 Q1」畫成三個相鄰刻度、一條不斷的線，兩年半壓成一步——截圖抓到的，所有斷言都過。
// StockMultiSeriesLineChart 本來就 connectNulls: false 讓沒申報的期別在線上留真的缺口，在這裡濾掉等於讓 ECharts 看不到 null。
// 表格也顯示那些列（格式化後印 尚無資料），只有 latest 跳過它們（標題句要引一個真的分解得出來的期別）。
// 頭尾的空白仍然修掉、也只修頭尾：軸應該涵蓋資料真正覆蓋的範圍，而範圍內的洞是關於資料的事實。這是常態不是假設：業務中台 2026-09-23
// ——一般公司的近四季序列從 2021Q4 才有值（109Q4 的 XBRL 損益表全市場只有約 51 家），1101／2317／1216 都剛好有一個開頭的 null 季。
// 2330 沒有這個現象（2020Q3 起兩種基準都有值），業務中台 因此警告別拿它當開發樣本——它是例外，而這頁的截圖都對著它。
export function trimDupontEntries(all: MetricsHistoryEntry[]): MetricsHistoryEntry[] {
  const first = all.findIndex(isDupontComplete)
  if (first < 0) return []
  let last = all.length - 1
  while (last > first && !isDupontComplete(all[last]!)) last--
  return all.slice(first, last + 1)
}

export const dupontTimesText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)} 次`)
export const dupontMultipleText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)} 倍`)
