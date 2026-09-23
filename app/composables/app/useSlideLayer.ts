// Which full-screen slide-in layer is open — 手機版的選單與搜尋（2026-09-23,「手機版彈窗希望改掉，
// 改成滑入一個完整的圖層…比照元大券商軟體」）. Replaces useFeatureMenu.ts, whose el-dialog this
// supersedes.
//
// ONE piece of state for both layers, not a boolean each: they are mutually exclusive by
// construction this way, so the「彈窗疊彈窗」case this app refuses elsewhere cannot arise even if
// two triggers fire together.
//
// useState (not a plain module-level ref) for the same SSR-safety reason every other
// cross-component toggle here uses it — a bare module ref would leak state across requests on the
// server. That reason is inherited verbatim from useFeatureMenu.ts, which this replaces.
export type SlideLayerId = 'menu' | 'search'

// Which way the PAGE goes when each layer opens. Mirrors the physical control: the menu button is
// top-left and its layer arrives from the left, so the page it displaces leaves to the right.
const PUSH_DIRECTION: Record<SlideLayerId, 'left' | 'right'> = {
  menu: 'right',
  search: 'left'
}

export function useSlideLayer() {
  const openLayer = useState<SlideLayerId | null>('slide-layer-open', () => null)

  // The class the sliding stage wears. Null at rest, and that matters more than it looks: a
  // `transform` on the stage re-anchors every `position: fixed` descendant to it (both headers and
  // the stock pages' bottom sheet), which is exactly right WHILE the screen slides and exactly
  // wrong at rest — the stage is taller than the viewport, so a "fixed" header would scroll away
  // with the page. Applying the class only while a layer is open keeps the resting computed value
  // at `transform: none`, which creates no containing block.
  //
  // Nothing has to clean up after the closing animation: a transition from a translate back to no
  // transform interpolates against the identity matrix and ends at `none` on its own. This is also
  // why `will-change: transform` must never be added here — that WOULD pin the containing block
  // permanently and reintroduce the bug the paragraph above avoids.
  const stageClass = computed(() => (openLayer.value ? `is-pushed-${PUSH_DIRECTION[openLayer.value]}` : null))

  // A history entry with the SAME url, so the phone's back button / back gesture closes the layer
  // instead of leaving the page — the behaviour a reader coming from a broker app will expect, and
  // the one they will otherwise try first. Deliberately NOT a route or a query parameter: a /search
  // or /menu url would be a thin page (and /menu would duplicate the existing /sitemap), and this
  // repo forbids view state in urls outright — check-hub-pages.mjs asserts `no query links`.
  let pushedEntry = false

  function onPopState() {
    // The entry we pushed has been popped: the layer is what the reader was dismissing.
    pushedEntry = false
    openLayer.value = null
  }

  function open(id: SlideLayerId) {
    if (openLayer.value === id) return
    openLayer.value = id
    if (import.meta.client && !pushedEntry) {
      history.pushState(null, '', location.href)
      pushedEntry = true
      window.addEventListener('popstate', onPopState, { once: true })
    }
  }

  function close() {
    if (!openLayer.value) return
    openLayer.value = null
    // Consume our own history entry so the reader's next back press leaves the page as usual,
    // rather than silently doing nothing because a stale entry is still sitting there.
    if (import.meta.client && pushedEntry) {
      pushedEntry = false
      window.removeEventListener('popstate', onPopState)
      history.back()
    }
  }

  function toggle(id: SlideLayerId) {
    if (openLayer.value === id) close()
    else open(id)
  }

  return { openLayer, stageClass, open, close, toggle }
}
