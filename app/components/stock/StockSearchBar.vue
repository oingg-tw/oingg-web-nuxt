<script setup lang="ts">
import { Menu, Search } from '@element-plus/icons-vue'
import { NO_MATCH_SENTINEL } from '~/composables/stock/useStockSearch'

const { keyword, fetchSuggestions, handleSelect, handleEnter } = useStockSearch()
const contentWidthMode = useContentWidthMode()

// Same breakpoint app.vue itself uses to pick desktop.vue vs mobile.vue — this component is
// mounted by both, and now needs to render meaningfully different markup for each (mobile:
// menu-trigger + collapsed search icon; desktop: unchanged logo + inline search), not just
// different CSS on the same elements.
const isWide = useIsWideLayout()

// Mobile's left-side control used to be AppLogo linking home — replaced with a menu-trigger
// icon that opens AppFeatureMenu's dialog instead ("logo 改成開啟功能菜單"). useFeatureMenu()
// is shared state, not a local ref, so this opens the SAME dialog instance mobile.vue's own
// floating bottom button already controls, rather than a second independent one.
const { open: openFeatureMenu } = useFeatureMenu()

// Mobile's search collapses to an icon-only trigger in the top-right corner ("github icon
//隱藏 只保留 search 並且改成一個icon放在右上角") instead of the always-visible inline input
// desktop keeps — tapping it opens this dialog, which reuses LandingStockSearch.vue rather
// than re-inlining the ClientOnly/el-autocomplete SSR-hydration workaround block a second
// time in this same file (see the desktop branch's own comment on that below).
const mobileSearchVisible = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => {
  mobileSearchVisible.value = false
})

