<script setup lang="ts">
// 網站導覽 — 2026-09-16 per direct request ("不要這種 app-accesskey-bar 方式。請加上功能。功能導向
// 去網站導覽說明頁。") replacing the always-visible AppAccesskeyBar.vue text bar (itself added
// earlier the same day, modeled on a PDF the user shared of Taiwan's own「無障礙網路空間服務網」
// 網站導覽頁): that bar documented the Accesskey scheme on every single page whether anyone
// needed it or not; this is a real, linked page instead (reachable via SharedFooter.vue's own
// 網站導覽 nav link) — a genuine "功能" (feature) the user navigates TO, not a permanent fixture.
//
// Mirrors the PDF's own page structure: 快速鍵 (accesskey) documentation first, then a full site
// map of every real route. APP_FEATURES (app/utils/app-features.ts) is the same array
// AppPinnedSidebar.vue/AppFeatureMenu.vue already render as the app's own nav — reused here
// rather than a second hand-maintained list that could drift out of sync with the real nav.
useSeoMeta({ title: '網站導覽' })

interface OtherLink {
  label: string
  to: string
  note?: string
}

// Real routes NOT in APP_FEATURES (that array is specifically "app-shell nav sections" — see its
// own comment — not every route in the app). Listed separately so this page stays a genuine,
// complete site map instead of silently only covering the subset APP_FEATURES happens to include.
const OTHER_LINKS: OtherLink[] = [
  { label: '首頁', to: '/' },
  { label: '部落格', to: '/blog' },
  { label: '外觀設定', to: '/appearance' },
  { label: '個人資料設定', to: '/profile' }
]
</script>

<template>
  <div class="sitemap-page">
    <div class="sitemap-page__header">
      <h1 class="sitemap-page__title">網站導覽</h1>
      <p class="sitemap-page__subtitle">本站支援的鍵盤快速鍵與完整頁面清單</p>
    </div>

    <section class="sitemap-page__section">
      <h2 class="sitemap-page__section-title">快速鍵（Accesskey）</h2>
      <ul class="sitemap-page__key-list">
        <li><strong>Alt+U</strong>：回首頁</li>
        <li><strong>Alt+C</strong>：中央內容區塊</li>
        <li><strong>Alt+N</strong>：搜尋（僅提供搜尋功能的頁面支援，例如首頁以外的各頁）</li>
        <li><strong>Alt+H</strong>：頁尾</li>
      </ul>
      <p class="sitemap-page__note">若您使用 Firefox 瀏覽器，請改用 Shift+Alt+ 對應字母。</p>
    </section>

    <section class="sitemap-page__section">
      <h2 class="sitemap-page__section-title">網站地圖</h2>
      <ul class="sitemap-page__link-list">
        <li v-for="link in OTHER_LINKS" :key="link.to">
          <NuxtLink :to="link.to" class="sitemap-page__link">{{ link.label }}</NuxtLink>
        </li>
        <li v-for="feature in APP_FEATURES" :key="feature.key">
          <NuxtLink :to="feature.to" class="sitemap-page__link">{{ feature.label }}</NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.sitemap-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.sitemap-page__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sitemap-page__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.sitemap-page__subtitle {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.sitemap-page__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sitemap-page__section-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.sitemap-page__key-list,
.sitemap-page__link-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sitemap-page__key-list li,
.sitemap-page__link-list li {
  font-size: 1rem;
}

.sitemap-page__note {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.sitemap-page__link {
  color: var(--el-color-primary);
  text-decoration: none;
}

.sitemap-page__link:hover {
  text-decoration: underline;
}
</style>
