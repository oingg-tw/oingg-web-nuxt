// 對數軸的刻度標籤（2026-09-29 抽出來）。ECharts 的 log 軸把刻度放在 LOG 空間的整齊位置上，所以
// 標籤會長成 10^2.6 = 398.1…、10^3.7 = 5011.87… 這種一看就像雜訊的數字；四捨五入到兩位有效數字
// （398.1 → 400、5011.87 → 5000）讓標籤位移遠小於它自己的 1%，卻變得讀得出來。
//
// 抽出來的時機是第三份拷貝要出現的時候：StockValuationRiverChart.vue（股價）、/macro/[slug] 與當時的利率頁
// 各有一份一模一樣的（利率頁 2026-10-11 刪除）。只有名字不同
//（formatAxisPrice／formatAxisIndex）。
//
// 不能用 formatSignificantDigits(value, 2) 代替：那支在 1e4 以上會換成萬／億／兆（2026-10-12 加了萬），加權指數 20,000 會變「2萬」，
// 軸標籤不要。千分位則要（2026-10-12「不要出現 2446 而是要 2,446」），所以直接用 groupThousands。
export function formatLogAxisTick(value: number): string {
  if (value <= 0) return ''
  const unit = Math.pow(10, Math.floor(Math.log10(value)) - 1)
  // 千分位（2026-10-12）：河流圖的股價軸到得了 2,000 以上
  return groupThousands(Math.round(value / unit) * unit)
}
