// Pure sentence builders for the question-form sections of the /stock/:code pages (2026-09-19, the
// SEO build). Same contract as stock-digest.ts: deterministic on both renders（no Date, no locale
// formatting）, the compliance register（numbers and statistical positions, no adjectives）, and a
// clause with no number is dropped rather than printed as a placeholder — never「資料不足」.

// Joins the non-empty clauses with「、」and ends the sentence; null when nothing survived.
export function joinClauses(clauses: (string | null | undefined)[], end = '。'): string | null {
  const kept = clauses.filter((clause): clause is string => !!clause)
  return kept.length ? `${kept.join('、')}${end}` : null
}

// Joins whole sentences（each already ending with 。）into one paragraph.
export function joinSentences(sentences: (string | null | undefined)[]): string | null {
  const kept = sentences.filter((sentence): sentence is string => !!sentence)
  return kept.length ? kept.join('') : null
}

// 千分位 groupThousands 2026-10-12 搬到 shared/utils/number-format.ts（跟 formatSignificantDigits 放一起）
