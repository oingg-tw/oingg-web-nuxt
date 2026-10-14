import type { BookValueBreakdownEntry } from '#shared/types/stock-equity-composition'
// 每股淨值逐年變動的六個中間項（2026-10-14 從 pages/stock/[code]/equity-source.vue 抽出：StockBookValueFlowChart 與頁面的答句共用，
// 指標速覽也畫同一張）。順序＝視覺權重：淨利排第一（拿強調色）、股利第二——這兩個就是「賺得多」與「配得多」的分野，也正是淨值組成
// 那張存量圖分不出來的東西。增資與股數變動是兩件事（前者真的有錢進來，後者只是分母變了），業務中台特別強調過，不合併。
export function bookValueFlowLayers(entries: BookValueBreakdownEntry[]): { name: string; values: number[] }[] {
  return [
    { name: '本期淨利', values: entries.map(entry => entry.netIncome) },
    { name: '現金股利', values: entries.map(entry => entry.cashDividends) },
    { name: '其他綜合損益', values: entries.map(entry => entry.otherComprehensiveIncome) },
    { name: '增資', values: entries.map(entry => entry.capitalIssued) },
    { name: '股數變動', values: entries.map(entry => entry.shareCountEffect) },
    { name: '其他', values: entries.map(entry => entry.other) }
  ]
}
