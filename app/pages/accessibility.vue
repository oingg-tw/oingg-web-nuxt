<script setup lang="ts">
// 無障礙聲明（2026-10-08）：台灣無障礙網頁規範 2.0 AA 標章與 WCAG 2.2 AA 符合性聲明放同一頁，中文在前、英文段落 lang="en"（英文另存
// docs/a11y/statement-en.md，兩份要同步）。可索引、進 sitemap；更新日期＝docs/a11y/evidence 最近一份證據的日期。
useSeoMeta({
  title: '無障礙聲明',
  description: '安盈選股依網站無障礙規範 2.0 AA 與 WCAG 2.2 AA 設計與檢測。本頁說明適用範圍、檢測方式與日期、已知限制、鍵盤快速鍵與回饋管道。'
})

const UPDATED = '2026-10-08'
const FEEDBACK_EMAIL = 'ian.chu@oingg.com'
</script>

<template>
  <div class="app-page accessibility-page">
    <h1 class="app-page__title app-page__title--app">無障礙聲明</h1>

    <section class="accessibility-page__section" aria-labelledby="a11y-standards">
      <h2 id="a11y-standards" class="app-page__h2">依據標準</h2>
      <p>安盈選股依下列兩項標準設計與檢測：</p>
      <ul>
        <li>數位發展部「網站無障礙規範 2.0」AA 等級。</li>
        <li>W3C「網頁內容無障礙指引（WCAG）2.2」AA 等級，含所有 A 級與 AA 級成功準則。</li>
      </ul>
    </section>

    <section class="accessibility-page__section" aria-labelledby="a11y-scope">
      <h2 id="a11y-scope" class="app-page__h2">適用範圍</h2>
      <p>
        全站，包含不需登入的首頁、配息月曆、個股篩選與條件頁、個股總表與各類股頁、個股頁全部子頁、排行、指標說明、總經特區、特別股專區、ETF 專區、大師徽章、部落格，
        以及登入後的持股管理、觀察清單、個人資料設定與外觀設定。
      </p>
      <p>第三方內容：登入對話框由 FirebaseUI 產生，標記屬於 Firebase；顏色對比不足之處已由本站覆寫，無法調整的項目列在下方「已知限制」。</p>
    </section>

    <section class="accessibility-page__section" aria-labelledby="a11y-methods">
      <h2 id="a11y-methods" class="app-page__h2">檢測方式與日期</h2>
      <ul>
        <li>
          自動檢測：axe-core 4.13（規則標籤 wcag2a、wcag2aa、wcag21a、wcag21aa、wcag22aa、best-practice），由程式庫裡的 check-a11y-pages、check-stock-pages、check-hub-pages、check-macro-rail
          四支腳本對每一頁在淺色與深色模式、375px（觸控）與 1440px 寬度、文字 100% 與 120% 下執行，並檢查頁面標題、單一主標題、橫向捲動、觸控目標尺寸與指令碼錯誤。任何人取得程式庫都能重跑。
        </li>
        <li>人工檢查：依 WCAG 2.2 全部 A／AA 準則逐條檢查（檢查表與樣本頁記錄在程式庫的 docs/a11y/conformance.md）。</li>
        <li>Freego 2.0：於部署後、申請無障礙標章前對正式網址執行，結果一併保存。</li>
      </ul>
      <p>最近一次檢測日期：{{ UPDATED }}。</p>
    </section>

    <section class="accessibility-page__section" aria-labelledby="a11y-limits">
      <h2 id="a11y-limits" class="app-page__h2">已知限制</h2>
      <ul>
        <li>登入對話框（FirebaseUI）的標記為第三方所有；對比不足的顏色已覆寫，之後發現的項目會在此列出並註明日期。</li>
        <li>手機寬度下，頁首與頁尾的少數文字連結、配息月曆的日期格，觸控目標短邊介於 24 到 43 像素之間：符合 WCAG 2.2 AA（2.5.8，24 像素）但未達 AAA 的 44 像素；所有表單控制項與按鈕在觸控裝置上至少 44 像素。</li>
        <li>圖表以可讀取的名稱與同頁的資料表呈現數據，不另提供口語化的趨勢摘要。</li>
      </ul>
    </section>

    <section class="accessibility-page__section" aria-labelledby="a11y-keys">
      <h2 id="a11y-keys" class="app-page__h2">鍵盤快速鍵</h2>
      <p>
        依無障礙規範的慣例：Alt+U 上方功能區塊（回首頁）、Alt+C 中央內容區塊、Alt+S 搜尋、Alt+L 左側功能區塊（有側欄的頁面）、Alt+Z 下方功能區塊。
        Firefox 請按 Shift+Alt+字母，macOS 請按 Control+Option+字母。完整說明與網站架構在<NuxtLink to="/sitemap" class="hub-inline-link">網站導覽</NuxtLink>。
      </p>
    </section>

    <section class="accessibility-page__section" aria-labelledby="a11y-feedback">
      <h2 id="a11y-feedback" class="app-page__h2">回饋管道</h2>
      <p>
        若本站任何頁面不便使用，請來信 <a :href="`mailto:${FEEDBACK_EMAIL}`" class="hub-inline-link">{{ FEEDBACK_EMAIL }}</a>，
        並告訴我們是哪一頁、使用的輔助科技或瀏覽器，我們會盡快回覆並修正。
      </p>
      <p>本聲明更新日期：{{ UPDATED }}。</p>
    </section>

    <section class="accessibility-page__section accessibility-page__section--en" lang="en" aria-labelledby="a11y-en">
      <h2 id="a11y-en" class="app-page__h2">Accessibility Conformance Statement</h2>
      <p>Statement date and last review: {{ UPDATED }}.</p>

      <h3 class="accessibility-page__h3">Standards</h3>
      <p>安盈選股 is built to conform to WCAG 2.2 Level AA (W3C Web Content Accessibility Guidelines 2.2, all Level A and Level AA success criteria) and to Taiwan Web Accessibility Guidelines 2.0, Level AA.</p>

      <h3 class="accessibility-page__h3">Scope</h3>
      <p>
        The whole site, public and signed in: the landing page, the dividend calendar, the stock screener and its condition pages, the company directory and every sector page, every company page,
        rankings, metric explanations, the macro zone, preferred stocks, ETFs, guru badges, the blog, and the signed-in tools for holdings, watchlist, profile and appearance.
        Third-party content: the sign-in dialog is rendered by FirebaseUI.
      </p>

      <h3 class="accessibility-page__h3">Technologies relied upon</h3>
      <p>HTML, CSS, JavaScript, WAI-ARIA, SVG. Charts are drawn as SVG, each exposed as an image with an accessible name, and the numbers behind every chart are also rendered as an HTML table.</p>

      <h3 class="accessibility-page__h3">Evaluation methods</h3>
      <p>
        Automated and repeatable: axe-core 4.13 (tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice) run by the repository's check scripts against every page in light and dark mode,
        at 375 px (touch) and 1440 px, at 100% and 120% text size, plus checks for the page title, a single h1, horizontal overflow, touch-target size and script errors.
        Manual: a checklist of every WCAG 2.2 A/AA success criterion with its method, status and sample pages (docs/a11y/conformance.md in the repository).
        Freego 2.0 is run against the deployed site before the AA mark application.
      </p>

      <h3 class="accessibility-page__h3">Known limitations</h3>
      <ul>
        <li>Sign-in dialog (FirebaseUI): third-party markup; colours that failed contrast are overridden, anything found later is listed here with a date.</li>
        <li>Touch targets between 24 px and 44 px: a few text links in the header and footer and the day cells of the dividend calendar on a 375 px screen meet WCAG 2.2 Level AA (2.5.8, 24 px) but not the AAA 44 px target. All form controls and buttons are at least 44 px on touch devices.</li>
        <li>Charts are described by their accessible name and data table, not by a narrated summary.</li>
      </ul>

      <h3 class="accessibility-page__h3">Feedback</h3>
      <p>If any part of 安盈選股 is hard to use, write to <a :href="`mailto:${FEEDBACK_EMAIL}`" class="hub-inline-link">{{ FEEDBACK_EMAIL }}</a> and say which page and which assistive technology or browser you were using. We will reply as soon as we can.</p>
    </section>
  </div>
</template>

<style scoped>
.accessibility-page__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.accessibility-page__section p,
.accessibility-page__section ul {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.accessibility-page__section ul {
  padding-left: 1.5em;
}

.accessibility-page__section li + li {
  margin-top: 4px;
}

.accessibility-page__section--en {
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.accessibility-page__h3 {
  margin: 8px 0 0;
  font-size: 1rem;
  font-weight: 600;
}
</style>
