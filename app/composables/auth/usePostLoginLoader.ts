// Full-screen loader for the visible gap between a successful login and the account's own data
// becoming ready (see AppPostLoginLoader.vue for the actual overlay). UserLoginDialog.vue calls
// arm() the moment sign-in succeeds; a fetch actually gated on currentUser resolving calls
// registerPending() with its own pending ref — currently useAppTheme.ts's and
// useDashboardCards.ts's GET /users/me/* preference syncs (each registered once, inside their
// own applying-guarded onMounted, not at every useAppTheme()/useDashboardCards() call site —
// see their own comments). NOT the dashboard ranking cards' pending (revenue/valuation/
// watchlist-ex-dividend still register too, harmlessly, but their fetches are public data that
// runs for guests too — verified live that they don't actually respond to a login event, so
// they were never the real signal here).
//
// arm() alone doesn't know yet whether anything will actually go pending — a composable's own
// `watch(currentUser, ...)` fires asynchronously (Firebase's onAuthStateChanged callback, a
// tick or more after arm() runs), and a page with nothing to auto-fetch (e.g. a signed-in
// visitor already on /blog) never goes pending at all. A short "settling" window after arm()
// holds the overlay up regardless, so a real pending state that starts a few hundred ms late
// still gets caught; once that window closes, the overlay disarms itself as soon as the tracked
// count reaches zero — and a longer safety-net timeout force-disarms regardless, so a hung
// request never traps the user behind the overlay.
const SETTLE_MS = 600
const SAFETY_NET_MS = 8000

function armedState() {
  return useState('post-login-loader-armed', () => false)
}
function settlingState() {
  return useState('post-login-loader-settling', () => false)
}
function pendingCountState() {
  return useState('post-login-loader-pending-count', () => 0)
}

export function usePostLoginLoader() {
  const armed = armedState()
  const settling = settlingState()
  const count = pendingCountState()

  const isVisible = computed(() => armed.value && (settling.value || count.value > 0))

  let settleTimer: ReturnType<typeof setTimeout> | undefined
  let safetyTimer: ReturnType<typeof setTimeout> | undefined

  function clearTimers() {
    if (settleTimer) clearTimeout(settleTimer)
    if (safetyTimer) clearTimeout(safetyTimer)
  }

  function arm() {
    clearTimers()
    armed.value = true
    settling.value = true
    count.value = 0
    settleTimer = setTimeout(() => {
      settling.value = false
    }, SETTLE_MS)
    safetyTimer = setTimeout(() => {
      armed.value = false
    }, SAFETY_NET_MS)
  }

  function registerPending(pending: Ref<boolean>) {
    let was = pending.value
    if (was) count.value++
    const stop = watch(pending, value => {
      if (value === was) return
      was = value
      count.value += value ? 1 : -1
      if (armed.value && !settling.value && count.value <= 0) {
        armed.value = false
      }
    })
    onUnmounted(() => {
      stop()
      if (was) count.value--
    })
  }

  return { isVisible, arm, registerPending }
}
