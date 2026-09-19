<script setup lang="ts">
// The ONE app-shell layout (2026-09-19), replacing layouts/desktop.vue + layouts/mobile.vue —
// per direct decision（「合成單一 layout, mobile first, 用 css 切換根治」）. Those two layouts were
// picked in app.vue from a cookie-seeded `isWide`, and a visitor with no cookie (every crawler,
// every first visit, Googlebot desktop included) was server-rendered with the MOBILE shell and
// then, once hydration finished and matchMedia had a say, swapped to the desktop shell: the whole
// `div.app-shell` was replaced, the page component re-mounted, focus fell to <body> and the
// content moved (~130px on 公司健檢, a real CLS hit) — measured live on 2026-09-19 while
// verifying the stock-page redesign. Now both shells' chrome is in ONE DOM tree on every width
// and CSS media queries decide what shows: no viewport-dependent markup, so SSR can never
// disagree with the client and nothing ever re-mounts on hydration.
//
// Mobile-first: the base rules are the phone layout (mobile header, floating 功能選單 button,
// no rail); `@media (min-width: 1280px)` — the same breakpoint useDeviceLayout.ts / AppLogo.vue
// already use — turns on the desktop header and the left rail and gives the content its
// rail-width padding. The hidden header/rail are `display: none`, so they are out of the
// accessibility tree and the tab order as well as out of sight; the two headers therefore never
// both expose a banner landmark. useHeaderHeightMeasure ignores a hidden header's 0px so
// --app-header-height always comes from the visible one.
//
// Landmark structure (axe `region` / `landmark-*` rules, 2026-09-19): skip links live in a
// labelled <nav>; each header is a <header>; the rail is an <aside>; the page is the single
// <main>; and SharedFooter (contentinfo) sits OUTSIDE <main> in its own wrapper that mirrors
// <main>'s horizontal padding so the two still line up edge to edge.
const contentWidthMode = useContentWidthMode()
const centered = computed(() => contentWidthMode.value === 'centered')
</script>

<template>
  <div class="app-shell">
    <!-- Accesskey 快速鍵 (documented on /sitemap): 跳至主要內容 (Alt+C), 外觀設定, 跳至頁尾 (Alt+H).
         All three use main.css's own .skip-link technique (hidden until focused). Wrapped in a
         labelled <nav> so they belong to a landmark. -->
    <nav class="app-shell__skip-links" aria-label="快速跳轉">
      <a href="#main-content" class="skip-link" accesskey="c">跳至主要內容</a>
      <NuxtLink to="/appearance" class="skip-link">外觀設定</NuxtLink>
      <a href="#app-footer" class="skip-link" accesskey="h">跳至頁尾</a>
    </nav>

    <!-- Both headers always render; the layout's own CSS below shows exactly one per width. -->
    <AppMobileHeader class="app-shell__header-mobile" />
    <AppHeaderMenu class="app-shell__header-desktop" />

    <!-- Desktop-only left rail（≥1280px）— the teleport target a page can push its own
         navigation into (StockPageNav.vue does, for the 個股頁面 links). Rendered on every width so
         that target always exists; hidden below the breakpoint. -->
    <AppPinnedSidebar class="app-shell__rail" />

    <!-- Floating 功能選單 button + fullscreen dialog (phone/tablet); the trigger hides itself
         at ≥1280px in its own CSS. -->
    <AppFeatureMenu />
    <AppSystemHealthBanner />

    <main id="main-content" class="app-shell__content" :class="{ 'app-shell__content--centered': centered }" tabindex="-1">
      <div class="app-shell__inner" :class="{ 'app-shell__inner--centered': centered }">
        <UserEmailVerificationGate>
          <slot />
        </UserEmailVerificationGate>
      </div>
    </main>

    <div class="app-shell__footer" :class="{ 'app-shell__footer--centered': centered }">
      <div class="app-shell__inner" :class="{ 'app-shell__inner--centered': centered }">
        <SharedFooter match-container-width />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Top padding adds a flat 16px on top of the header/banner height so every page's own first
   heading/card gets breathing room instead of sitting flush against the fixed header's bottom
   edge (unified here per direct request「請統一每個頁面的上緣間距」). No bottom padding — the
   footer wrapper below carries the page's tail. */
.app-shell__content {
  padding: calc(var(--app-header-height) + var(--app-banner-height) + 16px) 16px 0;
}

/* Bottom reservation clears AppFeatureMenu's floating Home button (phone/tablet). */
.app-shell__footer {
  padding: 0 16px calc(88px + env(safe-area-inset-bottom));
}

/* Only meaningful once the viewport is wider than this cap to begin with — on anything
   narrower, max-width simply never binds and the toggle is a no-op, which is deliberate
   (per the feature request: "是用戶視窗大小決定"). --app-content-max-width (1440px) is a
   common "large desktop" reference width, comfortably wider than Bootstrap's own largest
   container (1320px) to leave this data-dense app's wide result tables more room. */
.app-shell__inner--centered {
  max-width: var(--app-content-max-width);
  margin: 0 auto;
}

/* Phone/tablet: desktop header and rail out of the tree. `.app-shell .x` (0,3,0) is what lets
   these override each component's own `display` on its root (0,2,0) regardless of stylesheet
   order. */
.app-shell .app-shell__header-desktop,
.app-shell .app-shell__rail {
  display: none;
}

@media (min-width: 1280px) {
  .app-shell .app-shell__header-desktop,
  .app-shell .app-shell__rail {
    display: flex;
  }

  .app-shell .app-shell__header-mobile {
    display: none;
  }

  /* Content sits to the right of the rail; 20px bottom margin instead of the floating
     button's clearance (that button is hidden here). */
  .app-shell__content {
    padding-left: calc(var(--app-sidebar-width) + 16px);
  }

  .app-shell__footer {
    padding: 0 16px 20px calc(var(--app-sidebar-width) + 16px);
  }

  /* Centered mode gets its own, wider rail-to-content gap (--app-sidebar-gap-centered, 24px)
     instead of the 16px above — AppPinnedSidebar.vue's --centered variant reads the same var so
     the two stay in sync; see its own comment for the gap math. */
  .app-shell__content--centered,
  .app-shell__footer--centered {
    padding-left: calc(var(--app-sidebar-width) + var(--app-sidebar-gap-centered));
  }
}

/* 列印時移除側邊欄 — per直接要求（"用戶要print的時候 sidebar 可以移除嗎"）。側邊欄本身的
   display:none 交給 AppPinnedSidebar.vue 自己的 @media print 規則；這裡只負責把內容區原本為了讓出
   側邊欄寬度而留的 padding-left 一併收回。 */
@media print {
  .app-shell__content,
  .app-shell__content--centered,
  .app-shell__footer,
  .app-shell__footer--centered {
    padding-left: 16px;
  }
}
</style>
