// 徽章對話框裡的指標公式（2026-10-16）：HTML 由伺服器用 KaTeX 排好（server/api/hub/formula/[key].get.ts），這裡只抓。打開對話框時才抓，
// 觸發的按鈕被滑過或聚焦時先抓，打開時多半已經到了；KaTeX 的 CSS 也在第一次用到時才載。原本 render-formula 是瀏覽器端的自動匯入，
// 個股頁與大師指標一開始就載入 259 KB 的 KaTeX＋擋渲染的 CSS，公式卻只在對話框裡。同一個指標只抓一次；抓失敗就不留，下次再試
const formulas = new Map<string, Promise<string | null>>()
let katexCss: Promise<unknown> | null = null

export function loadMetricFormula(metricKey: string | null | undefined): Promise<string | null> {
  if (import.meta.server || !metricKey) return Promise.resolve(null)
  katexCss ??= import('katex/dist/katex.min.css').catch(() => {})
  let html = formulas.get(metricKey)
  if (!html) {
    html = $fetch<{ html: string | null }>(`/api/hub/formula/${metricKey}`).then(response => response.html, () => {
      formulas.delete(metricKey)
      return null
    })
    formulas.set(metricKey, html)
  }
  return Promise.all([html, katexCss]).then(([value]) => value)
}
