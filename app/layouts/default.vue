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
// Mobile-first: the base rules are the phone layout (mobile header, floating 功能選單 button);
// `@media (min-width: 1280px)` — the same breakpoint useDeviceLayout.ts / AppLogo.vue already
// use — turns on the desktop header and gives the content its rail-width padding. The hidden
// header is `display: none`, so it is out of the accessibility tree and the tab order as well as
// out of sight; the two headers therefore never both expose a banner landmark.
// useHeaderHeightMeasure ignores a hidden header's 0px so --app-header-height always comes from
// the visible one.
//
// No rail element mounted here any more (was AppPinnedSidebar, deleted 2026-09-21 — see
// StockPageNav.vue's own top comment for the full story). This layout still reserves the rail's
// own WIDTH unconditionally, on every page, via --app-sidebar-width below — that reservation is
// independent of whether any element actually occupies it, so it stays exactly as it was even
// though nothing here renders into it any more. The one current consumer of that space,
// StockPageNav.vue, now renders its own position:fixed rail directly wherever it mounts (inside a
// stock page's own body, not this layout), so a stock page's content still lines up with every
// other page's the same padding-left already gives them.
//
// Landmark structure (axe `region` / `landmark-*` rules, 2026-09-19): skip links live in a
// labelled <nav>; each header is a <header>; the page is the single <main>; and SharedFooter
// (contentinfo) sits OUTSIDE <main> in its own wrapper that mirrors <main>'s horizontal padding so
// the two still line up edge to edge. A stock page's own rail is its own <aside> too — see
// StockPageNav.vue — just no longer one this layout mounts or knows about.
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

/* Flat 16px — was calc(88px + …) to clear AppFeatureMenu's floating Home button, removed
   2026-09-19 (interface-complexity review; see that component's own comment). */
.app-shell__footer {
  padding: 0 16px calc(16px + env(safe-area-inset-bottom));
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

/* Phone/tablet: desktop header out of the tree. `.app-shell .x` (0,3,0) is what lets this
   override the component's own `display` on its root (0,2,0) regardless of stylesheet order —
   kept at this specificity even though `.app-shell__rail` (the only other rule that used to need
   outranking here) is gone, since AppHeaderMenu.vue's own scoped root rule is the same kind of
   (0,2,0) default this technique exists to beat. */
.app-shell .app-shell__header-desktop {
  display: none;
}

@media (min-width: 1280px) {
  .app-shell .app-shell__header-desktop {
    display: flex;
  }

  .app-shell .app-shell__header-mobile {
    display: none;
  }

  /* The desktop header used to get the rail-width offset here too (2026-09-19), so that the
     header bar and the page content shared one visual left edge. Removed 2026-09-21 after that
     alignment was reported as a visible gap（「Menu上面網站導覽與Logo距離不同，是為什麼」）and
     measured: the logo is position: absolute at x:16–120（see AppHeaderMenu.vue's own comment on
     why）, so it never moved with this padding. On layouts/landing.vue the header's own base
     140px put the first menu item 20px past the logo; here the override pushed it to 264px and
     left a 144px hole between the two — the reserved rail column, with the logo stranded in it.

     So the header never actually had ONE left edge to share: it had the logo's at 16px and the
     menu's at 264px. Dropping the override gives it a real one（logo 16, menu 140 on every
     layout）, at the cost of the menu no longer lining up with the content below it. That is the
     trade the user chose when asked which of the two gaps mattered（「意的是 logo 跟選單之間的
     空白」）— the content area's own rail-width reservation below is deliberately untouched.

     Nothing replaces these rules: AppHeaderMenu.vue's own padding-left: 140px is the base for
     both layouts now, and it is already tuned to clear the absolute logo's 120px right edge. */

  /* Content sits to the right of the rail; 20px bottom margin instead of the floating
     button's clearance (that button is hidden here). */
  .app-shell__content {
    padding-left: calc(var(--app-sidebar-width) + 16px);
  }

  .app-shell__footer {
    padding: 0 16px 20px calc(var(--app-sidebar-width) + 16px);
  }

  /* Centered mode gets its own, wider rail-to-content gap (--app-sidebar-gap-centered, 24px)
     instead of the 16px above — StockPageNav.vue's own --centered variant reads the same var so
     the two stay in sync; see its own comment for the gap math. */
  .app-shell__content--centered,
  .app-shell__footer--centered {
    padding-left: calc(var(--app-sidebar-width) + var(--app-sidebar-gap-centered));
  }
}

/* 列印時收回側欄寬度的內容邊距 — the rail element itself no longer exists here to hide (it is
   StockPageNav.vue's own concern now, and its own @media print rule needs no specificity fight to
   win any more — see that file's own comment for why the OLD version, back when this WAS the
   deciding rule, needed one). This block still matters on its own: every page's content
   padding-left unconditionally reserves rail width at ≥1280px (see this file's own top comment),
   print or not, so it still has to be collapsed back to a flat 16px specifically for the printed
   page. */
@media print {
  .app-shell__content,
  .app-shell__content--centered,
  .app-shell__footer,
  .app-shell__footer--centered {
    padding-left: 16px;
  }
}
</style>
