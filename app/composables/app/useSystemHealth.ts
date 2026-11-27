const CHECK_INTERVAL_MS = 30_000
// 比伺服器問業務中台的 7 秒長（server/api/system-health.get.ts），不然瀏覽器先放棄，伺服器放寬也沒用
const CHECK_TIMEOUT_MS = 8_000
// 正在重查：同一刻好幾個請求一起失敗只查一次（只在瀏覽器用）
let probing = false

// 問本站的 /api/system-health（伺服器端再轉 GET {businessBase}/system/health）；瀏覽器不直接打 業務中台——全站的資料也都走 /api/core，
// 瀏覽器從來不碰 :5400。這是 AppSystemHealthBanner 的來源：狀態單一共用（useState，不是每次呼叫各一份），橫幅掛兩次也不會
// 開第二個計時器。
// 什麼時候問（2026-11-27，使用者：「這個訊息跟網站正常使用同時發生了 why?」→ 選「失敗才出現」）：平常不問。訪客自己的請求真的失敗
//（reportFailure）才查，確認上游不健康才出橫幅；之後每 30 秒與切回分頁時再查，恢復就收掉、不再問。原本不管有沒有失敗每 30 秒都問：
// 本機數據中台重啟的那幾分鐘業務中台回「依賴異常」，頁面有快取、照常能用，橫幅卻出現、把頁面往下推——受影響的人本來就有讀取失敗的提示
export function useSystemHealth() {
  const healthy = useState('system-health-ok', () => true)
  // 網站有沒有回應（2026-11-19，使用者「用戶這邊要怎麼區分是網路斷線還是我系統在更新中?」→「照建議改」）：有回應、上游不健康＝我們的問題；
  // 連狀態碼都沒有（連不上、逾時：伺服器等上游最多 7 秒就會回 ok:false）＝多半是使用者的網路。橫幅照這個換說法
  const reachable = useState('system-health-reachable', () => true)
  const checking = useState('system-health-checking-started', () => false)

  // fresh：略過伺服器那 15 秒的共用結果（server/api/system-health.get.ts），請求失敗後的重查要看上游現在的樣子
  async function check(fresh = false) {
    try {
      const response = await $fetch<{ ok: boolean }>('/api/system-health', { timeout: CHECK_TIMEOUT_MS, query: fresh ? { fresh: 1 } : undefined })
      reachable.value = true
      healthy.value = response.ok
    } catch (error) {
      reachable.value = !!classifyApiError(error).status
      healthy.value = false
    }
  }

  // 2026-09-14（「我剛searchbar沒反應，就以為是網站掛掉，實際上是連線問題... 用戶不會知道區別」）：只靠 30 秒輪詢，故障開始後
  // 最長 30 秒橫幅都不會出現，而各 composable 的請求失敗只會靜默回 null。apiFetch（打業務中台的唯一入口）在請求失敗時呼叫這裡，
  // 立刻重查一次。重查確定了才出現橫幅（2026-11-06，DEV 量到）：原本先設成不健康再查，一支請求失敗、上游其實好好的，
  // 橫幅就出現 2 秒，整頁往下推 66px 又拉回來（手機位移 0.135），還說了一句不實的「目前連不上」。真的斷線時最多晚 8 秒（CHECK_TIMEOUT_MS）
  function reportFailure() {
    // 已經不健康：橫幅在了，恢復由下面的輪詢看
    if (!healthy.value || probing) return
    probing = true
    check(true).finally(() => { probing = false })
  }

  // Real bug found live 2026-09-16 (reported: "app 層級的既有問題" — a `[Vue warn]: onMounted is
  // called when there is no active component instance` firing on every single page load).
  // Root-caused via a captured stack trace: a Nuxt PLUGIN (system-health-monitor, folded into
  // apiFetch's request hooks 2026-10-23 — still outside any component) called this composable just
  // to grab `reportFailure`, so Vue had nowhere to attach the onMounted callback below and warned
  // instead of silently no-opping. `reportFailure` itself doesn't depend on onMounted (it just
  // flips `healthy` and calls `check()` directly). getCurrentInstance() lets this composable stay
  // callable from both places: AppSystemHealthBanner.vue's own real component call still registers
  // the polling interval exactly as before (see this function's own body for why only the FIRST
  // mount matters), and a call from outside a component skips registration entirely.
  if (getCurrentInstance()) onMounted(() => {
    // Starts on the FIRST component to mount this composable, not every one — otherwise
    // the login dialog, banner, or any future consumer would each spin up their own
    // redundant 30s polling loop against the same endpoint.
    if (checking.value) return
    checking.value = true
    // 只在不健康的期間問（見檔頭）：等它恢復。計時器照樣每 30 秒醒一次，健康時什麼都不做
    // Skips the actual network call while the tab is hidden (backgrounded/minimized) rather
    // than tearing the interval down and rebuilding it — a background tab still ticks this
    // timer (throttled by the browser, but it fires), so this is just "don't bother" rather
    // than "stop". Catches back up immediately on return via the visibilitychange listener
    // below instead of waiting for the next 30s tick, so the banner is never stale for long
    // after switching back.
    const interval = setInterval(() => {
      if (!healthy.value && !document.hidden) check()
    }, CHECK_INTERVAL_MS)
    function onVisibilityChange() {
      if (!healthy.value && !document.hidden) check()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    onUnmounted(() => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      checking.value = false
    })
  })

  return { healthy, reachable, reportFailure }
}
