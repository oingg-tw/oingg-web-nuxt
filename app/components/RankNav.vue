<script setup lang="ts">
// 排行的側欄（2026-10-21，使用者：「rank 希望 sidebar 區分 普通股與 etf」）：RANK_PAGES 照順序，普通股與 ETF 各一組（組標題與分隔線）。
// 原本排行頁沒有側欄，每頁底下一排「其他排行」連結，那一排跟著拿掉。手機底部條「目前：」後面接是哪一組（兩組都有「殖利率」這類名字）。
// 版面與兩份 DOM 的理由在 SectionNav.vue。
defineProps<{ etf?: boolean }>()
const RANK_NAV_ITEMS = RANK_PAGES.map((page, index) => {
  const group = page.universe === 'etf' ? 'ETF' : '普通股'
  const previous = RANK_PAGES[index - 1]
  const first = !previous || (previous.universe === 'etf') !== (page.universe === 'etf')
  return { label: page.label, to: rankPath(page.slug), ...(first ? { heading: group } : {}) }
})
</script>

<template>
  <SectionNav label="排行" :items="RANK_NAV_ITEMS" :current-detail="etf ? 'ETF' : null" />
</template>
