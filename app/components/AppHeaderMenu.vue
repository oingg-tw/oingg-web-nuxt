<script setup lang="ts">
import { Search, Setting } from '@element-plus/icons-vue'
import { NO_MATCH_SENTINEL } from '~/composables/stock/useStockSearch'

// Desktop-only header, mounted only by layouts/desktop.vue — split out of a single shared
// component 2026-09-06 ("stock-search-bar 我認為可以拆兩個檔案 因為手機板的行為 與 電腦版的
// 行為落差滿大的") once the mobile header's own behavior (menu-trigger + collapsed search
// icon + dialog, see AppMobileHeader.vue) had diverged enough from this one (always-visible
// logo + inline input + width toggle, GitHub link removed 2026-09-10) that branching on isWide
// inside one file was more confusing than two small, single-purpose ones.
//
// Renamed StockSearchBar.vue → AppHeaderMenu.vue 2026-09-16 per direct request ("你把新的檔案
// 鑲嵌在 我打算替換掉的元件裡面？那很好 請把該元件整個刪掉。我們連舊版對照都不要留全部徹底重做" →
// clarified as "請把全新的元件從該元件裡面抓出來，這個新元件要用來替換stockSearchBar使用") — the
// 網站導覽／個股 el-menu that was briefly its own separate file lives directly in this one now
// (see the template's own comment at its call site below); this IS what StockSearchBar.vue used
// to be, moved wholesale under the new name/location rather than reimplemented blind, so none of
// the real bugs this file's own comments document (logo flush-left, hydration mismatches, popper
// margins, iOS zoom-on-focus, sidebar-width offset math for both content-width modes, etc.) get
// silently reintroduced by a from-scratch rewrite. `app-header-menu` class prefix throughout is a
// mechanical rename from `stock-search-bar`, not a restyle — every rule below is unchanged from
// the file this was moved from except for that prefix. Old file deleted outright, this is the only
// copy now (desktop.vue's own `<StockSearchBar />` updated to `<AppHeaderMenu />` in the same
// commit).
const { keyword, fetchSuggestions, handleSelect, handleEnter } = useStockSearch()
// Visible 滿版顯示 toggle UI moved to /appearance 2026-09-17 per direct request ("滿版顯示功能
// 從menu移到外觀設定中") — this READ stays here regardless, still driving the
// `app-header-menu--centered` class below (the header's own centered-vs-full padding-left math).
const contentWidthMode = useContentWidthMode()
const route = useRoute()

// barRef now refs the <el-menu> COMPONENT instance, not a plain DOM element (el-menu became this
// file's root element 2026-09-16, see the template's own comment) — a template ref on a component
// gives its public instance, not its root node, so useHeaderHeightMeasure (which calls
// ResizeObserver.observe(), needing a real Element) reads through `.$el` instead. `.$el` is a
// standard property on every Vue component's public instance regardless of what that component
// itself exposes, same duck-typing approach as searchInputRef just below.
const barRef = ref<{ $el: HTMLElement } | null>(null)
useHeaderHeightMeasure(computed(() => barRef.value?.$el))

// Accesskey 快速鍵 (Alt+N) 2026-09-16 — el-autocomplete exposes a real focus() instance method
// (Element Plus's own documented API), duck-typed here the same way this app's other component-
// instance refs are (e.g. StockSummaryCard.vue's own cardRef) rather than importing Element
// Plus's internal instance type just for one method.
const searchInputRef = ref<{ focus: () => void } | null>(null)
</script>

