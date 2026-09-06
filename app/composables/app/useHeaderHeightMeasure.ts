// Shared by both the desktop (StockSearchBar.vue) and mobile (AppMobileHeader.vue) fixed
// headers, ever since they split into two separate components — each still needs to measure
// its own real rendered height into the same --app-header-height CSS var (the pre-JS fallback
// in main.css is only an estimate) so AppPinnedSidebar and both layouts' content padding stay
// correct even if a header's height changes later (e.g. the mobile header wrapping to two
// rows at some width).
export function useHeaderHeightMeasure(elRef: Ref<HTMLElement | undefined>) {
  let resizeObserver: ResizeObserver | undefined

  onMounted(() => {
    resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) document.documentElement.style.setProperty('--app-header-height', `${entry.target.getBoundingClientRect().height}px`)
    })
    if (elRef.value) resizeObserver.observe(elRef.value)
  })

  onUnmounted(() => {
    resizeObserver?.disconnect()
  })
}
