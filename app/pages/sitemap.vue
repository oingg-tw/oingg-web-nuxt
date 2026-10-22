<script setup lang="ts">
// 網站導覽（2026-09-16「功能導向去網站導覽說明頁」）：取代原本每一頁都顯示的 accesskey 說明列，從 SharedFooter 連過來。結構照無障礙
// 網路空間服務網的網站導覽頁：快速鍵、網站架構、再列出每一條真實路由。快速鍵字母 2026-10-08 對齊無障礙規範 2.0 的慣例（U／C／S／L／Z）。
// 2026-10-22 重新設計（使用者：「sitemap 這邊也來好好設計下 UIUX」「注意 sitemap 主要服務a11y與新手」，方案頁選了 B）：
//   - 最上面一份頁內目錄，鍵盤一下就跳到要的段落
//   - 「第一次來？」三個起點；網站地圖用「我想…」分組（app-features.ts 的 SITE_MAP），每一頁一句說明、要登入的標出來。連結名稱就是頁面
//     名稱，說明放在連結後面，螢幕閱讀器念連結時不會是一長串
//   - 快速鍵改成表格、寫清楚各瀏覽器怎麼按；網站架構配一張示意圖（圖對輔助科技隱藏，文字照樣完整）
useSeoMeta({ title: '網站導覽' })

const START_POINTS = [
  { label: '新手專區', to: '/learn', note: '先看懂營收、獲利、股利這些數字怎麼來的' },
  { label: '普通股篩選', to: SCREENER_PATHS.common, note: '從現成的條件範本開始，不用自己想條件' },
  { label: '配息月曆', to: '/calendar', note: '看每一天有哪些股票除權息、哪天發放' }
]

const ACCESS_KEYS = [
  { key: 'U', target: '上方功能區塊（網站名稱、主要功能，回首頁）' },
  { key: 'C', target: '中央內容區塊' },
  { key: 'S', target: '搜尋區塊（有搜尋的頁面）' },
  { key: 'L', target: '左側功能區塊（有側欄的頁面：個股、ETF、特別股、股票篩選、產業、總經特區、持股管理、新手專區）' },
  { key: 'Z', target: '下方功能區塊（頁尾）' }
]
</script>

<template>
  <div class="app-page sitemap-page">
    <div class="sitemap-page__header">
      <h1 class="app-page__title app-page__title--app sitemap-page__title">網站導覽</h1>
      <p class="sitemap-page__subtitle">這一頁列出本站的每一個功能、鍵盤快速鍵與頁面結構</p>
    </div>

    <nav class="sitemap-page__toc" aria-label="這一頁的段落">
      <a href="#sitemap-start">第一次來？</a>
      <a href="#sitemap-map">網站地圖</a>
      <a href="#sitemap-keys">快速鍵</a>
      <a href="#sitemap-structure">網站架構</a>
    </nav>

    <section id="sitemap-start" class="sitemap-page__section" aria-labelledby="sitemap-start-title">
      <h2 id="sitemap-start-title" class="app-page__h2 sitemap-page__section-title">第一次來？可以從這三頁開始</h2>
      <ul class="sitemap-page__start">
        <li v-for="point in START_POINTS" :key="point.to">
          <NuxtLink :to="point.to" class="sitemap-page__link">{{ point.label }}</NuxtLink>
          <span class="sitemap-page__note">{{ point.note }}</span>
        </li>
      </ul>
    </section>

    <section id="sitemap-map" class="sitemap-page__section" aria-labelledby="sitemap-map-title">
      <h2 id="sitemap-map-title" class="app-page__h2 sitemap-page__section-title">網站地圖</h2>
      <template v-for="group in SITE_MAP" :key="group.label">
        <h3 class="sitemap-page__group-title">{{ group.label }}</h3>
        <ul class="sitemap-page__items">
          <li v-for="link in group.links" :key="link.to">
            <NuxtLink :to="link.to" class="sitemap-page__link">{{ link.label }}</NuxtLink>
            <span v-if="link.requiresLogin" class="sitemap-page__login">需登入</span>
            <span class="sitemap-page__note">{{ link.description }}</span>
          </li>
        </ul>
      </template>
    </section>

    <section id="sitemap-keys" class="sitemap-page__section" aria-labelledby="sitemap-keys-title">
      <h2 id="sitemap-keys-title" class="app-page__h2 sitemap-page__section-title">快速鍵</h2>
      <p class="sitemap-page__note">
        依無障礙規範 2.0 的慣例設定。Windows 的 Chrome、Edge 按 <kbd>Alt</kbd>＋字母；Firefox 按 <kbd>Shift</kbd>＋<kbd>Alt</kbd>＋字母；macOS 按 <kbd>Control</kbd>＋<kbd>Option</kbd>＋字母。
      </p>
      <SharedTableScroll label="快速鍵">
      <table class="seo-table sitemap-page__keys">
        <caption class="visually-hidden">快速鍵：按下後跳到的區塊</caption>
        <thead>
          <tr>
            <th scope="col">字母</th>
            <th scope="col">跳到</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in ACCESS_KEYS" :key="row.key">
            <td><kbd>{{ row.key }}</kbd></td>
            <td>{{ row.target }}</td>
          </tr>
        </tbody>
      </table>
      </SharedTableScroll>
    </section>

    <section id="sitemap-structure" class="sitemap-page__section" aria-labelledby="sitemap-structure-title">
      <h2 id="sitemap-structure-title" class="app-page__h2 sitemap-page__section-title">網站架構</h2>
      <p class="sitemap-page__note">
        每一頁都由上、中、下三個區塊組成：上方功能區塊（網站名稱、主要功能與搜尋）、中央內容區塊（這一頁的內容）、下方功能區塊（頁尾的本站連結、聯絡方式與法律聲明）。
        個股、ETF、特別股、股票篩選、產業、總經特區、持股管理與新手專區另外在左邊有一份這一區的頁面清單，手機上收在畫面底部的「頁面清單」裡。
      </p>
      <div class="sitemap-page__frame" aria-hidden="true">
        <div class="sitemap-page__frame-top">上方功能區塊 <kbd>U</kbd></div>
        <div>左側功能區塊 <kbd>L</kbd></div>
        <div class="sitemap-page__frame-main">中央內容區塊 <kbd>C</kbd></div>
        <div class="sitemap-page__frame-bottom">下方功能區塊（頁尾） <kbd>Z</kbd></div>
      </div>
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

