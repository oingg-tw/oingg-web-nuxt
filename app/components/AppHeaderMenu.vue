<script setup lang="ts">
import { Search, Setting } from '@element-plus/icons-vue'
import { NO_MATCH_SENTINEL } from '~/composables/stock/useStockSearch'

// Desktop header — mounted on every width by layouts/default.vue since 2026-09-19 (the layout's
// own CSS hides it below 1280px, where AppMobileHeader.vue shows instead) and by layouts/landing.vue
// on every width. Split out of a single shared component 2026-09-06 ("stock-search-bar 我認為可以
// 拆兩個檔案 因為手機板的行為 與 電腦版的行為落差滿大的") once the mobile header's own behavior
// (menu-trigger + collapsed search icon + dialog) had diverged enough from this one (always-visible
// logo + inline input + width toggle, GitHub link removed 2026-09-10) that branching on isWide
// inside one file was more confusing than two small, single-purpose ones.
//
// Renamed StockSearchBar.vue → AppHeaderMenu.vue 2026-09-16 per direct request; the
// 網站導覽／個股 el-menu that was briefly its own separate file lives directly in this one. The
// `app-header-menu` class prefix throughout is a mechanical rename from `stock-search-bar`.
//
// Root element: a <header> (2026-09-19). From 2026-09-16 the root had been the <el-menu> itself,
// per a direct request to mirror Element Plus's own horizontal-menu demo — but that put the logo
// <a> and the search/buttons <div> directly inside a <ul role="menubar">, which axe reports as a
// critical `aria-required-children` on every page (a menubar may only contain menu items), and
// the search row needed a post-mount tabindex hack to undo el-menu's keyboard-nav initializer
// sweeping it up as a Tab stop. Per direct decision（「現在就修這 4 條」app-shell axe issues）the bar
// is a <header> (the page's banner landmark) again: the <el-menu> inside it holds ONLY the nav
// items, the logo and the search row are its siblings, and the bar's own fixed-position/backdrop
// styling moved from the menu to the header. Nothing else about the layout changed — same
// fixed bar, same logo flush-left, same centred search.
const { keyword, fetchSuggestions, handleSelect, handleEnter } = useStockSearch()
// Visible 滿版顯示 toggle UI moved to /appearance 2026-09-17 per direct request ("滿版顯示功能
// 從menu移到外觀設定中") — this READ stays here regardless, still driving the
// `app-header-menu--centered` class below (the header's own centered-vs-full padding-left math).
const contentWidthMode = useContentWidthMode()
const route = useRoute()

const barRef = ref<HTMLElement>()
useHeaderHeightMeasure(barRef)

// Accesskey 快速鍵 (Alt+N) 2026-09-16 — el-autocomplete exposes a real focus() instance method
// (Element Plus's own documented API), duck-typed here the same way this app's other component-
// instance refs are (e.g. StockSummaryCard.vue's own cardRef) rather than importing Element
// Plus's internal instance type just for one method. `$el` is read by the aria fix below.
const searchInputRef = ref<{ focus: () => void; $el?: Node } | null>(null)
// el-autocomplete leaves aria-activedescendant pointing at "…-item--1" while nothing is
// highlighted — a critical axe finding on every page; see the composable's own comment.
useAutocompleteActiveDescendantFix(searchInputRef)
</script>

