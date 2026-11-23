// 漲跌的文字顏色 class。**2026-10-02 之前有 12 份**：6 個 dashboard 卡各寫一個回傳自己 BEM 名稱的
// 函式，另外 6 處在模板裡寫三元式，而 12 份 <style scoped> 的兩條規則一字不差（StockCard、
// StockSummaryCard、StockTable 還各帶一份同樣的註解）。
//
// 回傳全域 class（theme.css 的 .is-up／.is-down）而不是各元件的 BEM 名稱：顏色規則只有一條，
// 放在定義 --price-up-color 的同一個檔案裡，下一個人改市場慣例時只有一處要看。
//
// 0 與沒有值都不上色，那是原本 6 份就一致的語意——平盤不是漲也不是跌，上了色讀者會以為有方向。
export function priceDirectionClass(value: number | null | undefined): '' | 'is-up' | 'is-down' {
  if (!value) return ''
  return value > 0 ? 'is-up' : 'is-down'
}

// 篩選結果表（SharedMetricTable）哪些欄上漲跌色：指標名稱以年增率／年減率（可以再接「變化」）結尾（2026-10-22，使用者：「篩選 表格
// 舉凡 年增率 年減率 數字 都用 漲跌色」），或以漲跌／漲跌幅結尾（2026-11-23，使用者：「screener/preferred 有些數字可以上漲跌色」）。
// 「營收年增率波動」是標準差、永遠是正的，不是增減，所以不上色。scripts/check-price-direction.mjs
export const colorsByDirection = (name: string): boolean => /(年增率|年減率)(變化)?$|漲跌幅?$/.test(name)
