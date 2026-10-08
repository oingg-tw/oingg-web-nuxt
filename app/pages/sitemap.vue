<script setup lang="ts">
// 網站導覽（2026-09-16「功能導向去網站導覽說明頁」）：取代原本每一頁都顯示的 accesskey 說明列，從 SharedFooter 連過來。結構照無障礙
// 網路空間服務網的網站導覽頁：快速鍵、網站架構、再列出每一條真實路由。APP_FEATURES 就是 AppFeatureMenu／AppNavMenu 渲染的那一份，
// 這裡重用不另外維護。快速鍵字母 2026-10-08 對齊無障礙規範 2.0 的慣例（U／C／S／L／Z）。
useSeoMeta({ title: '網站導覽' })

interface OtherLink {
  label: string
  to: string
}

// APP_FEATURES 之外的真實路由（那份陣列只放 app-shell 的功能區），分開列才是完整的網站地圖。
const OTHER_LINKS: OtherLink[] = [
  { label: '首頁', to: '/' },
  { label: '排行', to: '/rank' },
  { label: '指標說明', to: '/metrics' },
  { label: '特別股專區', to: '/preferred-stocks' },
  { label: 'ETF 專區', to: '/etf-zone' },
  { label: '部落格', to: '/blog' },
  { label: '外觀設定', to: '/appearance' },
  { label: '個人資料設定', to: '/profile' },
  { label: '無障礙聲明', to: '/accessibility' }
]

// 濾掉自己（2026-09-20）：這頁本身就是網站導覽，列出自己是空轉的自連結。
const features = computed(() => APP_FEATURES.filter(feature => feature.to !== '/sitemap'))
</script>

<template>
  <div class="app-page sitemap-page">
    <div class="sitemap-page__header">
      <h1 class="app-page__title app-page__title--app sitemap-page__title">網站導覽</h1>
      <p class="sitemap-page__subtitle">本站的鍵盤快速鍵、網站架構與完整頁面清單</p>
    </div>

    <section class="sitemap-page__section">
      <h2 class="app-page__h2 sitemap-page__section-title">快速鍵（Accesskey）</h2>
      <p class="sitemap-page__note">依無障礙規範 2.0 的慣例設定定位點。Windows 的 Chrome／Edge 按 Alt＋字母，Firefox 按 Shift＋Alt＋字母，macOS 按 Control＋Option＋字母。</p>
      <ul class="sitemap-page__key-list">
        <li><strong>Alt+U</strong>：上方功能區塊（回首頁）</li>
        <li><strong>Alt+C</strong>：中央內容區塊</li>
        <li><strong>Alt+S</strong>：搜尋區塊（有搜尋功能的頁面）</li>
        <li><strong>Alt+L</strong>：左側功能區塊（有側欄導覽的頁面：個股頁、總經特區、持股管理）</li>
        <li><strong>Alt+Z</strong>：下方功能區塊（頁尾）</li>
      </ul>
    </section>

    <section class="sitemap-page__section">
      <h2 class="app-page__h2 sitemap-page__section-title">網站架構</h2>
      <p class="sitemap-page__note">
        每一頁由三個區塊組成：上方功能區塊（網站名稱、主要功能與搜尋）、中央內容區塊（該頁的內容）、下方功能區塊（頁尾的導覽、聯絡方式與法律聲明）。
        個股頁、總經特區與持股管理另有左側功能區塊列出該區的子頁面；手機上同一份清單收在畫面底部的「頁面清單」裡。
      </p>
    </section>

    <section class="sitemap-page__section">
      <h2 class="app-page__h2 sitemap-page__section-title">網站地圖</h2>
      <ul class="sitemap-page__link-list">
        <li v-for="link in OTHER_LINKS" :key="link.to">
          <NuxtLink :to="link.to" class="sitemap-page__link">{{ link.label }}</NuxtLink>
        </li>
        <li v-for="feature in features" :key="feature.key">
          <NuxtLink :to="feature.to" class="sitemap-page__link">{{ feature.label }}</NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.sitemap-page__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}

.sitemap-page__link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--el-color-primary);
  text-decoration: none;
}

.sitemap-page__link:hover,
.sitemap-page__link:focus-visible {
  text-decoration: underline;
}
</style>
