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
</script>

<template>
  <el-menu-item index="/sitemap">
    <NuxtLink to="/sitemap" class="app-nav-menu__link" tabindex="-1">網站導覽</NuxtLink>
  </el-menu-item>
  <!-- 月曆 → 配息月曆 2026-09-17 per direct request ("月曆名稱加長叫做配息月曆") — matches
       calendar.vue's own page content (the 配息月曆 hero card is the only thing that page
       renders now, see that file's own comment), not a generic "calendar" a reader might assume
       covers earnings dates/ex-dividend for every stock at once. -->
  <el-menu-item index="/calendar">
    <NuxtLink to="/calendar" class="app-nav-menu__link" tabindex="-1">配息月曆</NuxtLink>
  </el-menu-item>

  <!-- 篩選 — 普通股篩選 (/screener) plus, since 2026-09-19, the market-wide hub page that belongs
       to the same "find stocks" job: 個股總表 (/stock, every listed company by exchange sector).
       ETF/特別股篩選 are shown disabled since those pages don't exist yet (見 app-features.ts 自己
       的註解，這兩個入口目前整個註解掉，不是被隱藏). -->
  <el-sub-menu index="screener-group">
    <template #title>篩選</template>
    <el-menu-item index="/stock">
      <NuxtLink to="/stock" class="app-nav-menu__link" tabindex="-1">個股總表</NuxtLink>
    </el-menu-item>
    <el-menu-item index="/screener">
      <NuxtLink to="/screener" class="app-nav-menu__link" tabindex="-1">個股篩選</NuxtLink>
    </el-menu-item>
    <el-menu-item index="etf-screener" disabled>ETF篩選</el-menu-item>
    <el-menu-item index="preferred-screener" disabled>特別股篩選</el-menu-item>
  </el-sub-menu>

  <!-- 觀察清單／持股管理 2026-09-17 per direct request ("篩選後面放上觀察清單與持股管理") — both
       are real, working pages already (/watchlist, /holdings; see app-features.ts's own comment
       on why these two stay adjacent — watchlist is stocks you're tracking, holdings is stocks
       you actually own), just not previously reachable from this top nav. -->
  <el-menu-item index="/watchlist">
    <NuxtLink to="/watchlist" class="app-nav-menu__link" tabindex="-1">觀察清單</NuxtLink>
  </el-menu-item>
  <el-menu-item index="/holdings">
    <NuxtLink to="/holdings" class="app-nav-menu__link" tabindex="-1">持股管理</NuxtLink>
  </el-menu-item>

  <!-- 更多 2026-09-16 per direct request ("篩選後面放一個更多，也是下拉選單，裡面塞部落格與大師
       徽章") — 部落格 moved here from landing.vue's own separate el-menu-item (see that file's own
       comment for the old placement); now shared through this one component like everything else
       here, no longer a landing-only extra. 大師徽章 reuses app-features.ts's own route
       (`/guru-indicators`) rather than a second hardcoded copy of that path. -->
  <el-sub-menu index="more-group">
    <template #title>更多</template>
    <el-menu-item index="/blog">
      <NuxtLink to="/blog" class="app-nav-menu__link" tabindex="-1">部落格</NuxtLink>
    </el-menu-item>
    <el-menu-item index="/guru-indicators">
      <NuxtLink to="/guru-indicators" class="app-nav-menu__link" tabindex="-1">大師徽章</NuxtLink>
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
