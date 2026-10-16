import katex from 'katex'

// Shared by every place that renders a metric's own `formulaLatex` (GET /metrics — see
// useFilterSchema.ts's own Metric comment) with KaTeX. `throwOnError: false` is deliberate: a
// malformed string (shouldn't happen since analysis-ts owns this, but it's still third-party display
// content) renders KaTeX's own inline error markup instead of crashing the caller. Display-only —
// never use the rendered string (or the source LaTeX) to recompute a value; analysis-ts's real
// numbers are bigint-precise, KaTeX evaluates in floating point.
//
// 只在伺服器跑（2026-10-16 從 app/utils 搬來，經 /api/hub/formula/[key]）：原本是瀏覽器端的自動匯入，用到它的個股頁、大師指標、
// 新手專區一開始就載入 259 KB 的 KaTeX（brotli 63 KB），而前兩種的公式都在對話框裡、載入時用不到。KaTeX 的 CSS 留在瀏覽器端
// （app/utils/metric-formula.ts、LearnArticlePage）
export function renderFormulaHtml(latex: string | null | undefined, displayMode = false): string | null {
  if (!latex) return null
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode })
  } catch {
    return null
  }
}
