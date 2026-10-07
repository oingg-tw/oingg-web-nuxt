const CHECK_INTERVAL_MS = 30_000
const CHECK_TIMEOUT_MS = 5_000

// 輪詢本站的 /api/system-health（伺服器端再轉 GET {bffBase}/system/health）；瀏覽器不直接打 bff——全站的資料也都走 /api/core，
// 瀏覽器從來不碰 :4000。這是 AppSystemHealthBanner 的來源：單一共用的輪詢（useState，不是每次呼叫各一份），橫幅掛兩次也不會
// 開第二個計時器。
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

  // 2026-09-14（「我剛searchbar沒反應，就以為是網站掛掉，實際上是連線問題... 用戶不會知道區別」）：只靠 30 秒輪詢，故障開始後
  // 最長 30 秒橫幅都不會出現，而各 composable 的請求失敗只會靜默回 null。system-health-monitor.client.ts 在任何請求於網路層失敗
  // 時呼叫這裡，立刻重查一次；check() 走同一條 /api/system-health，誤報會在同一輪自我修正。
  function reportFailure() {
    healthy.value = false
    check()
  }

  // Real bug found live 2026-09-16 (reported: "app 層級的既有問題" — a `[Vue warn]: onMounted is
  // called when there is no active component instance` firing on every single page load).
  // Root-caused via a captured stack trace: system-health-monitor.client.ts (a Nuxt PLUGIN, not a
  // component) calls this composable just to grab `reportFailure` — plugins run outside any Vue
  // component instance, so Vue has nowhere to attach the onMounted callback below and warns
  // instead of silently no-opping. `reportFailure` itself doesn't depend on onMounted (it just
  // flips `healthy` and calls `check()` directly), so the plugin's own usage was never actually
  // broken by this — but the lifecycle-registration attempt itself was pure noise from a call
  // site that can never legally use it. getCurrentInstance() lets this composable stay callable
  // from both places: AppSystemHealthBanner.vue's own real component call still registers the
  // polling interval exactly as before (see this function's own body for why only the FIRST
  // mount matters), the plugin's call now skips registration entirely instead of warning.
  if (getCurrentInstance()) onMounted(() => {
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
