<script setup lang="ts">
import type { StockNavNode } from '~/utils/stock-page-nav'

// 區內導覽的連結清單——個股頁面（STOCK_NAV_ITEMS＋使用者釘選的指標）與產業特區共用（2026-10-01「請使用共用元件。不可重造
// 車輪。」）。呼叫端各掛兩份：AppBottomNav（手機）與 AppNavRail（桌機），兩份都在 SSR HTML 裡，CSS 決定哪一份可見。
//
// 原生 <ul>／<a>，不是 el-menu（2026-10-08 重寫）：Element Plus 2.14 的 el-menu-item 寫死 tabindex="-1"，鍵盤處理只裝在水平
// 選單，直式選單裡的連結用 Tab 永遠到不了（WCAG 2.1.1 的阻斷項）；而且 role="menubar" 套在一份連結清單上本來就是錯的語意。
// 清單是平的——STOCK_NAV_ITEMS 與 INDUSTRY_ZONE_ITEMS 都沒有群組節點，釘選的也是葉節點——所以沒有群組的標記；哪天真的要分組，
// 用 <details>/<summary>（AppBottomNav 的做法），不要回去用 el-sub-menu。
//
// 留下來的鉤子都有別處在讀：<nav aria-label>（check-stock-pages 在 SSR HTML 裡找「個股頁面」）、每個目的地都是真的 <a href>
// （check-click-depth 讀 raw HTML 證明三步內可達）、目前頁由 NuxtLink 的 aria-current="page" 表達（check-macro-rail 斷言粗體＋
// 底線，不能只靠顏色）、≥48px 的列高（本站對年長讀者的下限，高於 WCAG 的 24×24）。
const props = withDefaults(defineProps<{
  code?: string
  items?: StockNavNode[]
  label?: string
}>(), { code: '', items: () => STOCK_NAV_ITEMS, label: '個股頁面' })

const pinnedNodes = useStockPinnedMetricNodes()
// 釘選的指標只屬於個股頁面那一份清單；別的區域傳自己的 items 時不該長出「自選指標」那一段。
const showPinned = computed(() => props.items === STOCK_NAV_ITEMS)

// 三段：骨幹、使用者自己釘的（2026-09-26，有分隔線與小標題——沒有分界的話，釘選的列讀起來像網站少給了幾個入口）、
// 「找不到時去哪裡翻」的 trailing 列（2026-09-28 排在釘選後面，由 STOCK_NAV_ITEMS 的 trailing 旗標決定）。
const sections = computed(() => [
  { key: 'leading', items: props.items.filter(item => !item.trailing) },
  ...(showPinned.value && pinnedNodes.value.length ? [{ key: 'pinned', heading: '自選指標', items: pinnedNodes.value }] : []),
  { key: 'trailing', items: props.items.filter(item => item.trailing), divided: true }
])
</script>

<template>
  <nav class="stock-page-nav" :aria-label="label">
    <!-- 釘選那一段不包 ClientOnly：useState 的預設值兩邊一致，那些列是帳號同步完成後才長出來的狀態變化，不是 hydration 不匹配。 -->
    <ul class="stock-page-nav__list">
      <template v-for="section in sections" :key="section.key">
        <li v-if="section.heading" class="stock-page-nav__heading">{{ section.heading }}</li>
        <li v-for="(item, index) in section.items" :key="item.label" :class="{ 'stock-page-nav__divided': section.divided && index === 0 }">
          <NuxtLink :to="item.to!(code)" class="stock-page-nav__link">
            <el-icon v-if="item.icon" aria-hidden="true" class="stock-page-nav__icon"><component :is="item.icon" /></el-icon>{{ item.label }}
          </NuxtLink>
        </li>
      </template>
    </ul>
  </nav>
</template>

<style scoped>
.stock-page-nav {
  width: 100%;
}

.stock-page-nav__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 整列可點（連結撐滿 li），48px 是本站的觸控下限 */
.stock-page-nav__link {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 8px 20px;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--el-text-color-primary);
  text-decoration: none;
}

.stock-page-nav__link:hover {
  background: var(--el-fill-color-light);
}

/* 側欄與底部清單都是 overflow 容器，全站的 2px 外框會被邊緣裁掉，所以往內畫 */
.stock-page-nav__link:focus-visible {
  outline-offset: -2px;
  border-radius: 0;
}

/* 目前頁：粗體＋底線＋底色一起上——顏色從來不是唯一的線索 */
.stock-page-nav__link[aria-current='page'] {
  font-weight: 700;
  color: var(--el-color-primary-dark-2);
  background: var(--el-color-primary-light-9);
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 2px;
}

.stock-page-nav__icon {
  flex-shrink: 0;
  font-size: 1.125rem;
}

/* 兩條分隔線長得一樣，因為分的是同一種東西：骨幹｜自己釘的｜找不到時去翻的 */
.stock-page-nav__heading {
  margin-top: 8px;
  padding: 12px 20px 4px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.stock-page-nav__divided {
  margin-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
