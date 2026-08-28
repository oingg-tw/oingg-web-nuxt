// Single source of truth for the mobile/desktop layout split — app.vue picks between
// layouts/desktop.vue (pinned sidebar) and layouts/mobile.vue (floating Home button +
// modal) based on this, so the breakpoint only ever lives in one place instead of being
// copied into every component that used to care about it.
//
// Starts `false` (matching what SSR always renders, since matchMedia doesn't exist on
// the server) and only picks up the real value in onMounted — reading it synchronously
// would make the client's first render disagree with the server's on an actually-wide
// window, a real hydration mismatch.
export function useIsWideLayout() {
  const isWide = ref(false)
  let mql: MediaQueryList | undefined

  function update(event: MediaQueryList | MediaQueryListEvent) {
    isWide.value = event.matches
  }

  onMounted(() => {
    mql = window.matchMedia('(min-width: 1280px)')
    update(mql)
    mql.addEventListener('change', update)
  })

  onUnmounted(() => {
    mql?.removeEventListener('change', update)
  })

  return isWide
}
