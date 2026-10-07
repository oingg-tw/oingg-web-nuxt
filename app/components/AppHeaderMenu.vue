<script setup lang="ts">
import { Search, Setting } from '@element-plus/icons-vue'
import { NO_MATCH_SENTINEL } from '~/composables/stock/useStockSearch'

// 桌機頁首——layouts/default.vue 在每個寬度都掛它（CSS 在 1280px 以下藏起來、改顯示 AppMobileHeader），landing.vue 也掛。
// 2026-09-06 從單一共用元件拆成桌機／手機兩支（手機版行為差太多，在一個檔案裡用 isWide 分支更難讀）；
// 2026-09-16 由 StockSearchBar 改名成現在的名字，`app-header-menu` class 前綴是機械式改名。
// 根元素是 <header>（2026-09-19）：曾照 Element Plus 的水平選單範例把 <el-menu> 當根，但 logo <a> 與搜尋列 <div> 因此落在
// <ul role="menubar"> 裡，axe 在每一頁都報 critical 的 aria-required-children，搜尋列還得靠掛載後的 tabindex hack 躲 el-menu
// 的鍵盤初始化。現在 <el-menu> 只放導覽項，logo 與搜尋列是它的兄弟，固定定位／毛玻璃樣式在 header 上。
const { keyword, fetchSuggestions, handleSelect, handleEnter, isCompanyEntry } = useStockSearch()
// Visible 滿版顯示 toggle UI moved to /appearance 2026-09-17 per direct request ("滿版顯示功能
// 從menu移到外觀設定中") — this READ stays here regardless, still driving the
// `app-header-menu--centered` class below (the header's own centered-vs-full padding-left math).
const contentWidthMode = useContentWidthMode()
const route = useRoute()

const barRef = ref<HTMLElement>()
useHeaderHeightMeasure(barRef)