<template>
  <!-- Real bug fixed 2026-09-16 (reported live: "電腦板時的searchbar怎麼不在中間？") — this bar is
       `position:fixed; left:0; right:0`, spanning the FULL viewport width including the space
       AppPinnedSidebar visually occupies on the left. .app-header-menu__center's own
       justify-content:center therefore centers the input against the WHOLE window, not against
       the actual visible content area to the right of the 240px sidebar — the same "content is
       centered relative to the wrong box" bug .app-shell__content's own padding-left already
       solves for the page content below this bar (see desktop.vue's own comment on that rule).
       Mirrors that exact same padding-left logic here so both the search bar above and the page
       content below share one visual center line instead of two different ones. -->
  <!-- el-menu made the ROOT element 2026-09-16 per direct request ("請參考讓 el-menu是該檔案的
       最上層", pointing at Element Plus's own horizontal-menu demo, where el-menu itself is the
       template root and every other piece — including a logo — is a direct child of it, not
       wrapped in an outer plain <div>). `.el-menu--horizontal` is `display:flex` in Element
       Plus's own CSS (confirmed in el-menu.css), so it carries the same fixed-position/flex-row
       header-bar role `.app-header-menu`'s own <div> used to. AppLogo stays a direct child of
       THIS element (not wrapped in <el-menu-item>, unlike the demo's own logo-as-item) —
       `.el-menu-item{position:relative}` is Element Plus's own default (confirmed in el-menu.css),
       and AppLogo's own flush-left positioning fix (see its own comment below) depends on its
       nearest positioned ancestor being THIS element specifically; wrapping it in an
       el-menu-item would silently reintroduce the exact "nested inside an intermediate
       positioned wrapper breaks flush-left" bug this file already fixed once before (see git
       history — the "separate row above the bar" attempt). -->
  <el-menu
    ref="barRef"
    mode="horizontal"
    router
    :default-active="route.path"
    :ellipsis="false"
    class="app-header-menu"
    :class="{ 'app-header-menu--centered': contentWidthMode === 'centered' }"
  >
    <!-- Real bug fixed 2026-09-16 (reported live: "app-logo 電腦版沒有貼左？ 為什麼？") — the
         logo used to sit in normal flow as this bar's first child, so it got pushed along with
         everything else by the bar's own padding-left (see this template's own top comment) to
         x≈264px instead of the viewport's true left edge. Direction confirmed live ("我原本預期
         是 Logo 會在 app-header-menu 貼左") — the logo stays in this bar, not moved to the
         sidebar; it's pulled OUT of the padded flow instead via absolute positioning, so it can
         sit flush at x:16px independent of wherever the padding pushes the search input to stay
         centered against the content column. `.app-header-menu` is itself `position: fixed`,
         which already establishes the containing block this needs — no extra wrapper required. -->
    <AppLogo class="app-header-menu__logo" home-accesskey />

    <!-- 網站導覽／月曆／篩選 — this app's first use of el-menu anywhere. Extracted into
         AppNavMenu.vue 2026-09-16 (see that file's own comment) so landing.vue's own minimal
         header can share the exact same nav items without also pulling in this file's search
         box/width-toggle, which would conflict with that page's deliberately-minimal design.
         Rendered as direct children of THIS el-menu (not nested inside .app-header-menu__row) —
         Element Plus's own horizontal-item styling is scoped by a direct-child combinator
         (`.el-menu--horizontal>.el-menu-item`, confirmed in el-menu.css), so nesting one level
         deeper would silently drop it. Zero custom styling on purpose (Element Plus's own
         <el-menu-item> default appearance, no :deep()/CSS-var overrides): an earlier attempt to
         strip its default chrome down to a plain-text-link look was itself removed per direct
         request ("請把我們自己 StockSearchBar 客製化的樣式都先拿掉"). `router` mode on the outer
         el-menu: `index` doubles as the route path, el-menu calls vue-router's push() itself on
         click. `default-active="route.path"` feeds the current path in explicitly since el-menu
         (unlike NuxtLink) doesn't auto-apply an active class from the current route. -->
    <AppNavMenu />

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
         bar's other children (logo, and this wrapper) still need to pack left/fill normally;
         it's specifically the search input that should center within whatever space is left
         after the logo, per feedback that it reads better centered than hugging the logo's
         left edge. (Used to center a search+GitHub-link pair as a group before the GitHub
         link was removed 2026-09-10 — a single child centers the same way.) -->
    <div class="app-header-menu__center">
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
                     as a hint about what selecting it actually does, not just decoration. 個股
                     (the common case, most rows) gets no tag at all — tagging every row would
                     be pure noise for the majority case. -->
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

      <!-- AppGithubLink removed 2026-09-10 per direct request ("searchbar的github icon拿掉"). -->
      <!-- Commented out until there's a real LINE 官方帳號/社群 link to point it at (see
           AppLineLink.vue's own TODO). -->
      <!-- <AppLineLink /> -->
    </div>

    <!-- 外觀設定 2026-09-17 per direct request ("外觀設定要兩個入口 1. Header 右上角 —
         跟登入按鈕相鄰,但是獨立按鈕,不要收進帳號選單裡。理由同上:帳號選單暗示需要帳號。") — its
         own standalone el-button, a sibling of 登入 below rather than folded into
         UserMenuButton's own account popover/pairing logic (that pairing is guest-only anyway —
         a signed-in user would lose easy access to 外觀設定 entirely if it lived inside the
         account-popover branch instead of being unconditional here). -->
    <NuxtLink to="/appearance">
      <el-button :icon="Setting" circle title="外觀設定" />
    </NuxtLink>

    <!-- 登入 moved here 2026-09-17 per direct request ("登入放到右上角") — own trailing element,
         not inside .app-header-menu__center (that wrapper centers its own children as a group,
         same reasoning the old width-toggle comment used to give for the same slot before it
         moved to /appearance). `link-to-profile` gives the exact single-button-per-state shape
         wanted here: signed in → avatar linking straight to /profile (no popover to manage in a
         header context); guest → just the 登入 button alone, not paired with a second 外觀設定
         button (that pairing is UserMenuButton.vue's own sidebar-footer-specific behavior, see
         its own comment for why `!linkToProfile` guests get both — this header now has its own
         independent 外觀設定 entry point right above instead, per direct request). -->
    <UserMenuButton link-to-profile />
    </div>
  </el-menu>
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
  /* Real bug found live 2026-09-16 (asked directly: "padding: calc(12px + env(safe-area-inset-
     top)) 16px 12px; 這行幹嘛的 可以拿掉嗎") — this used to be load-bearing back when the root
     element was a plain <div> with no height of its own (the bar's whole height came from this
     padding + its content). Now that the root is <el-menu>, Element Plus's own horizontal-mode
     CSS gives it a hardcoded `height: 60px` (--el-menu-horizontal-height) directly — this
     padding's top/bottom 12px no longer contributes height, it was just eating into that fixed
     60px box (box-sizing: border-box), squeezing `.el-menu-item`'s own `height: 100%` down to a
     measured 35px instead of Element Plus's intended full 60px. Removed; only the right-edge
     16px inset survives (nothing else provides it — padding-left is a separate, still-present
     rule further down that already wins over this one). */
  padding-right: 16px;
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

/* Sidebar-width offset — see this bar's own template comment for the bug this fixes. Same two
   values desktop.vue's own .app-shell__content uses for its padding-left (base sidebar+16px,
   wider sidebar+gap-centered in centered mode) so the search bar's own centered content area
   lines up with the page content's centered area one-for-one. */
.app-header-menu {
  padding-left: calc(var(--app-sidebar-width) + 16px);
}

.app-header-menu--centered {
  padding-left: calc(var(--app-sidebar-width) + var(--app-sidebar-gap-centered));
}

/* Just a plain flex child of the bar now (see this element's own template comment for the
   restructure history) — no position:relative needed here, .app-header-menu__logo/__accesskey
   are both direct children of the outer `.app-header-menu` (itself `position: fixed`), not
   nested inside this row. */
.app-header-menu__row {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Pulled out of the bar's own padded flex flow — see this element's own template comment for
   the bug this fixes. `.app-header-menu` is `position: fixed`, so this positions directly
   against IT, not the viewport — matches the bar's own left edge at every content-width mode
   (pinned/full-width and centered alike both keep the bar itself spanning `left:0; right:0`,
   only its PADDING differs between the two, which this deliberately ignores). 16px matches the
   bar's own right-edge padding for a visually symmetric inset, and top:50%/translateY(-50%)
   centers it against the bar's actual rendered height regardless of safe-area-inset-top's own
   variable contribution to that height. */
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

/* flex-basis itself lives in the unscoped block below (`flex: 0 1 560px`) — this used to also
   set `flex: 1` here, which the SSR-only #fallback <el-input> picked up (its root DOES get this
   scoped attribute, being a single simple component) while the real, hydrated <el-autocomplete>
   never did (see the unscoped block's own comment — confirmed live it lacks the attribute
   entirely) — so the bar rendered full-width on first paint and visibly narrowed to 560px the
   moment hydration swapped the real input in. Reported live ("searchbar在電腦重新整理會先是長
   條，然後才縮短"). Left with just min-width: 0 so both the fallback and the real input still
   shrink correctly inside .app-header-menu__center's flex row. */
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
   a selectable option — centered and muted rather than left-aligned like a real option, since
   there's no code/name pair to align against. */
.app-header-menu__no-match {
  margin: 0;
  text-align: center;
  color: var(--el-text-color-placeholder);
  cursor: default;
}
</style>

<style>
/* Unscoped, not :deep() — el-autocomplete forwards the class it's given onto its own
   internal <el-input> root (confirmed: both carry .app-header-menu__input), but NEITHER
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
.app-header-menu__input .el-input__inner {
  font-size: 1rem;
}

/* Matches useDeviceLayout.ts's own desktop breakpoint (the pinned-sidebar layout) — a
   full-bleed single-line input reads oversized once the bar has that much room to spare
   (reported: "電腦板貼頂的滿版search好像太浮誇了"). Capped instead of stretched to fill, same
   pattern as GitHub/Linear/Notion's header search. Capping this is also what makes
   .app-header-menu__center's justify-content: center actually center the input rather than
   have it eat all the space regardless (reported follow-up: wanted it centered, not hugging
   the logo's left edge). Unscoped for the same
   reason as the font-size rule above — el-autocomplete's root doesn't carry this component's
   scoped attribute, so a scoped rule here would silently never match. */
.app-header-menu__input {
  flex: 0 1 560px;
}

/* Small breathing-room gap between the suggestion dropdown and whatever page content sits
   directly below the header — reported live ("searchbar跑版了") on the stock detail page,
   where the summary card's own title row starts with zero gap right after the fixed header,
   so a flush-against-it dropdown left card content (ticker code, favorite button) visibly
   peeking beside its edges, reading as a layout bug even though z-index stacking was already
   correct. Unscoped for the same teleported-content reason as the rules above. */
.app-header-menu__popper {
  margin-top: 8px;
}

/* Element Plus's own .el-autocomplete-suggestion__wrap default ships `padding: 10px 0` — a
   vertical dead zone above/below the option list where the dropdown is still visually open but
   nothing is hoverable/clickable, which reads as "my mouse stopped working" when the pointer
   sits in that gap (reported live: "我剛誤以為我滑鼠壞掉"). Zeroed out; each li row already
   carries its own padding so removing the wrap's padding doesn't make rows touch the popper's
   rounded corners edge-to-edge in a way that looks wrong. */
.app-header-menu__popper .el-autocomplete-suggestion__wrap {
  padding: 0;
}
</style>
