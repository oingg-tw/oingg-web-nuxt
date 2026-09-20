<script setup lang="ts">
import type { StockNavNode } from '~/utils/stock-page-nav'

// One node of the 個股頁面 menu, recursing into its own children — this is what gives the rail
// arbitrary depth (2026-09-20, direct request: 配股配息 becomes 四季分析 with 估值/成長 beneath it,
// and 估值 in turn splits into PER/PBR, which is three levels).
//
// A MULTI-ROOT fragment component with no wrapping element of its own, deliberately: Element Plus
// scopes menu styling with direct-child combinators (`.el-menu--horizontal>.el-menu-item` and
// friends, see AppNavMenu.vue's own comment, which is the same trick for the header). An extra
// <div> here would silently drop that styling one level down.
//
// Every leaf wraps a real <NuxtLink>, never el-menu's `router` mode. That mode navigates from a
// click on the <li role="menuitem"> and emits NO anchor at all — AppNavMenu.vue records the bug
// that caused (a crawler on /screener found 0 internal links). scripts/check-click-depth.mjs
// walks these hrefs to prove every sitemap URL is reachable, so the anchors are load-bearing.
// `tabindex="-1"` keeps the link out of the tab order so el-menu's own roving focus stays the
// single keyboard path instead of each item becoming two tab stops.
defineProps<{
  node: StockNavNode
  code: string
}>()
</script>

<template>
  <el-menu-item v-if="!node.children" :index="node.to!(code)">
    <NuxtLink :to="node.to!(code)" class="stock-page-nav__link" tabindex="-1">{{ node.label }}</NuxtLink>
  </el-menu-item>

  <el-sub-menu v-else :index="`group:${node.label}`">
    <template #title>{{ node.label }}</template>
    <StockPageNavNode v-for="child in node.children" :key="child.label" :node="child" :code="code" />
  </el-sub-menu>
</template>
