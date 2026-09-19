<script setup lang="ts">
// Shared nav-item set 2026-09-16, extracted out of AppHeaderMenu.vue per direct request
// ("desktop 這邊的 menu 改成我們的 AppHeaderMenu" → clarified as landing.vue's own minimal header
// → "搜尋 滿版切換不出現沒關係 但是我希望其他的功能 要出現 比如剛才說的月曆") — landing.vue's own
// top-of-file comment explicitly says it deliberately does NOT reuse app-shell chrome (no
// sidebar, no search bar, avoids burying marketing content), so AppHeaderMenu.vue itself (search
// autocomplete + width toggle bundled into one fixed-position header) can't just be dropped in
// wholesale. What CAN be shared without that conflict is just the nav items themselves
// (網站導覽/月曆/篩選) — this component is that shared slice, meant to be rendered as DIRECT
// children inside SOMEONE ELSE's <el-menu> (a multi-root fragment component, no wrapping element
// of its own), since Element Plus's horizontal-item styling is scoped by a direct-child
// combinator (`.el-menu--horizontal>.el-menu-item`, confirmed in el-menu.css) — nesting these one
// level deeper inside a wrapper would silently drop that styling, same reasoning AppHeaderMenu.vue
// itself already documented for why these aren't wrapped in an extra <div>.
//
// No `useRoute()`/`default-active` here — that prop lives on whichever PARENT <el-menu> element
// actually renders these items (AppHeaderMenu.vue's own, or landing.vue's own), since default-
// active is an el-menu-level prop, not a per-item one.
//
// Real <a> links inside every item since 2026-09-19 (the SEO build): el-menu's `router` mode
// navigates with vue-router's push() from a click/Enter on the <li role="menuitem">, so the
// server-rendered header used to contain NO anchor at all — a crawler reading any page found no
// path to /screener, let alone to the new hub pages, and every stock page was reachable only from
// the sitemap (measured: the home page's SSR HTML had 5 internal links, /screener's had 0). The
// NuxtLink renders the href crawlers follow; `tabindex="-1"` keeps it out of the tab order so the
// menubar's own roving focus (arrow keys, Enter → router push) stays the single keyboard path and
// the item doesn't become two tab stops. A mouse click hits the link and el-menu's handler for the
// same path — vue-router treats the second push as a redundant navigation, not a second load.
//
// Collapsed to 4 flat top-level items 2026-09-19 (interface-complexity review), then
// re-consolidated to 2 dropdowns 2026-09-20 per direct follow-up ("按照這個邏輯，找股票應該要與
// 篩選排行合併成下拉選單，因為我們還會有找ETF 找特別股等等") — 找股票/篩選/排行 were flat items
// for one day, but the same "group related destinations" reasoning that put 觀察清單/持股管理/
// 配息月曆 under 我的▾ applies here too, and more so once ETF/特別股 screener variants exist:
// those will be siblings inside THIS group (股票篩選-group), not more flat top-level items. Only
// 2 top-level nav entries now (股票篩選▾/我的▾); the items still parked entirely outside both
// (網站導覽/部落格/大師徽章/指標說明) keep their existing homes — SharedFooter.vue's nav on
// desktop, AppFeatureMenu.vue's fullscreen dialog on phone.
//
// 配息月曆 moved to the FRONT of 我的▾ 2026-09-20 per direct request ("我的 配息月曆要放前面一
// 點，他是很重要的功能核心") — was last of the three.
</script>

<template>
  <el-sub-menu index="stock-group">
    <template #title>股票篩選</template>
    <el-menu-item index="/stock">
      <NuxtLink to="/stock" class="app-nav-menu__link" tabindex="-1">找股票</NuxtLink>
    </el-menu-item>
    <el-menu-item index="/screener">
      <NuxtLink to="/screener" class="app-nav-menu__link" tabindex="-1">篩選</NuxtLink>
    </el-menu-item>
    <el-menu-item index="/rank">
      <NuxtLink to="/rank" class="app-nav-menu__link" tabindex="-1">排行</NuxtLink>
    </el-menu-item>
  </el-sub-menu>

  <el-sub-menu index="mine-group">
    <template #title>我的</template>
    <el-menu-item index="/calendar">
      <NuxtLink to="/calendar" class="app-nav-menu__link" tabindex="-1">配息月曆</NuxtLink>
    </el-menu-item>
    <el-menu-item index="/watchlist">
      <NuxtLink to="/watchlist" class="app-nav-menu__link" tabindex="-1">觀察清單</NuxtLink>
    </el-menu-item>
    <el-menu-item index="/holdings">
      <NuxtLink to="/holdings" class="app-nav-menu__link" tabindex="-1">持股管理</NuxtLink>
    </el-menu-item>
  </el-sub-menu>
</template>

<style scoped>
/* The link fills its <li> so the whole item stays the click target Element Plus styles (its
   padding is 0 20px in both the horizontal bar and the dropdown). Colour/underline come from the
   item — the menu's own active/hover colours must keep applying, so the anchor is visually inert. */
.app-nav-menu__link {
  display: flex;
  align-items: center;
  align-self: stretch;
  margin: 0 -20px;
  padding: 0 20px;
  color: inherit;
  text-decoration: none;
}

.app-nav-menu__link:focus {
  outline: none;
}
</style>
