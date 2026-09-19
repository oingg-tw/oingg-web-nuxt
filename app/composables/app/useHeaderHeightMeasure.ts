// Shared by the desktop (AppHeaderMenu.vue) and mobile (AppMobileHeader.vue) fixed headers —
// each measures its own real rendered height into the same --app-header-height CSS var (the
// pre-JS fallback in main.css is only an estimate) so AppPinnedSidebar and the layout's content
// padding stay correct even if a header's height changes later (e.g. the mobile header wrapping
// to two rows at some width).
//
// Since layouts/default.vue (2026-09-19) BOTH headers are mounted at every width and CSS hides
// one of them — a `display: none` header measures 0px, which must never win: only a real
// (non-zero) height is written, so the var always reflects whichever header is visible, and
// crossing the breakpoint hands it over the moment the other header's box appears.
export function useHeaderHeightMeasure(elRef: Ref<HTMLElement | undefined>) {
  let resizeObserver: ResizeObserver | undefined

  onMounted(() => {
    resizeObserver = new ResizeObserver(([entry]) => {
      const height = entry?.target.getBoundingClientRect().height ?? 0
      if (height > 0) document.documentElement.style.setProperty('--app-header-height', `${height}px`)
    })
    if (elRef.value) resizeObserver.observe(elRef.value)
  })

  onUnmounted(() => {
    resizeObserver?.disconnect()
  })
}
