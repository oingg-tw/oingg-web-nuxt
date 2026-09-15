// Wraps the SAME global `$fetch` every composable in this app already calls (Nuxt exposes it on
// `globalThis.$fetch`, which is what the auto-imported `$fetch` in every composable resolves to)
// so a real backend outage is caught the moment ANY composable's request actually fails, instead
// of only being discovered on useSystemHealth.ts's own next 30s poll tick — added 2026-09-14 per
// direct report ("我剛searchbar沒反應，就以為是網站掛掉，實際上是連線問題... 用戶不會知道區別，
// 用戶只會認定網站問題"). No per-composable changes needed or made — every composable keeps its
// own try/catch-and-return-null pattern for its own per-card empty state exactly as before; this
// plugin observes the same underlying requests in parallel and feeds useSystemHealth.ts's own
// `reportFailure()`, which re-verifies through that composable's existing CORS-safe
// /api/system-health proxy rather than trusting this direct signal on its own (see
// reportFailure()'s own comment for why a false alarm here self-corrects immediately).
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const { reportFailure } = useSystemHealth()

  // Only requests actually aimed at bff-ts should trigger a re-check — Nuxt's own internal
  // payload/asset fetches and this same plugin's own /api/system-health proxy call (relative,
  // same-origin, no baseURL) must not be misread as "bff-ts is down," and must not recursively
  // trigger themselves either. `options.baseURL` is set on every real backend call in this app
  // (every composable passes `baseURL: config.public.apiBase` explicitly).
  function isBackendRequest(options: { baseURL?: string }): boolean {
    return options.baseURL === config.public.apiBase
  }

  const nativeFetch = globalThis.$fetch
  // $fetch.create() returns a NEW instance with these hooks merged on top of the existing global
  // one's own behavior (retry/timeout/etc. per-call options every composable already passes
  // continue to work unchanged) — replacing `globalThis.$fetch` with it is what makes every
  // auto-imported `$fetch` call site in the whole app start going through these hooks, since that
  // auto-import is just a reference to this same global.
  globalThis.$fetch = nativeFetch.create({
    onRequestError({ options }) {
      // The request never even reached a server (DNS failure, connection refused, timeout) —
      // the exact "connection dropped, not the site being broken" case reported live.
      if (isBackendRequest(options)) reportFailure()
    },
    onResponseError({ options, response }) {
      // A real HTTP response came back — only 5xx counts as "backend is down" (a crash/outage);
      // 4xx (400/404) are this app's own everyday "no data for this query" convention used
      // throughout every composable here, never a connectivity problem.
      if (isBackendRequest(options) && response.status >= 500) reportFailure()
    }
  }) as typeof globalThis.$fetch
})
