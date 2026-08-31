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
    const interval = setInterval(check, CHECK_INTERVAL_MS)
    onUnmounted(() => {
      clearInterval(interval)
      checking.value = false
    })
  })

  return { healthy }
}
