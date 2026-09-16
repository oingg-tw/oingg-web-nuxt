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
</script>

<template>
  <el-menu-item index="/sitemap">網站導覽</el-menu-item>
  <!-- 月曆 → 配息月曆 2026-09-17 per direct request ("月曆名稱加長叫做配息月曆") — matches
       calendar.vue's own page content (the 配息月曆 hero card is the only thing that page
       renders now, see that file's own comment), not a generic "calendar" a reader might assume
       covers earnings dates/ex-dividend for every stock at once. -->
  <el-menu-item index="/calendar">配息月曆</el-menu-item>

  <!-- 篩選 — only 普通股篩選 (/screener) is a real, working page today; ETF/特別股篩選 are shown
       disabled since those pages don't exist yet (見 app-features.ts 自己的註解，這兩個入口目前
       整個註解掉，不是被隱藏). -->
  <el-sub-menu index="screener-group">
    <template #title>篩選</template>
    <el-menu-item index="/screener">個股篩選</el-menu-item>
    <el-menu-item index="etf-screener" disabled>ETF篩選</el-menu-item>
    <el-menu-item index="preferred-screener" disabled>特別股篩選</el-menu-item>
  </el-sub-menu>

  <!-- 更多 2026-09-16 per direct request ("篩選後面放一個更多，也是下拉選單，裡面塞部落格與大師
       徽章") — 部落格 moved here from landing.vue's own separate el-menu-item (see that file's own
       comment for the old placement); now shared through this one component like everything else
       here, no longer a landing-only extra. 大師徽章 reuses app-features.ts's own route
       (`/guru-indicators`) rather than a second hardcoded copy of that path. -->
  <el-sub-menu index="more-group">
    <template #title>更多</template>
    <el-menu-item index="/blog">部落格</el-menu-item>
    <el-menu-item index="/guru-indicators">大師徽章</el-menu-item>
  </el-sub-menu>
</template>
