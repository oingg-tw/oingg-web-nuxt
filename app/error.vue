<script setup lang="ts">
import type { NuxtError } from '#app'

// The site's error page (2026-09-19, the SEO build) — before this, every createError({ fatal })
// (an unknown sector, rank, template or metric slug; a stale blog slug) fell through to Nuxt's
// default error screen with no way onward. A real 404 status still goes out（Nuxt sets it from
// the error）; the page just gives a person the hub entry points instead of a dead end. Rendered
// inside the marketing layout（header + footer, no sidebar）so the nav is there too.
const props = defineProps<{
  error: NuxtError
}>()

const isNotFound = computed(() => props.error.statusCode === 404)
const title = computed(() => (isNotFound.value ? '找不到這個頁面' : '這個頁面暫時無法顯示'))

useSeoMeta({ title, robots: 'noindex, nofollow' })

const LINKS = [
  { label: '首頁', to: '/' },
  { label: '個股總表', to: '/stock' },
  { label: '個股篩選', to: '/screener' },
  { label: '排行', to: '/rank' },
  { label: '指標說明', to: '/metrics' }
]

function goHome() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <NuxtLayout name="landing">
    <main id="main-content" class="error-page" tabindex="-1">
      <h1 class="error-page__title">{{ title }}</h1>
      <p class="error-page__message">
        <template v-if="isNotFound">這個網址沒有對應的頁面：可能是輸入有誤、頁面已移除，或代碼不在本站收錄範圍內。</template>
        <template v-else>伺服器回報了錯誤（{{ error.statusCode }}）。稍後再試，或從下面的入口重新開始。</template>
      </p>
      <p v-if="error.statusMessage" class="error-page__detail">{{ error.statusMessage }}</p>
      <nav aria-label="常用入口">
        <ul class="hub-chip-list">
          <li v-for="link in LINKS" :key="link.to">
            <NuxtLink :to="link.to" class="hub-chip">{{ link.label }}</NuxtLink>
          </li>
        </ul>
      </nav>
      <el-button type="primary" class="error-page__button" @click="goHome">回首頁</el-button>
    </main>
  </NuxtLayout>
</template>

<style scoped>
.error-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 48px 0;
}

.error-page__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.error-page__message,
.error-page__detail {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.error-page__detail {
  color: var(--el-text-color-secondary);
}

.error-page__button {
  align-self: flex-start;
  min-height: 48px;
  font-size: 1rem;
}
</style>