// Auto-close the 股票篩選▾/我的▾ dropdowns on scroll (2026-09-20, real bug reported live: "下拉
//選單點外面或是滾動卷軸要讓他自動收起") — click-outside is el-menu's own `close-on-click-outside`
// prop below (Element Plus's own ClickOutside directive, checked in its source), but it has no
// equivalent for scroll; a dropdown left open while the page scrolls behind it drifts away from
// its own trigger, which reads as broken rather than intentionally "still open". `close(index)` is
// the exposed instance method (menu.mjs's own `expose({ open, close, … })`) — silent no-op on an
// index that's already closed, so calling both unconditionally on every scroll event is safe.
// passive: true since this never calls preventDefault().
const menuRef = ref<{ close: (index: string) => void } | null>(null)
function closeDropdowns() {
  menuRef.value?.close('stock-group')
  menuRef.value?.close('mine-group')
}
onMounted(() => window.addEventListener('scroll', closeDropdowns, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', closeDropdowns))

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
       `position:fixed; left:0; right:0`, spanning the FULL viewport width. Rail-width offset (when
       a rail is present) is applied by layouts/default.vue via the `app-shell__header-desktop`
       class this component is mounted with, not by this component's own CSS — see this file's
       own style block for why (2026-09-19: layouts/landing.vue mounts the exact same component
       with no rail at all, so hardcoding rail math in here was wrong for that layout). -->
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
    <!-- menu-trigger="click" (2026-09-20, real bug reported live: "下拉選單如果打開狀態再點一次
         可以收回去嗎") — Element Plus's own horizontal-mode default is "hover", under which a
         click on a dropdown title (股票篩選▾/我的▾, since 2026-09-20's 2-group consolidation)
         never toggles it closed; checked in its own source (menu.mjs's handleSubMenuClick DOES
         toggle open/close, but sub-menu.mjs's handleClick only ever calls it when
         menuTrigger==='click', so under the hover default a click did nothing observable at all).
         Click-triggered also fits this app's own standing rule against hover-only interactions
         better than the default anyway (see AppFeatureMenu.vue's own reasoning for why a corner
         hover-reveal was removed) — a dropdown that opens on an accidental mouse pass and won't
         close again on a deliberate click is exactly that kind of surprise. -->
    <!-- unique-opened：一次只開一個下拉（2026-09-26「el-sub-menu 一個展開 另一個就要收起來」）。
         三個下拉同時展開會互相疊住，而且點開第二個時第一個還浮在畫面上，讀者分不出哪一個是當下的。 -->
    <el-menu
      ref="menuRef"
      mode="horizontal"
      menu-trigger="click"
      close-on-click-outside
      unique-opened
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
                  <el-tag v-if="isCompanyEntry(item) && item.kind === 'etf'" size="small" effect="plain">ETF</el-tag>
                  <el-tag v-else-if="isCompanyEntry(item) && item.kind === 'preferred'" size="small" effect="plain">特別股</el-tag>
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
           <el-button> was two Tab stops for one control). Icon + visible text since 2026-09-19
           (interface-complexity review) — was a bare icon circle. -->
      <NuxtLink to="/appearance" custom v-slot="{ navigate }">
        <el-button class="app-header-menu__settings" @click="navigate">
          <el-icon aria-hidden="true"><Setting /></el-icon>外觀設定
        </el-button>
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
  /* 140px, NOT the rail's width. Fixed 2026-09-19 (this exact value the same day, twice — see
     git history): this component is mounted by both layouts/default.vue (which HAS a rail) and
     layouts/landing.vue (which doesn't), and this value used to hardcode the rail offset for
     both, so on the landing page every item sat 240px+ further right than the logo for no
     reason. The rail-width offset now lives in layouts/default.vue's own CSS, applied to this
     component's root via the class `app-shell__header-desktop` it's mounted with there — see
     that file's own comment.
     A flat 16px (this rule's very first fix) turned out to be too little on its own: the logo
     is `position: absolute` (pulled out of this padded flow — see .app-header-menu__logo's own
     comment) and still occupies real visual space, x:16px to x:120px (measured live). 16px of
     padding starts the nav's first item at the SAME x:16px the logo already begins at, so on
     layouts/landing.vue (no rail, nothing else pushes this further right) the two rendered on
     top of each other — reported live ("首頁的Header在電腦版跑版"). 140px clears the logo's own
     120px right edge with a 20px gap; layouts/default.vue's rail-width override (256px) already
     clears it with room to spare, so this base value only ever matters on the no-rail layout. */
  padding-left: 140px;
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

/* The nav items' own menu, now a child of the bar rather than the bar itself: no background of
   its own (the bar's translucent one shows through) and no bottom border (that was the bar's
   edge when the menu was the root; the bar's box-shadow marks the edge now). */
.app-header-menu__menu {
  flex-shrink: 0;
  --el-menu-bg-color: transparent;
  border-bottom: none;
}

/* 20px between the search block and the buttons to its right, not 8（2026-09-23,「這塊有點醜
   請調整間距啥的」）. Measured at 1440 before the change: the input was 693px wide and its right
   border sat 8px from 外觀設定's left border — two框線 close enough to read as one control with a
   seam in it. The width is capped separately below; this gap is what keeps the two groups apart
   once it is. */
.app-header-menu__row {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 20px;
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

/* min-height set explicitly (2026-09-19, replacing `circle` at the default size) — a ≥44px touch
   target per the reference doc, now that this is an icon+text button rather than a fixed-size
   circle. flex-shrink:0 keeps it from being squeezed by the search input's own flex:1 row. */
.app-header-menu__settings {
  flex-shrink: 0;
  min-height: 44px;
}

/* Element Plus gives adjacent el-buttons their own `margin-left: 12px`, which stacks on top of
   this row's 20px gap（2026-09-24, reported:「外觀設定與登入中間的那個間隔我看了不舒服」）.
   Measured at 1440: 搜尋框→外觀設定 was 20px while 外觀設定→登入 was 32px, so the two buttons sat
   further from each other than from the box beside them and 登入 read as detached, drifting toward
   the edge. One gap value for the whole row instead.
   :deep() because the second button is UserMenuButton's own root and that component renders a
   FRAGMENT, so it inherits no scope attribute from this file — a plain scoped selector compiles to
   `.el-button + .el-button[data-v-…]` and matches nothing. Verified by measuring: the rule looked
   correct and the computed margin stayed 12px. */
.app-header-menu__row :deep(.el-button + .el-button) {
  margin-left: 0;
}

/* Gap between a button's icon and its label（2026-09-24,「外觀設定與icon中間請加上間距」）.
   Element Plus ships `.el-button [class*=el-icon] + span { margin-left: 6px }`, which needs the
   label to be an element — and 外觀設定's is a bare text node inside the same span as the icon, so
   that rule never applied and the two sat flush against each other. A flex gap on the wrapper does
   not care whether the label is an element or text, and it covers 登入 too（whose own label IS a
   span, hence the margin reset below — otherwise the two would stack to 10px）. */
/* Both structures: 外觀設定 wraps icon+text in one span, while 登入's icon is a direct child of the
   button itself（measured — the same 6px has to be declared in two places because of it）. */
.app-header-menu__row :deep(.el-button) {
  gap: 6px;
}

.app-header-menu__row :deep(.el-button > span) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.app-header-menu__row :deep(.el-button .el-icon + span) {
  margin-left: 0;
}

/* Avatar only, at every desktop width（2026-09-24,「登入後的名稱在電腦版不用顯示」）.
   The standing instruction「右上角至少登入前要有文字呈現」is about the SIGNED-OUT state — the word
   登入 must not become a bare icon. A signed-in user's own name is not that: the avatar identifies
   the account and /profile carries the name, one click away. The mobile slide layer still shows it,
   where the same component is a full-width row with space to spare（AppFeatureMenu）.
   It also returns ~170px to the search input at the narrow end of the desktop shell, where a
   landscape tablet lands. */
.app-header-menu__row :deep(.user-menu-button__name) {
  display: none;
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

/* Real bug reported live 2026-09-20 ("搜尋股票代號或名稱 高度怪怪") — height on
   .app-header-menu__input itself (the el-autocomplete/el-input ROOT) only sizes that root
   element; the actual visible box is the nested .el-input__wrapper, which Element Plus sizes to
   its own small-size default (~27px, this app's global el-config-provider size is 'small' at
   100% text scale — see useTextScale.ts) regardless of the root's own height. Same fix,
   same 48px value LandingStockSearch.vue's own identical rule already uses for the other two
   search boxes in this app (the landing hero and the mobile search dialog both reuse that exact
   component) — this header's own search input was the one place still at the un-fixed small
   size, sitting visibly short next to the 44px 外觀設定/登入 buttons right beside it. */
.app-header-menu__input .el-input__wrapper {
  height: 48px;
}

/* Width, and it has to live in this unscoped block like the height above（2026-09-23,「這塊有點醜
   請調整間距啥的」）. There WAS a `.app-header-menu__input { min-width: 0 }` in the scoped block,
   and it had never matched anything: probed live, the el-autocomplete root carries the class but
   NO data-v-* attribute at all — it is inside <ClientOnly>, so the scope id never reaches it —
   which makes every scoped selector for this element a no-op. Deleted rather than left as a rule
   that looks like it does something.
   max-width: a search box has no reason to grow without limit. Uncapped it took every pixel the
   menu and the buttons did not — 693px at 1440, wider on a larger monitor — so the bar read as one
   enormous field with things stuck to its ends, and its right border sat 8px from 外觀設定's left
   border. 520px fits the placeholder「搜尋股票代號或名稱，例如 2330 或 台積電」with room to spare
   （~380px at 16px）; the leftover width becomes symmetric margin, since .app-header-menu__center
   already centres it.
   RAISED 520 → 640 on 2026-09-26（「搜尋股票代號或名稱 input 現在太短了我不習慣」）。沒有回到無上限：
   上面那段記的是實測結果——無上限時 1440 寬會長到 693px，右邊界離「外觀設定」只剩 8px，整條 bar 讀起來
   像一個巨大的欄位兩端黏著東西。640 是在「不習慣的短」與「那個 8px」之間，實測 1440 寬下離按鈕還有
   餘裕。使用者選的是「只把搜尋框加寬，不動其他」，所以 header 其他元素的對齊沒有跟著改。
   min-width restated here for the reason the dead rule gave: the flex default is min-width:auto,
   not 0, so without it this child refuses to shrink below its content's intrinsic width. */
.app-header-menu__input {
  min-width: 0;
  max-width: 640px;
}
</style>