/* 頁內目錄：每個連結 44px 高 */
.sitemap-page__toc {
  display: flex;
  flex-wrap: wrap;
  gap: 0 20px;
  padding: 2px 14px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.sitemap-page__toc a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-color-primary);
}

.sitemap-page__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* 從目錄跳過來時，標題不被黏在上面的頁首蓋住 */
  scroll-margin-top: calc(var(--app-header-height, 64px) + 16px);
}

.sitemap-page__start {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sitemap-page__start li {
  display: flex;
  flex-direction: column;
  padding: 4px 14px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.sitemap-page__group-title {
  margin: 12px 0 0;
  font-size: 1.125rem;
  font-weight: 700;
}

/* 每一頁一列：名稱｜需登入｜一句說明，窄的時候說明換到下一行 */
.sitemap-page__items {
  margin: 0;
  padding: 0;
  list-style: none;
}

.sitemap-page__items li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 12px;
  padding: 0 0 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.sitemap-page__items li:last-child {
  border-bottom: 0;
}

.sitemap-page__items .sitemap-page__link {
  min-width: 7em;
}

.sitemap-page__items .sitemap-page__note {
  flex: 1 1 18em;
}

.sitemap-page__login {
  padding: 0 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
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
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-color-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.sitemap-page__keys th:first-child,
.sitemap-page__keys td:first-child {
  width: 4.5em;
}

/* .seo-table 每一格都不折行（數字表要的）；這張表的說明要折行，手機才不會整張左右捲 */
.sitemap-page__keys td:last-child {
  white-space: normal;
}

kbd {
  padding: 1px 7px;
  border: 1px solid var(--el-border-color);
  border-bottom-width: 2px;
  border-radius: 5px;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 1rem;
  background: var(--el-bg-color);
}

/* 網站架構示意圖：上、左、中、下四塊 */
.sitemap-page__frame {
  display: grid;
  grid-template-columns: 8em minmax(0, 1fr);
  gap: 6px;
  max-width: 440px;
}

.sitemap-page__frame > div {
  display: grid;
  place-items: center;
  min-height: 44px;
  padding: 6px;
  border: 1.5px solid var(--el-border-color);
  border-radius: 6px;
  font-size: 1rem;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.sitemap-page__frame-top,
.sitemap-page__frame-bottom {
  grid-column: 1 / -1;
}

.sitemap-page__frame > .sitemap-page__frame-main {
  min-height: 112px;
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  font-weight: 600;
  color: var(--el-text-color-primary);
}
</style>
