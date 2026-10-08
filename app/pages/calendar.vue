<script setup lang="ts">
// Personal page (2026-09-19): nothing here is content for a crawler — keep it out of the index, and
// out of the sitemap via nuxt.config's own sitemap.exclude.
useSeoMeta({ title: '配息月曆', robots: 'noindex, nofollow' })

// 登入後的首頁：只有配息月曆（2026-09-10「應該以配息月曆為核心才對」）。原本是儀表板卡片格，2026-09-16 依
// 「總覽 除了配息月曆以外的卡片都先拿掉」關閉、2026-10-08 連程式碼一起刪（git 找得回來）；同日由 dashboard.vue
// 改名 calendar.vue。useDashboardExperienceMode 仍由特別股頁使用，不屬於這一頁。
</script>

<template>
  <div class="calendar-page">
    <div class="calendar-page__header">
      <h1 class="calendar-page__title">配息月曆</h1>
      <p class="calendar-page__subtitle">追蹤除權息與股利發放時程</p>
    </div>

    <!-- ClientOnly：月曆用 new Date() 決定起始月份，SSR 與瀏覽器的時間不同會造成 hydration 不一致 -->
    <ClientOnly>
      <DashboardDividendCalendarCard class="calendar-page__hero" />
    </ClientOnly>

  </div>
</template>

<style scoped>
.calendar-page {
  width: 100%;
}

.calendar-page__header {
  margin: 0 0 32px;
}

.calendar-page__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 8px;
}

.calendar-page__subtitle {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.calendar-page__hero {
  margin-bottom: 24px;
}
</style>
