// Blocks background scroll while a modal is open WITHOUT ever touching `overflow` — Element
// Plus's own el-dialog `lock-scroll` (default true) locks scroll by setting
// `overflow-y: hidden` directly on <body>, which removes/changes the scrollbar and shifts
// content width even with `scrollbar-gutter: stable` applied to body (that property's gutter
// reservation isn't reliably honored across a visible -> explicit-hidden overflow transition
// the way it is for a visible -> auto-with-overflowing-content one — confirmed live: the
// html/body scrollbar-gutter fix for page-to-page navigation jitter did NOT stop the same
// jitter when a modal's lock-scroll kicked in, reported as "手機板 打開功能的時候 還是會把
// scroll-bar隱藏造成寬度變化...有無方式可以不隱藏 scroll-bar 就讓用戶不可scroll?").
//
// Callers pass `:lock-scroll="false"` to their own el-dialog/el-drawer and call this instead —
// overflow and scrollbar rendering never change at all; scroll is blocked by intercepting
// wheel/touchmove events that target outside the currently-open overlay's own content (so the
// dialog's own internal scrolling, e.g. AppFeatureMenu's nav grid, still works normally).
export function useScrollLock(isLocked: Ref<boolean>) {
  function shouldBlock(event: Event) {
    return !(event.target as HTMLElement | null)?.closest('.el-overlay')
  }

  function handleWheel(event: WheelEvent) {
    if (shouldBlock(event)) event.preventDefault()
  }

  function handleTouchMove(event: TouchEvent) {
    if (shouldBlock(event)) event.preventDefault()
  }

  function attach() {
    document.addEventListener('wheel', handleWheel, { passive: false })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
  }

  function detach() {
    document.removeEventListener('wheel', handleWheel)
    document.removeEventListener('touchmove', handleTouchMove)
  }

  watch(isLocked, locked => {
    if (locked) attach()
    else detach()
  })

  onUnmounted(detach)
}
