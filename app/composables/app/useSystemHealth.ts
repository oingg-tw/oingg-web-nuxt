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

  // Added 2026-09-14 per direct report ("我剛searchbar沒反應，就以為是網站掛掉，實際上是連線
  // 問題... 用戶不會知道區別") — the 30s poll alone means a real outage can sit undetected (and
  // the banner absent) for up to 30s after it starts, exactly the window the user hit: some
  // OTHER composable's own request already failed and silently returned null/empty (every
  // composable's own established "catch, log in dev, return null" convention — correct for that
  // card's own empty state, but gives the user zero signal it's a connectivity problem rather
  // than "this stock has no data"/"the site is broken"). connection-monitor.client.ts calls this
  // the moment ANY real backend request fails at the network level, forcing an immediate re-check
  // instead of waiting for the next scheduled tick — `check()` itself still goes through the
  // CORS-safe /api/system-health proxy (see this file's own top comment), so a call here that
  // turns out to be a same-origin-vs-CORS false alarm (the direct browser→bff-ts call that
  // triggered this failing for reasons unrelated to bff-ts's own health) self-corrects within
  // this same round trip rather than latching onto a wrong verdict.
  function reportFailure() {
    healthy.value = false
    check()
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

  return { healthy, reportFailure }
}
