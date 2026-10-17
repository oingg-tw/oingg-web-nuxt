<script setup lang="ts">
// 特別股專區每一頁的骨架（2026-10-18）：h1 → 麵包屑 → 專區導覽 → 各頁的問答段落 → 資料來源。六頁共用，所以「以公司正式公告為準」
// 這種專區的規則只寫在這裡一次（CLAUDE.md：慣例由一個負責元件擁有）。SEO 也在這裡：專區頁都可以被索引。
const props = defineProps<{
  // h1
  title: string
  // 麵包屑最後一層；總覽頁不給（麵包屑停在「特別股專區」）
  topic?: string
  path: string
  seoTitle: string
  description: string
}>()

const { breadcrumbs } = useHubPageSeo({
  title: props.seoTitle,
  description: () => props.description,
  path: props.path,
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '特別股專區', to: PREFERRED_ZONE_PATH },
    ...(props.topic ? [{ label: props.topic, to: props.path }] : [])
  ]
})
</script>

<template>
  <div class="app-page app-page--compact preferred-zone-page">
    <h1 class="app-page__title">{{ title }}</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <PreferredNav />
    <slot />
    <p class="hub-answer hub-sources">
      資料來源：公開資訊觀測站（特別股發行條件）、證交所與櫃買中心（收盤價、成交量）。發行條件以公司正式公告為準；本站只呈現數字，不構成任何買賣建議。
    </p>
  </div>
</template>
