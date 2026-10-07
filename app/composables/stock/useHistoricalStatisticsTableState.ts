// 歷年統計表（StockHistoricalStatisticsTable）共用的回溯窗狀態——從表格元件抬出來，讓未來的兄弟控制項也讀得到同一個選擇
// （同 useStatementRowFocus／useStockPeriodSelection 的先例）。2026-09-14 拿掉另外兩個狀態：圖表勾選（「我放棄我有點 複雜化了，
// 把 指標走勢比較圖 拿掉」）與 TTM／單季切換（「統一用 TTM 呈現 也不給改」，表格自己寫死 ref('TTM')）。
// 近5年／近10年同日併入全站的 近1/2/3/5/8年 刻度（見 lookback-window.ts）。
import type { LookbackWindow } from '~/utils/lookback-window'

export function useHistoricalStatisticsWindow() {
  return useState<LookbackWindow>('historical-statistics-table-window', () => '近5年')
}
