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
import { ArrowLeft } from '@element-plus/icons-vue'

const props = defineProps<{
  side: 'left' | 'right'
  open: boolean
  // Names the layer for assistive technology and labels its close bar.
  label: string
  // 打開時游標直接進層裡的輸入框（搜尋層，2026-10-22 使用者：「手機版 按下搜尋以後要自動 focus 進去searchbar」）；沒有就照舊到返回鈕
  focusInput?: boolean
}>()

const emit = defineEmits<{ close: [] }>()

// ALWAYS a back arrow in the TOP-LEFT corner, on both layers（2026-09-23）.
//
// It was briefly split by side — ← on the left for 選單, ✕ on the right for 搜尋, mirroring the
// corner that opened each（「關閉看左上還是右上，左上用上一頁，右上才用關閉」）— and then made
// uniform by the follow-up（「搜尋股票，我改設計，請一樣使用左上角的上一頁」）. Recording that here
// because the split version had its own logic and someone reading only the diff would reasonably
// wonder why the right-hand layer doesn't get an ✕.
//
// The accessible name still names the layer, so a screen reader hears「返回，離開搜尋股票」rather
// than a bare「返回」— the visible word is what went, not the information.

const isOpen = computed(() => props.open)
useScrollLock(isOpen)

// FOCUS HAND-OFF, both directions. Without it the panel is usable by keyboard but rude: opening
// leaves focus on a button that is about to go inert, so the browser expels it to <body>, and
// closing leaves it there — measured, a reader who pressed Escape landed on <body> and had to Tab
// from the top of the document again to get back to where they were.
const closeButtonRef = ref<HTMLElement | null>(null)
const bodyRef = ref<HTMLElement | null>(null)
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
      // 搜尋層例外（focusInput）：按「搜尋」就是要打字，游標直接進輸入框
      if (props.focusInput) focusInputSoon(Date.now() + 1500)
      else closeButtonRef.value?.focus()
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

// 第一次打開時搜尋框是延遲載入的元件：先畫的是佔位的輸入框，接手後換成真的（量到約 0.1 秒），焦點會跟著被換掉的元素消失。
// 所以 1.5 秒內焦點掉到層外就補到目前的輸入框；使用者自己移到返回鈕（層裡）不搶。一直沒有輸入框就退回返回鈕
function focusInputSoon(deadline: number) {
  if (!props.open) return
  const layer = bodyRef.value?.parentElement
  if (!layer?.contains(document.activeElement)) bodyRef.value?.querySelector<HTMLInputElement>('input')?.focus()
  if (Date.now() < deadline) setTimeout(() => focusInputSoon(deadline), 100)
  else if (!layer?.contains(document.activeElement)) closeButtonRef.value?.focus()
}

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
    <!-- ICON ONLY, by direct decision（2026-09-23,「關閉改成合適的logo就好，不要放文字」）, which
         reverses element-plus.css's own .dialog-close-button rule for this surface — that rule wants「a
         real, TEXT exit, not just an × in the corner」, and the 2026-09-19 interface-complexity
         review ruled bare icon buttons out on the same grounds.
         What makes it defensible HERE and not on a plain dialog: the label sits immediately beside
         it, so the control is never an isolated glyph — a reader sees「✕ 功能選單」as one unit. The
         accessible name is still a full sentence, so nothing is lost to assistive technology; only
         the redundant visible word is gone.
         The bar is at the TOP rather than the bottom because a layer's content scrolls and the exit
         must stay where the thumb expects it. -->
    <div class="slide-layer__bar">
      <!-- 跟頁首同一個樣子（.app-bar-item，2026-10-21 頁首重新設計）：原本是 Element 的框線方塊，整個手機介面只剩它有框 -->
      <button
        ref="closeButtonRef"
        type="button"
        class="app-bar-item slide-layer__close"
        :aria-label="`返回，離開${label}`"
        @click="emit('close')"
      >
        <el-icon aria-hidden="true"><ArrowLeft /></el-icon>
      </button>
      <span class="slide-layer__title">{{ label }}</span>
    </div>

    <div ref="bodyRef" class="slide-layer__body">
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
/* 見 layouts/default.vue 的同一條查詢——平板直向吃手機、橫向吃桌面。八處必須一致。
   例外（2026-10-21）：平板橫放（桌機版面、不到 1280 寬）時桌機頁首的搜尋框收成「搜尋」按鈕，開的就是這裡的搜尋層（右側），所以那個寬度
   只藏選單層；1280 以上兩層都藏 */
@media (min-width: 1280px) {
  .slide-layer {
    display: none;
  }
}

@media (min-width: 1024px) and (orientation: landscape) {
  .slide-layer--left {
    display: none;
  }
}

@media print {
  .slide-layer {
    display: none;
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

/* 44px 見方：只有圖示，借不到文字的寬度，觸控大小要自己說 */
.slide-layer__close {
  min-width: 44px;
  padding: 0;
}

.slide-layer__close .el-icon {
  font-size: 20px;
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
