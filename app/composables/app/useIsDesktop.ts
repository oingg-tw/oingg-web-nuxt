// A narrower breakpoint than useDeviceLayout's useIsWideLayout (1280px, which picks between
// the pinned-sidebar and mobile-chrome page layouts) — this one is for individual pieces of
// UI (the field-picker dialog, the range-editor popover) deciding between an anchored
// dropdown and a fullscreen/centered mobile dialog. Shared so every such component agrees on
// the same threshold instead of each hand-rolling its own matchMedia check that could drift
// out of sync with the others.
//
// Starts `false` (matching what SSR always renders, since matchMedia doesn't exist on the
// server) and only picks up the real value in onMounted — reading it synchronously would
// make the client's first render disagree with the server's on an actually-wide window, a
// real hydration mismatch.
export function useIsDesktop() {
  const isDesktop = ref(false)
  let mql: MediaQueryList | undefined

  function update(event: MediaQueryList | MediaQueryListEvent) {
    isDesktop.value = event.matches
  }

  onMounted(() => {
    mql = window.matchMedia('(min-width: 768px)')
    update(mql)
    mql.addEventListener('change', update)
  })

  onUnmounted(() => {
    mql?.removeEventListener('change', update)
  })

  return isDesktop
}
