// A read that is allowed to be missing: resolve it, or resolve to null, but never let it take the
// whole route down with a 500. Six copies of this existed until 2026-10-02 — five generic, one
// narrowed to FinancialStatementResponse for no reason — and not one of them carried a comment,
// although four of their call sites did.
//
// The rationale, from the clearest of those call-site comments (metric.get.ts): "a history-endpoint
// hiccup must degrade the page, never 500 it. What 'degrade' means is the page's call (noindex, a
// 尚無資料 line) — this route only reports what it found." That division is the point: this helper
// decides nothing about presentation, it only turns a rejection into an absence.
//
// What it deliberately loses, and why that is a real cost worth writing down: a bare `catch`
// flattens every status into the same null, so a 400 (our request is wrong) becomes
// indistinguishable from a 502 (upstream is down) and from a 200 that genuinely had no data. Our
// own status contract says 200 is the only place "no data" should appear. Wrapping a call in
// settle() therefore hides our own bugs as "this section is empty" — which is exactly what
// happened for weeks on the metrics-history cache while it was silently failing to write.
//
// Keep it anyway: the alternative at each of the ~20 call sites is a try/catch that has to decide
// what degrading means, and the call sites' own comments show they don't want that decision. But
// the one place where a smarter rule could live is now this file instead of six, so rethrowing on
// 4xx (our bug) while still swallowing 5xx (theirs) is a change to one function, not six.
//
// Not every optional read needs it: book-value-breakdown.get.ts notes that its upstream returns an
// empty array rather than a 404, so it has nothing to swallow. Check before wrapping.
export async function settle<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise
  } catch {
    return null
  }
}
