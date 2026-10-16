// Proxies GET {businessBase}/system/health (oingg-bff-ts) — this runs server-side (Nitro has no
// CORS restriction calling out to another origin), so useSystemHealth can poll a same-origin
// /api/system-health from the browser instead of hitting 業務中台 directly, which fails with
// a CORS error (業務中台 doesn't send Access-Control-Allow-Origin) even when it's perfectly
// healthy — the same known gap that already causes the anonymous /screener hydration
// mismatch documented elsewhere in this app.
// 走 businessFetch（2026-10-14）：部署後業務中台有 IAM 鎖，身分只在那一個入口加。
//
// 輪詢共用 15 秒（2026-10-16）：每個分頁每 30 秒、切回分頁時都會來問，原本每次都打上游，還佔用伺服器渲染也在用的 6 個上游同時連線名額
// （server/utils/business.ts），排隊超過 5 秒就會誤報故障。同一台機器 15 秒內共用一次結果，過期就重問（不用 SWR）。請求失敗後的那一次
// （useSystemHealth 的 reportFailure，帶 ?fresh=1）不走快取，故障一開始就看得到，跟原本一樣
const probeUpstream = defineCachedFunction(
  async (_fresh: boolean) => {
    try {
      const response = await businessFetch<{ status: string }>('/system/health', { timeout: 5000 })
      return { ok: response.status === 'ok' }
    } catch {
      return { ok: false }
    }
  },
  { name: 'system-health', getKey: () => 'probe', maxAge: 15, swr: false, shouldBypassCache: (fresh: boolean) => fresh }
)

export default defineEventHandler(event => probeUpstream(getQuery(event).fresh === '1'))
