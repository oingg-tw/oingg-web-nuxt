import katex from 'katex'
import 'katex/dist/katex.min.css'

// Shared by every place that renders a metric's own `formulaLatex` (GET /metrics — see
// useFilterSchema.ts's own FilterMetric comment) with KaTeX — pulled out for
// guru-indicators.vue's new indicator rows so a third call site doesn't reimplement the same
// try/catch. `throwOnError: false` is deliberate: a malformed string (shouldn't happen since
// analysis-ts owns this, but it's still third-party display content) renders KaTeX's own inline
// error markup instead of crashing the caller. Display-only — never use the rendered string (or
// the source LaTeX) to recompute a value; analysis-ts's real numbers are bigint-precise, KaTeX
// evaluates in floating point.
export function renderFormulaHtml(latex: string | null | undefined, displayMode = false): string | null {
  if (!latex) return null
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode })
  } catch {
    return null
  }
}
