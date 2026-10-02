// 漲跌的文字顏色 class。**2026-10-02 之前有 12 份**：6 個 dashboard 卡各寫一個回傳自己 BEM 名稱的
// 函式，另外 6 處在模板裡寫三元式，而 12 份 <style scoped> 的兩條規則一字不差（StockCard、
// StockSummaryCard、StockTable 還各帶一份同樣的註解）。
//
// 回傳全域 class（main.css 的 .is-up／.is-down）而不是各元件的 BEM 名稱：顏色規則只有一條，
// 放在定義 --price-up-color 的同一個檔案裡，下一個人改市場慣例時只有一處要看。
//
// 0 與「讀不出數字」都不上色，那是原本 6 份就一致的語意——平盤不是漲也不是跌，上了色讀者會以為
// 有方向。`Number()` 讓 null（→0）、undefined（→NaN）、空字串（→0）、非數字字串（→NaN）全部走
// 同一條路，所以不需要各自的前置守衛。
export function priceDirectionClass(raw: string | number | null | undefined): '' | 'is-up' | 'is-down' {
  const value = Number(raw)
  if (!Number.isFinite(value) || value === 0) return ''
  return value > 0 ? 'is-up' : 'is-down'
}