<template>
  <!-- Real bug fixed 2026-09-16 (reported live: "電腦板時的searchbar怎麼不在中間？") — this bar is
       `position:fixed; left:0; right:0`, spanning the FULL viewport width including the space
       AppPinnedSidebar visually occupies on the left. .app-header-menu__center's own
       justify-content:center therefore centers the input against the WHOLE window, not against
       the actual visible content area to the right of the 240px sidebar — the same "content is
       centered relative to the wrong box" bug .app-shell__content's own padding-left already
       solves for the page content below this bar. Mirrors that exact same padding-left logic here
       so both the search bar above and the page content below share one visual center line. -->
  <header ref="barRef" class="app-header-menu" :class="{ 'app-header-menu--centered': contentWidthMode === 'centered' }">
    <!-- Real bug fixed 2026-09-16 (reported live: "app-logo 電腦版沒有貼左？ 為什麼？") — the
         logo used to sit in normal flow as this bar's first child, so it got pushed along with
         everything else by the bar's own padding-left (see this template's own top comment) to
         x≈264px instead of the viewport's true left edge. Pulled OUT of the padded flow via
         absolute positioning instead, so it sits flush at x:16px independent of wherever the
         padding pushes the search input to stay centered against the content column. -->
    <AppLogo class="app-header-menu__logo" home-accesskey />

    <!-- 網站導覽／配息月曆／篩選／… — the shared AppNavMenu.vue item set, rendered as DIRECT
         children of this el-menu (Element Plus's horizontal-item styling is scoped by a
         direct-child combinator, `.el-menu--horizontal>.el-menu-item`). Zero custom styling on
         the items on purpose (per direct request "請把我們自己 StockSearchBar 客製化的樣式都先拿掉").
         `router` mode: `index` doubles as the route path, el-menu calls vue-router's push() itself;
         `default-active="route.path"` feeds the current path in since el-menu (unlike NuxtLink)
         doesn't auto-apply an active class from the current route. -->
    <el-menu
      mode="horizontal"
      router
      :default-active="route.path"
      :ellipsis="false"
      class="app-header-menu__menu"
    >
      <AppNavMenu />
    </el-menu>

    <div class="app-header-menu__row">
      <!-- Accesskey 快速鍵 2026-09-16 (app/pages/sitemap.vue documents the full scheme) —
           reuses main.css's own `.skip-link` visual technique (hidden via transform, slides into
           view on focus) since this is the same "invisible until you actually need it via
           keyboard" pattern, just triggering a JS focus() instead of a plain #anchor jump.
           Placed before the ClientOnly input since el-autocomplete's own exposed focus() method
           isn't available until it's actually mounted client-side. -->
      <button type="button" class="app-header-menu__accesskey skip-link" accesskey="n" @click="searchInputRef?.focus()">
        跳至搜尋
      </button>

      <!-- Its own flex-centering wrapper (not just justify-content on the bar itself) — the
           bar's other children still need to pack left/fill normally; it's specifically the
           search input that should center within whatever space is left after the menu. -->
      <div class="app-header-menu__center">
        <!-- ClientOnly, not rendered directly: el-autocomplete's suggestion dropdown is an
             ElTooltip/ElPopperContent under the hood, and that popper content renders a
             different node shape server-side vs. on the client's first paint even while closed
             — a real Vue "Hydration node mismatch" confirmed live via Playwright. The dropdown is
             only ever useful after JS has loaded anyway (fetch-suggestions is a client-side call),
             so nothing is lost by skipping it during SSR — only the fallback below needs to
             visually match so there's no layout flash. -->
        <ClientOnly>
          <el-autocomplete
            ref="searchInputRef"
            v-model="keyword"
            class="app-header-menu__input"
            :fetch-suggestions="fetchSuggestions"
            popper-class="app-header-menu__popper"
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
              <p v-if="item.code === NO_MATCH_SENTINEL" class="app-header-menu__no-match">{{ item.name }}</p>
              <div v-else class="app-header-menu__option">
                <span class="app-header-menu__option-name">
                  {{ item.name }}
                  <!-- ETF/特別股 tagged — the other 2 kinds route somewhere other than the usual
                       /stock/{code} page (see useStockSearch.ts's own routeFor), so this doubles
                       as a hint about what selecting it actually does, not just decoration. -->
                  <el-tag v-if="item.kind === 'etf'" size="small" effect="plain">ETF</el-tag>
                  <el-tag v-else-if="item.kind === 'preferred'" size="small" effect="plain">特別股</el-tag>
                </span>
                <span class="app-header-menu__option-code">{{ item.code }}</span>
              </div>
            </template>
          </el-autocomplete>

          <!-- Same visual shape as the real input (icon, placeholder, aria-label) so SSR output
               still looks like a normal search box instead of a blank gap before hydration. -->
          <template #fallback>
            <el-input
              class="app-header-menu__input"
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
      </div>

      <!-- 外觀設定 2026-09-17 per direct request — its own standalone icon button next to 登入
           (not folded into the account menu: "帳號選單暗示需要帳號"). `custom` + `v-slot` renders
           no <a> at all so the button is the only focusable node (a plain <NuxtLink> around an
           <el-button> was two Tab stops for one control). -->
      <NuxtLink to="/appearance" custom v-slot="{ navigate }">
        <el-button :icon="Setting" circle title="外觀設定" aria-label="外觀設定" @click="navigate" />
      </NuxtLink>

      <!-- 登入 — own trailing element (per direct request "登入放到右上角"); `link-to-profile`
           gives the single-button-per-state shape wanted here, `show-name` a text label rather
           than icon-only ("右上角至少登入前要有文字呈現"). -->
      <UserMenuButton link-to-profile show-name />
    </div>
  </header>
</template>

<style scoped>
.app-header-menu {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  /* Same height the bar had when <el-menu> was its root (Element Plus's own horizontal-menu
     height); the inner menu still renders at exactly this height. */
  min-height: var(--el-menu-horizontal-height, 60px);
  /* Sidebar-width offset — see this bar's own template comment for the bug this fixes. Same two
     values layouts/default.vue's own .app-shell__content uses for its padding-left (base
     sidebar+16px, wider sidebar+gap-centered in centered mode). */
  padding-left: calc(var(--app-sidebar-width) + 16px);
  padding-right: 16px;
  /* Semi-transparent, not fully — this bar stays position: fixed over scrolling content, so
     some of that content shows through, but backdrop-filter still keeps the search
     input/icons legible over whatever's underneath instead of a hard edge-to-edge see-through
     (65%/blur(8px) restored 2026-09-02 after a commit accidentally dropped them — "searchbar
     跑版了"). */
  background: color-mix(in srgb, var(--el-bg-color) 65%, transparent);
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgb(0 0 0 / 40%);
}

.app-header-menu--centered {
  padding-left: calc(var(--app-sidebar-width) + var(--app-sidebar-gap-centered));
}

/* The nav items' own menu, now a child of the bar rather than the bar itself: no background of
   its own (the bar's translucent one shows through) and no bottom border (that was the bar's
   edge when the menu was the root; the bar's box-shadow marks the edge now). */
.app-header-menu__menu {
  flex-shrink: 0;
  --el-menu-bg-color: transparent;
  border-bottom: none;
}

.app-header-menu__row {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Pulled out of the bar's own padded flex flow — see this element's own template comment for
   the bug this fixes. `.app-header-menu` is `position: fixed`, so this positions directly
   against IT, not the viewport; 16px matches the bar's own right-edge padding, and
   top:50%/translateY(-50%) centers it against the bar's actual rendered height. */
.app-header-menu__logo {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
}

.app-header-menu__center {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* Prevents this flex child from refusing to shrink below its content's intrinsic width (the
   flex default is min-width:auto, not 0) inside .app-header-menu__center's own flex row. */
.app-header-menu__input {
  min-width: 0;
}

.app-header-menu__option {
  display: flex;
  justify-content: space-between;
}

.app-header-menu__option-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.app-header-menu__option-code {
  color: var(--el-text-color-secondary);
}

/* The sentinel row (see useStockSearch.ts's NO_MATCH_SENTINEL) reads as an inert message, not
   a selectable option — centered and muted rather than left-aligned like a real option. */
.app-header-menu__no-match {
  margin: 0;
  text-align: center;
  color: var(--el-text-color-placeholder);
  cursor: default;
}
</style>

<style>
/* Unscoped, not :deep() — el-autocomplete forwards the class it's given onto its own internal
   <el-input> root, but neither picks up this component's scoped data-v-* attribute, so a scoped
   :deep() rule here compiles to a selector that never matches; the popper content is teleported
   besides. */

/* Small breathing-room gap between the suggestion dropdown and whatever page content sits
   directly below the header (reported live "searchbar跑版了" on the stock detail page, where the
   summary card's title row starts with zero gap right after the fixed header). */
.app-header-menu__popper {
  margin-top: 8px;
}

/* Element Plus's own .el-autocomplete-suggestion__wrap default ships `padding: 10px 0` — a
   vertical dead zone above/below the option list where the dropdown is still visually open but
   nothing is hoverable/clickable (reported live: "我剛誤以為我滑鼠壞掉"). */
.app-header-menu__popper .el-autocomplete-suggestion__wrap {
  padding: 0;
}
</style>
