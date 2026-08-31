const CHECK_INTERVAL_MS = 30_000
const CHECK_TIMEOUT_MS = 5_000

// Polls this app's own /api/system-health (see server/api/system-health.get.ts), which
// proxies GET {apiBase}/system/health on oingg-bff-ts server-side — the same backend
// useFilterSchema/useStocks silently fall back to mock data against when unreachable.
// Deliberately NOT calling bff-ts directly from here: bff-ts doesn't send
// Access-Control-Allow-Origin, so a browser-side fetch to it fails with a CORS error even
// when it's perfectly healthy (the same known gap behind the anonymous /screener hydration
// mismatch documented elsewhere in this app) — routing through our own server sidesteps
// that since CORS is a browser policy, not one that applies server-to-server.
// This is the live signal behind AppSystemHealthBanner: a single shared poll (useState, not
// per-call state) so mounting the banner more than once never starts a second interval
// hammering the endpoint.
export function useSystemHealth() {
  const healthy = useState('system-health-ok', () => true)
  const checking = useState('system-health-checking-started', () => false)

  async function check() {
    try {
      const response = await $fetch<{ ok: boolean }>('/api/system-health', { timeout: CHECK_TIMEOUT_MS })
      healthy.value = response.ok
    } catch {
      healthy.value = false
    }
  }

  onMounted(() => {
    // Starts on the FIRST component to mount this composable, not every one — otherwise
    // the login dialog, banner, or any future consumer would each spin up their own
    // redundant 30s polling loop against the same endpoint.
    if (checking.value) return
    checking.value = true
    check()
    // Skips the actual network call while the tab is hidden (backgrounded/minimized) rather
    // than tearing the interval down and rebuilding it — a background tab still ticks this
    // timer (throttled by the browser, but it fires), so this is just "don't bother" rather
    // than "stop". Catches back up immediately on return via the visibilitychange listener
    // below instead of waiting for the next 30s tick, so the banner is never stale for long
    // after switching back.
    const interval = setInterval(() => {
      if (!document.hidden) check()
    }, CHECK_INTERVAL_MS)
    function onVisibilityChange() {
      if (!document.hidden) check()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    onUnmounted(() => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      checking.value = false
    })
  })

  return { healthy }
}
