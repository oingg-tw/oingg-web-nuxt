<script setup lang="ts">
// 網站導覽（2026-09-16「功能導向去網站導覽說明頁」）：取代原本每一頁都顯示的 accesskey 說明列，從 SharedFooter 連過來。結構照無障礙
// 網路空間服務網的網站導覽頁：快速鍵、網站架構、再列出每一條真實路由。網站地圖是 app-features.ts 的 SITE_MAP，頁尾讀同一份
//（2026-10-22 起；原本這裡另外寫一份，漏了除權息月覽、排行與普通股篩選各列兩次）。快速鍵字母 2026-10-08 對齊無障礙規範 2.0 的慣例（U／C／S／L／Z）。
useSeoMeta({ title: '網站導覽' })

// 濾掉自己（2026-09-20）：這頁本身就是網站導覽，列出自己是空轉的自連結。
const groups = SITE_MAP.map(group => ({ ...group, links: group.links.filter(link => link.to !== '/sitemap') }))
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
        <li><strong>Alt+L</strong>：左側功能區塊（有側欄導覽的頁面：個股、ETF、特別股、股票篩選、產業、總經特區、持股管理、新手專區）</li>
        <li><strong>Alt+Z</strong>：下方功能區塊（頁尾）</li>
      </ul>
    </section>

    <section class="sitemap-page__section">
      <h2 class="app-page__h2 sitemap-page__section-title">網站架構</h2>
      <p class="sitemap-page__note">
        每一頁由三個區塊組成：上方功能區塊（網站名稱、主要功能與搜尋）、中央內容區塊（該頁的內容）、下方功能區塊（頁尾的導覽、聯絡方式與法律聲明）。
        個股、ETF、特別股、股票篩選、產業、總經特區、持股管理與新手專區另有左側功能區塊列出該區的子頁面；手機上同一份清單收在畫面底部的「頁面清單」裡。
      </p>
    </section>

    <section class="sitemap-page__section">
      <h2 class="app-page__h2 sitemap-page__section-title">網站地圖</h2>
      <template v-for="group in groups" :key="group.label">
        <h3 class="sitemap-page__group-title">{{ group.label }}</h3>
        <ul class="sitemap-page__link-list">
          <li v-for="link in group.links" :key="link.to">
            <NuxtLink :to="link.to" class="sitemap-page__link">{{ link.label }}</NuxtLink>
          </li>
        </ul>
      </template>
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

.sitemap-page__group-title {
  margin: 8px 0 0;
  font-size: 1rem;
  font-weight: 600;
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
