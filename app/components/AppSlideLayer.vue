<script setup lang="ts">
// The shell for a full-screen slide-in layer — 手機版導覽（2026-09-23,「按下右上角搜尋的時候，會當下
// 的整個頁面往左邊滑出，而搜尋的滿版頁面，會從右側滑入…只要按左上角，當下的畫面就往右邊滑出」）.
//
// This file owns only the CHROME: the panel, its direction, its close bar, and its focus/scroll
// behaviour. What goes inside is a slot, so the two callers（選單 and 搜尋）keep their own content
// where it already lives. The open/closed state belongs to useSlideLayer.ts, since the two layers
// must be mutually exclusive.
//
// ALWAYS RENDERED, hidden by transform — never `v-if`, and that is the SEO-load-bearing decision
// here rather than a styling preference. Measured on 2026-09-23 before any of this was written:
// the el-dialog this replaces was inside <ClientOnly>, so the mobile menu's links were in NO page's
// server HTML at all — `feature-menu` appeared in /stock/2330's 409KB response only inside the
// hydration state payload. /industries, which lives nowhere else, was therefore invisible to
// crawlers entirely. Rendering the panel unconditionally puts those anchors in the markup, which is
// the same reasoning StockPageNav.vue gives for choosing <details> over el-drawer: check-click-
// depth.mjs reads the raw server HTML with a regex and never runs a browser.
//
// NOT an el-dialog, and so not a second instance of two problems this app has already paid for:
// el-dialog's teleported subtree desyncs Vue's useId counter between server and client
// (AppFeatureMenu.vue's own comment), and its overlay gets trapped inside any ancestor carrying a
// backdrop-filter (AppMobileHeader.vue's). A plain element that is a sibling of the stage has
// neither.
const props = defineProps<{
  side: 'left' | 'right'
  open: boolean
  // Names the layer for assistive technology and labels its close bar.
  label: string
}>()

const emit = defineEmits<{ close: [] }>()

const isOpen = computed(() => props.open)
useScrollLock(isOpen)

// FOCUS HAND-OFF, both directions. Without it the panel is usable by keyboard but rude: opening
// leaves focus on a button that is about to go inert, so the browser expels it to <body>, and
// closing leaves it there — measured, a reader who pressed Escape landed on <body> and had to Tab
// from the top of the document again to get back to where they were.
const closeButtonRef = ref<{ ref?: HTMLElement } | null>(null)
let returnFocusTo: HTMLElement | null = null

watch(
  () => props.open,
  async open => {
    if (!import.meta.client) return
    if (open) {
      returnFocusTo = document.activeElement as HTMLElement | null
      await nextTick()
      // The close button, not the panel: landing on the exit is what a reader who opened this by
      // mistake needs first, and it is the only control guaranteed to exist in every layer.
      closeButtonRef.value?.ref?.focus()
    } else {
      const target = returnFocusTo
      returnFocusTo = null
      await nextTick()
      // isConnected, because the trigger can be gone by now — a link inside the layer navigates,
      // and closing then happens against a page that has already re-rendered.
      if (target?.isConnected) target.focus()
    }
  }
)

// Escape closes, matching every other dismissible surface in this app. Bound on the layer itself
// rather than document-wide so it cannot swallow Escape from anything else.
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}
</script>

<template>
  <!-- `inert` while closed does the work three separate attributes would otherwise need: the panel
       keeps its markup (crawlers and the link-depth check still read it) but is out of the tab
       order and out of the accessibility tree, so no focus can land behind the fold and axe sees no
       aria-hidden-focus violation. The stage gets the same treatment from the layout while a layer
       is open, which is what stops Tab walking into the page underneath. -->
  <div
    class="slide-layer"
    :class="[`slide-layer--${side}`, { 'slide-layer--open': open }]"
    :inert="!open"
    role="dialog"
    :aria-label="label"
    @keydown="onKeydown"
  >
    <!-- A real, visible, text exit — main.css's own .dialog-close-button comment sets this bar for
         every overlay in this app ("the reference doc wants every modal to give the visitor a real,
         TEXT exit, not just an × in the corner"). It sits at the TOP here rather than the bottom
         because a layer's content can scroll and the bar must stay where the thumb expects it. -->
    <div class="slide-layer__bar">
      <el-button ref="closeButtonRef" class="dialog-close-button" @click="emit('close')">關閉</el-button>
      <span class="slide-layer__title">{{ label }}</span>
    </div>

    <div class="slide-layer__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* z-index 20: above both headers (10) and the stock pages' bottom sheet (10), below .skip-link
   (10000), which must stay reachable from anywhere. */
.slide-layer {
  position: fixed;
  inset: 0;
  /* 100vw, not the `right: 0` that `inset` gives: html/body carry `scrollbar-gutter: stable`
     (main.css, to stop page-to-page width jitter), which shrinks the initial containing block by
     the gutter's width. A "full screen" panel sized against that leaves a 15px strip of the page
     behind showing down its right edge — measured at 390px wide, layer 375. Real phones never show
     it, since overlay scrollbars take no space and the gutter never materialises, but any desktop
     browser at a narrow width does, which is also how this gets reviewed. */
  width: 100vw;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  transition: transform 0.22s ease;
}

.slide-layer--left {
  transform: translateX(-100%);
}

.slide-layer--right {
  transform: translateX(100%);
}

.slide-layer--open {
  transform: translateX(0);
}

/* The panel is phone/tablet only — at desktop width the header carries its own nav and search, and
   a layer sliding over them would be answering a question nobody asked. Kept in the markup rather
   than removed so the server HTML is identical at every width, the rule layouts/default.vue exists
   to enforce. */
@media (min-width: 1280px) {
  .slide-layer {
    display: none;
  }
}

@media print {
  .slide-layer {
    display: none;
  }
}

/* The repo's motion convention, set by main.css's own scroll-behavior rule: motion is opt-in, not
   opt-out, because a vestibular trigger is a real cost for part of this app's audience. The layer
   still appears and disappears — it just stops travelling to get there. */
@media (prefers-reduced-motion: reduce) {
  .slide-layer {
    transition: none;
  }
}

.slide-layer__bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color-overlay);
}

.slide-layer__title {
  font-size: 1rem;
  font-weight: 600;
}

.slide-layer__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  /* Clears the iOS home indicator when the last row sits at the screen edge. */
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
</style>
