// Proxies GET {businessBase}/system/health (oingg-bff-ts) — this runs server-side (Nitro has no
// CORS restriction calling out to another origin), so useSystemHealth can poll a same-origin
// /api/system-health from the browser instead of hitting 業務中台 directly, which fails with
// a CORS error (業務中台 doesn't send Access-Control-Allow-Origin) even when it's perfectly
// healthy — the same known gap that already causes the anonymous /screener hydration
// mismatch documented elsewhere in this app.
// 走 businessFetch（2026-10-14）：部署後業務中台有 IAM 鎖，身分只在那一個入口加。
export default defineEventHandler(async () => {
  try {
    const response = await businessFetch<{ status: string }>('/system/health', { timeout: 5000 })
    return { ok: response.status === 'ok' }
  } catch {
    return { ok: false }
  }
})