// --app-header-height in main.css is only a pre-JS fallback estimate; measure the bar's
// real rendered height once mounted so AppPinnedSidebar and the layout's content padding
// always line up with it exactly, even if this bar's own height changes later.
const barRef = ref<HTMLElement>()
let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  resizeObserver = new ResizeObserver(([entry]) => {
    if (entry) document.documentElement.style.setProperty('--app-header-height', `${entry.target.getBoundingClientRect().height}px`)
  })
  if (barRef.value) resizeObserver.observe(barRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <div ref="barRef" class="stock-search-bar">
    <!-- Mobile branch: menu-trigger (replaces the logo's old home-link behavior) + a
         collapsed search icon, no GitHub link, no inline input — see the script's own
         comments for why each changed. Desktop branch below is entirely unchanged. -->
    <template v-if="!isWide">
      <el-button
        :icon="Menu"
        circle
        class="stock-search-bar__mobile-btn"
        title="功能選單"
        aria-label="開啟功能選單"
        @click="openFeatureMenu"
      />
      <div class="stock-search-bar__mobile-spacer" />
      <el-button
        :icon="Search"
        circle
        class="stock-search-bar__mobile-btn"
        title="搜尋"
        aria-label="開啟搜尋"
        @click="mobileSearchVisible = true"
      />

      <!-- fullscreen: this is a quick in-and-out action, not a browsing surface like
           AppFeatureMenu's own fullscreen dialog — a normal centered/top-anchored dialog is
           lighter for "type a stock code and go." Reuses LandingStockSearch.vue (built for
           the homepage hero) rather than re-inlining the ClientOnly/el-autocomplete
           SSR-hydration workaround block a second time in this file — see the desktop
           branch's own comment on that workaround for the underlying reason it's needed at
           all. Auto-closes on route change (see the script's watch()), since selecting a
           result navigates away but doesn't unmount this component. -->
      <ClientOnly>
        <!-- append-to-body: required, not optional — el-dialog defaults to appendToBody:
             false (renders inline in place, NOT teleported to <body>` despite what its name
             suggests), so without this it rendered nested inside .stock-search-bar, whose
             own backdrop-filter creates a containing block for position: fixed descendants
             (a lesser-known CSS interaction: filter/backdrop-filter/transform on an ancestor
             re-anchors "fixed" positioning to that ancestor's box instead of the viewport).
             That trapped the dialog's overlay inside the header bar's own ~65px-tall box
             instead of the full screen — it existed in the DOM with a real, measurable
             bounding box, but rendered squeezed into a sliver invisible to the eye. Confirmed
             live by walking the ancestor chain (el-overlay's parent was literally
             .stock-search-bar) before this fix. -->
        <el-dialog v-model="mobileSearchVisible" append-to-body title="搜尋" width="92%" top="10vh" class="stock-search-bar__mobile-dialog">
          <LandingStockSearch />
        </el-dialog>
      </ClientOnly>
    </template>

    <template v-else>
      <AppLogo />

      <!-- Its own flex-centering wrapper (not just justify-content on the bar itself) — the
           bar's other children (logo, and this wrapper) still need to pack left/fill normally;
           it's specifically the search input + GitHub link pair that should center as a group
           within whatever space is left after the logo, per feedback that they read better
           centered than hugging the logo's left edge. -->
      <div class="stock-search-bar__center">
        <!-- ClientOnly, not rendered directly: el-autocomplete's suggestion dropdown is an
           ElTooltip/ElPopperContent under the hood, and that popper content (ElFocusTrap's
           trap boundary, ElPopperArrow's <span>) renders a different node shape server-side
           vs. on the client's first paint even while closed (visible=false) — a real Vue
           "Hydration node mismatch" confirmed live via Playwright console capture, reproducing
           on every page (not something this app's own markup causes; it's Element Plus's own
           SSR output for ElTooltip-based components). Same family of issue as the Teleport/
           useId() ordering problem AppFeatureMenu.vue and UserLoginDialog.vue already route
           around with ClientOnly, but this one is the popper content's own internal structure,
           not an id-counter shift. The dropdown is only ever useful after JS has loaded
           anyway (fetch-suggestions is a client-side call), so there's no functionality lost
           by skipping it during SSR — only the fallback below needs to visually match so
           there's no layout flash. -->
      <ClientOnly>
        <el-autocomplete
          v-model="keyword"
          class="stock-search-bar__input"
          :fetch-suggestions="fetchSuggestions"
          popper-class="stock-search-bar__popper"
          placeholder="搜尋股票代號或名稱，例如 2330 或 台積電"
          aria-label="搜尋股票代號或名稱"
          clearable
          @select="handleSelect"
          @keyup.enter="handleEnter"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
          <template #default="{ item }">
            <p v-if="item.code === NO_MATCH_SENTINEL" class="stock-search-bar__no-match">{{ item.name }}</p>
            <div v-else class="stock-search-bar__option">
              <span class="stock-search-bar__option-name">{{ item.name }}</span>
              <span class="stock-search-bar__option-code">{{ item.code }}</span>
            </div>
          </template>
        </el-autocomplete>

        <!-- Same visual shape as the real input (icon, placeholder, aria-label) so SSR output
             still looks like a normal search box instead of a blank gap before hydration. -->
        <template #fallback>
          <el-input
            class="stock-search-bar__input"
            placeholder="搜尋股票代號或名稱，例如 2330 或 台積電"
            aria-label="搜尋股票代號或名稱"
            disabled
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </template>
      </ClientOnly>

      <AppGithubLink />
      <!-- Commented out until there's a real LINE 官方帳號/社群 link to point it at (see
           AppLineLink.vue's own TODO). -->
      <!-- <AppLineLink /> -->
    </div>

    <!-- Own trailing element, not inside .stock-search-bar__center — that wrapper centers
         its own children as a group, so anything appended there would join the centered
         search+link cluster instead of sitting at the bar's true right edge. -->
    <!-- active-value="full" (not "centered") — centered is the default now (2026-09-01), so
         the switch's own on/off semantics flip to match: off (the base state) is the
         default centered layout, on is opting INTO the non-default full-width one. Label
         describes what turning it ON does, same as before, just for the other direction. -->
      <label class="stock-search-bar__width-toggle" title="切換版面寬度：置中／滿版">
        <el-switch v-model="contentWidthMode" active-value="full" inactive-value="centered" size="small" />
        <span>滿版顯示</span>
      </label>
    </template>
  </div>
</template>

<style scoped>
.stock-search-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
  /* Semi-transparent, not fully — this bar stays position: fixed over scrolling content, so
     some of that content shows through, but backdrop-filter still keeps the search
     input/icons legible over whatever's underneath instead of a hard edge-to-edge see-through.
     65%/blur(8px) restored 2026-09-02 — the border-bottom-removal commit (30708bc) had
     accidentally dropped these to 0%/blur(2px) as an unrelated side effect, leaving the bar
     fully see-through (not just semi-transparent): reported live as "searchbar跑版了" on the
     stock detail page, where the summary card's own title row sits directly behind the header
     and a fully transparent bar let it (plus the autocomplete dropdown floating over it) read
     as one broken jumble instead of a legible layered UI. */
  background: color-mix(in srgb, var(--el-bg-color) 65%, transparent);
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgb(0 0 0 / 40%);
}

.stock-search-bar__center {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* flex-shrink: 0 keeps both circle buttons at their own 44px size — .stock-search-bar itself
   has no other flexible child in the mobile branch except the spacer below, so without this
   the buttons would be free to shrink under gap pressure at very narrow widths. */
.stock-search-bar__mobile-btn {
  flex-shrink: 0;
}

/* Pushes the search trigger to the bar's right edge while the menu trigger stays left —
   .stock-search-bar has no other flex: 1 child in the mobile branch to absorb this space
   otherwise (unlike desktop's .stock-search-bar__center, which does that job there). */
.stock-search-bar__mobile-spacer {
  flex: 1;
}

.stock-search-bar__input {
  flex: 1;
  min-width: 0;
}

/* Desktop-only (matches useDeviceLayout's own 1280px breakpoint, the exact width where
   desktop.vue's pinned-sidebar layout takes over from mobile.vue) — the centered-vs-full
   toggle this controls is a permanent no-op below that width anyway (see both layouts'
   .app-shell__inner--centered, capped at 1440px, wider than mobile.vue ever renders), and a
   mobile header already has no room to spare for a control that would do nothing there. */
.stock-search-bar__width-toggle {
  display: none;
}

@media (min-width: 1280px) {
  .stock-search-bar__width-toggle {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 16px;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    -webkit-user-select: none;
    user-select: none;
    white-space: nowrap;
  }
}

.stock-search-bar__option {
  display: flex;
  justify-content: space-between;
}

.stock-search-bar__option-code {
  color: var(--el-text-color-secondary);
}

/* The sentinel row (see useStockSearch.ts's NO_MATCH_SENTINEL) reads as an inert message, not
   a selectable option — centered and muted rather than left-aligned like a real option, since
   there's no code/name pair to align against. */
.stock-search-bar__no-match {
  margin: 0;
  text-align: center;
  color: var(--el-text-color-placeholder);
  cursor: default;
}
</style>

<style>
/* Unscoped, not :deep() — el-autocomplete forwards the class it's given onto its own
   internal <el-input> root (confirmed: both carry .stock-search-bar__input), but NEITHER
   picks up this component's scoped data-v-* attribute the way a plain HTML element written
   directly in this template would, since they're rendered by el-autocomplete's own
   template, not this one. A scoped :deep() rule here compiles to a selector requiring that
   attribute and silently never matches anything — verified via the actual rendered
   font-size staying at 14px despite the rule being present in the stylesheet. Unscoped
   avoids the attribute requirement entirely, same fix as OrganismIndicatorPicker.vue uses
   for its own teleported-content styling.

   Element Plus's --el-font-size-base default is 14px, an accepted exception for dense
   table/form cells (see docs/ui-ux/accessibility-guidelines.md §1.1) — but this is the app's one
   always-visible, primary search input, not a dense data cell, so it gets the project's
   16px floor instead. 14px here would also trigger iOS Safari's auto-zoom-on-focus, which
   is disruptive on exactly the kind of always-present input this is. */
.stock-search-bar__input .el-input__inner {
  font-size: 16px;
}

/* Matches useDeviceLayout.ts's own desktop breakpoint (the pinned-sidebar layout) — a
   full-bleed single-line input reads oversized once the bar has that much room to spare
   (reported: "電腦板貼頂的滿版search好像太浮誇了"). Capped instead of stretched to fill, same
   pattern as GitHub/Linear/Notion's header search. Capping this is also what makes
   .stock-search-bar__center's justify-content: center actually center the input+GitHub-icon
   pair rather than have the input eat all the space regardless (reported follow-up: wanted
   that pair centered as a group, not hugging the logo's left edge). Mobile/narrower desktop
   keep the full-width version, which is the standard, expected pattern at that size. Unscoped
   for the same reason as the font-size rule above — el-autocomplete's root doesn't carry this
   component's scoped attribute, so a scoped rule here would silently never match. */
@media (min-width: 1280px) {
  .stock-search-bar__input {
    flex: 0 1 560px;
  }
}

/* Small breathing-room gap between the suggestion dropdown and whatever page content sits
   directly below the header — reported live ("searchbar跑版了") on the stock detail page,
   where the summary card's own title row starts with zero gap right after the fixed header,
   so a flush-against-it dropdown left card content (ticker code, favorite button) visibly
   peeking beside its edges, reading as a layout bug even though z-index stacking was already
   correct. Unscoped for the same teleported-content reason as the rules above. */
.stock-search-bar__popper {
  margin-top: 8px;
}

/* Below 1280px (matches useDeviceLayout's own desktop breakpoint, same as the width-toggle
   rule above) the dropdown otherwise only spans the *input's* own width/position — narrower
   than, and offset from, the page content row beneath it (which uses mobile.vue's 16px page
   margin, not the header's logo+input+icon layout). That mismatch is what left page content
   (ticker code, favorite button) visibly peeking beside the dropdown's edges — confirmed via
   Playwright DOM inspection: the popper is positioned with `inset` (not a transform), so
   left/right/width are safely overridable here. Realigning it to the same 16px margin as the
   page content below makes the dropdown's own edges match what it's floating over, instead of
   leaving slivers on either side. Desktop (≥1280px) keeps the narrower input-width popper —
   the centered, capped-width layout there doesn't have this mismatch (see the 560px-cap rule
   above). */
@media (max-width: 1279px) {
  .stock-search-bar__popper {
    left: 16px !important;
    right: 16px !important;
    width: auto !important;
  }
}
</style>
