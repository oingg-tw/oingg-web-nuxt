// 數字欄位收減號「−」與全形字（2026-11-04）：網站把負數寫成減號 U+2212（「負號統一」），從頁面複製「−12.5」貼進 el-input-number
// （type="number"）或用減號打字，Chromium 會把「−」直接丟掉、只留 12.5——正負號相反、沒有任何提示；Firefox 則讀成 NaN、數值退回原值。
// 在瀏覽器過濾之前（beforeinput、捕獲階段）把各種減號與全形數字換成半形，再交給瀏覽器照常插入（插入點、選取範圍由它處理）。
// 全站的數字欄位都經過這裡，一處處理
const NON_ASCII = /[−‐‑‒–—－０-９．]/
const toAscii = (text: string) => text.replace(/[−‐‑‒–—－]/g, '-').replace(/[０-９．]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))

export default defineNuxtPlugin(() => {
  document.addEventListener('beforeinput', (event) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement) || input.type !== 'number' || !event.data || !NON_ASCII.test(event.data)) return
    event.preventDefault()
    // execCommand 已不建議使用，但它是唯一能在 type="number"（讀不到插入點）照游標位置插字、又會觸發 input 事件的方法
    document.execCommand('insertText', false, toAscii(event.data))
  }, true)
})
