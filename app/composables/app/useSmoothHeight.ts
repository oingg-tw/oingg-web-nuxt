// Animates an element's height smoothly whenever its natural (content-driven) height
// changes, instead of the instant snap a plain height:auto gives you for free. Built for
// PresetFolder.vue's .stock-preset-folder__body — switching between filter-preset tabs
// with different numbers of conditions, or column-preset tabs with different row counts,
// otherwise snapped the whole block to its new height in one frame, shoving everything
// below it up or down ("screener 從一個tab切換到另一個tab的時候會抖動").
//
// Uses ResizeObserver rather than watching whatever prop happens to drive the content's
// size (e.g. a table's `rows`): a naive "pin old height, wait a tick, remeasure, animate"
// approach was tried first and confirmed live NOT to work reliably — descendant components
// (el-table in particular) don't always finish reflecting their own prop changes within the
// same tick the rest of Vue does, so remeasuring "after nextTick" can read a stale value,
// and pinning the container's height/overflow ourselves while waiting can itself further
// delay however the descendant settles. ResizeObserver only fires once the browser has
// genuinely finished laying out a real size change (so it's never measuring something that
// hasn't happened yet), and its callback is specified to run after layout but before the
// next paint — the exact window needed to pin back to the OLD height and kick off a real
// animation without any of this ever being visible as a separate jump.
//
// Takes TWO refs, not one — this is the second, harder bug that showed up once this was
// actually wired into the real page (confirmed live: the body kept oscillating forever,
// never settling). Observing and animating the SAME element doesn't work: overflow:hidden
// establishes a new block formatting context, which changes how a child's margins collapse
// through this element — so the "natural" height measured with overflow reset back to ''
// at the end of each cycle can come out DIFFERENT from the height that was just animated
// to (purely from the overflow toggle itself, no real content change involved), which
// ResizeObserver sees as a genuine resize and immediately kicks off another cycle — forever.
// Splitting the two roles fixes it: `contentRef` is a plain, never-styled child (wrap the
// actual content in it) that always reports its true natural size regardless of what the
// wrapper's own overflow/height happen to be; `wrapperRef` is the element that actually
// gets the pin-then-animate styling. Observing contentRef instead of wrapperRef means the
// measurement is never contaminated by our own styling of its ancestor.
//
// Apply this at exactly ONE level of a nested layout, not several — an inner element
// animating its own height changes the outer element's natural height too, at every
// intermediate frame of that animation, which would otherwise retrigger a second,
// independent, fighting animation on the outer element as well.
export function useSmoothHeight(
  wrapperRef: Ref<HTMLElement | undefined>,
  contentRef: Ref<HTMLElement | undefined>,
  durationMs = 200
) {
  let lastHeight: number | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  // Guards against reacting to our own animation's intermediate frames — every px step of
  // the CSS transition below is itself a resize, which would otherwise retrigger this and
  // fight itself. Set for the animation's own duration; resize events observed while true
  // just update lastHeight and stop there, no new animation.
  let isAnimating = false
  let observer: ResizeObserver | undefined

  function handleResize(newHeight: number) {
    const el = wrapperRef.value
    if (!el || lastHeight === null || isAnimating) {
      lastHeight = newHeight
      return
    }
    const fromHeight = lastHeight
    if (Math.abs(newHeight - fromHeight) < 1) return
    lastHeight = newHeight
    isAnimating = true
    clearTimeout(timer)
    el.style.transition = ''
    el.style.overflow = 'hidden'
    el.style.height = `${fromHeight}px`
    requestAnimationFrame(() => {
      el.style.transition = `height ${durationMs}ms ease`
      el.style.height = `${newHeight}px`
      timer = setTimeout(() => {
        el.style.transition = ''
        el.style.height = ''
        el.style.overflow = ''
        isAnimating = false
      }, durationMs)
    })
  }

  onMounted(() => {
    const content = contentRef.value
    if (!content) return
    lastHeight = content.getBoundingClientRect().height
    observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) handleResize(entry.contentRect.height)
    })
    observer.observe(content)
  })
  onUnmounted(() => {
    observer?.disconnect()
    clearTimeout(timer)
  })
}
