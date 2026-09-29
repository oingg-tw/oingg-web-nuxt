// 對數軸的刻度標籤（2026-09-29 抽出來）。ECharts 的 log 軸把刻度放在 LOG 空間的整齊位置上，所以
// 標籤會長成 10^2.6 = 398.1…、10^3.7 = 5011.87… 這種一看就像雜訊的數字；四捨五入到兩位有效數字
// （398.1 → 400、5011.87 → 5000）讓標籤位移遠小於它自己的 1%，卻變得讀得出來。
//
// 抽出來的時機是第三份拷貝要出現的時候：StockValuationRiverChart.vue（股價）、/macro/policy-rate、
// /macro/[slug] 各有一份一模一樣的，第四個呼叫端是 /macro/us-policy-rate。只有名字不同
//（formatAxisPrice／formatAxisIndex）。
//
// 不能用 formatSignificantDigits(value, 2) 代替：那支會補千分位、還會在 1e8 以上換成億／兆，
// 軸標籤兩種都不要。
export function formatLogAxisTick(value: number): string {
  if (value <= 0) return ''
  const unit = Math.pow(10, Math.floor(Math.log10(value)) - 1)
  return String(Math.round(value / unit) * unit)
}
