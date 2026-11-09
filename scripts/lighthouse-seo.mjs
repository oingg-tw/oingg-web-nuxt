// noindex 不扣的話 SEO 幾分（2026-11-09，使用者在管理站台決定 DEV 的 SEO 要顯示「noindex 扣幾分、不扣是幾分」；管理站拿不到稽核的權重，
// 所以由這裡從完整報告算）：is-crawlable 當成通過，其餘照 Lighthouse 自己的加權平均。LHR 的 auditRefs 裡 notApplicable／manual／
// informative 的權重已經是 0。分類分數是 null（有稽核出錯）就是 null，同 scoreOf。正式站 is-crawlable 本來就通過，算出來等於 seo
export function seoIfIndexable(result) {
  const category = result.categories.seo
  if (category?.score == null) return null
  const total = category.auditRefs.reduce((sum, ref) => sum + ref.weight, 0)
  if (!total) return null
  const points = category.auditRefs.reduce((sum, ref) => sum + ref.weight * (ref.id === 'is-crawlable' ? 1 : result.audits[ref.id]?.score ?? 0), 0)
  return Math.round(points / total * 100)
}
