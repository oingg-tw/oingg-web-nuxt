<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import { NO_MATCH_SENTINEL } from '~/composables/stock/useStockSearch'

// Desktop-only header, mounted only by layouts/desktop.vue — split out of a single shared
// component 2026-09-06 ("stock-search-bar 我認為可以拆兩個檔案 因為手機板的行為 與 電腦版的
// 行為落差滿大的") once the mobile header's own behavior (menu-trigger + collapsed search
// icon + dialog, see AppMobileHeader.vue) had diverged enough from this one (always-visible
// logo + inline input + GitHub link + width toggle) that branching on isWide inside one file
// was more confusing than two small, single-purpose ones.
const { keyword, fetchSuggestions, handleSelect, handleEnter } = useStockSearch()
const contentWidthMode = useContentWidthMode()

const barRef = ref<HTMLElement>()
useHeaderHeightMeasure(barRef)
</script>

<template>
  <div ref="barRef" class="stock-search-bar">
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

/* flex-basis itself lives in the unscoped block below (`flex: 0 1 560px`) — this used to also
   set `flex: 1` here, which the SSR-only #fallback <el-input> picked up (its root DOES get this
   scoped attribute, being a single simple component) while the real, hydrated <el-autocomplete>
   never did (see the unscoped block's own comment — confirmed live it lacks the attribute
   entirely) — so the bar rendered full-width on first paint and visibly narrowed to 560px the
   moment hydration swapped the real input in. Reported live ("searchbar在電腦重新整理會先是長
   條，然後才縮短"). Left with just min-width: 0 so both the fallback and the real input still
   shrink correctly inside .stock-search-bar__center's flex row. */
.stock-search-bar__input {
  min-width: 0;
}

/* Desktop-only component now, but this still only makes sense once the bar itself has real
   room to spare — the centered-vs-full toggle this controls is a permanent no-op below
   1280px anyway (see both layouts' .app-shell__inner--centered, capped at 1440px, wider than
   mobile.vue ever renders). Kept as a breakpoint rather than always-visible for that reason,
   even though this component no longer renders below that width at all in practice. */
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
   that pair centered as a group, not hugging the logo's left edge). Unscoped for the same
   reason as the font-size rule above — el-autocomplete's root doesn't carry this component's
   scoped attribute, so a scoped rule here would silently never match. */
.stock-search-bar__input {
  flex: 0 1 560px;
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

/* Element Plus's own .el-autocomplete-suggestion__wrap default ships `padding: 10px 0` — a
   vertical dead zone above/below the option list where the dropdown is still visually open but
   nothing is hoverable/clickable, which reads as "my mouse stopped working" when the pointer
   sits in that gap (reported live: "我剛誤以為我滑鼠壞掉"). Zeroed out; each li row already
   carries its own padding so removing the wrap's padding doesn't make rows touch the popper's
   rounded corners edge-to-edge in a way that looks wrong. */
.stock-search-bar__popper .el-autocomplete-suggestion__wrap {
  padding: 0;
}
</style>
