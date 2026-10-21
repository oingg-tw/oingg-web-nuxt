<script setup lang="ts">
// 首頁是公開的 SEO 落地頁（從儀表板拆出：即時資料的儀表板沒有可索引的東西，而最高權重的網址卻閒著）。結構照
// docs/存股 SaaS 首頁 SEO 策略.md 的模組表（hero → 核心功能 → FAQ）與 H1→H2→H3；刻意沒有定價快照與 AggregateRating（沒有真的方案
// 與評論，捏造正是那份文件警告的 YMYL 誤導）。幾次重做：2026-09-02「首頁砍掉大改」加理念段（工具的理念，不是對投資結果的主張）；
// 2026-09-05 依 首頁.md 用 03-獨特價值主張 的 UVP 句當 H1、hero 照使用者給的競品截圖（只換文案、不抄「今日精選」輪播——跟本站
// 不給精選的規則衝突）、同日拿掉多餘的 CTA 與排行區（「以下的部分請還原成之前的那個簡單的版本」）。
// hero 插圖 public/images/landing-hero-tree.jpg 是使用者提供的素材，根部發光的數字是裝飾不是資料（.avif／.webp 是同一張用 ffmpeg 轉的，
// 2026-10-16；換圖時三個一起換）。hero 容器用 Grid 不用 flex-column：
// 單欄版「子元素照自己內容定寬」的 bug 修過三次（f21baf2／4e60a40／b2720c3），Grid 項目預設 stretch。
import { Calendar, Filter, Histogram } from '@element-plus/icons-vue'
import type { Component } from 'vue'
import type { HubSector } from '#shared/types/hub'

// Own standalone layout (see layouts/landing.vue and app.vue) instead of the app-shell
// desktop/mobile split every other page uses — no pinned sidebar or stock search bar here.
definePageMeta({ layout: 'landing' })

useSeoMeta({
  title: '安盈選股 — 普通股篩選與財報分析工具',
  // Opts out of nuxt.config.ts's global `titleTemplate` (added 2026-09-19) — this title already
  // leads with the brand, so the template's own「｜安盈選股」suffix would double it.
  titleTemplate: '%s',
  description: '安盈選股整理公開財報與交易所資料，陪你篩選、比較、看懂每一檔上市櫃公司的財報指標與股價數據。'
})

interface Highlight {
  key: string
  icon: Component
  title: string
  description: string
  to: string
}

// 核心功能卡：2026-09-19 介面複雜度檢視改成 4 張對齊頁首導覽的四個目的地；2026-09-20 加配息月曆（「那才是人家沒有我們有的東西」）；
// 2026-09-22 砍到三張（「精選三項就好」），低於參考文件的 4–6 張也是刻意的：三張都是「任務」，找股票是下面類股列表的目錄、指標說明在
// 頁尾，沒有失去入口只是失去卡片。配息月曆 2026-09-23 暫緩又當天放回（「ETF 可以用」），排第一。
const HIGHLIGHTS: Highlight[] = [
  // 配息月曆 first: it is the thing this site has that others don't（「那才是人家沒有我們有的東西」）,
  // and the one a returning reader opens most often.
  {
    key: 'calendar',
    icon: Calendar,
    title: '配息月曆',
    description: '整理除權息時間與股利發放時程',
    to: '/calendar'
  },
  {
    key: 'screener',
    icon: Filter,
    title: '股票篩選',
    description: '普通股、特別股與 ETF，用條件篩出符合的',
    to: '/screener/common'
  },
  {
    key: 'rank',
    icon: Histogram,
    title: '排行',
    description: '殖利率、本益比、ROE 等前 50 檔',
    to: '/rank'
  }
]

// The 36 exchange sectors, server-rendered as links so a crawler starting here reaches every
// /industry/… page (and through them every stock page) without JavaScript. Cached 24h on the
// server (/api/hub/sectors); an empty list simply hides the section.
const { data: sectors } = await useFetch<HubSector[]>('/api/hub/sectors', { key: 'hub-sectors', default: () => [] })

// Kept honest on purpose — no invented update cadence, user counts, or accuracy claims this
// app can't actually back up. Mirrored into the FAQPage JSON-LD below verbatim, so the
// visible text and the structured data never drift apart.
interface FaqItem {
  question: string
  answer: string
}

const FAQS: FaqItem[] = [
  {
    question: '使用安盈選股需要付費嗎？',
    // 2026-10-06 改寫（「完善付費方案」）：原本寫「目前所有功能皆可免費使用」，跟額度上限矛盾。付費只差在能追蹤、
    // 儲存多少（投信投顧法：分析不能分付費），價格還沒定所以不寫金額。
    answer: '個股分析、篩選結果與資料來源都免費，而且免費版與專業版看到的完全一樣。兩者的差別只在能追蹤、儲存多少，例如觀察清單的檔數。新註冊的帳號有 14 天專業版試用，到期自動轉為免費版，資料不會刪除。'
  },
  {
    question: '篩選結果算是投資建議嗎？',
    answer:
      '不是。安盈選股提供的篩選工具、財報指標說明與歷史回測僅供投資輔助與財務規劃參考，不構成任何有價證券之買賣建議或獲利保證，實際投資決策請自行判斷並審慎評估風險。'
  },
  {
    question: '股價與財報數據從哪裡來？',
    answer: '股市歷史行情、財務比率與除權息資訊來源包含台灣證券交易所（TWSE）、證券櫃檯買賣中心（TPEx）及公開資訊觀測站等公開資料。'
  },
  {
    question: '可以追蹤 ETF 嗎？',
    answer: '可以，安盈選股提供 ETF 專區協助比較追蹤標的。'
  }
]

const requestUrl = useRequestURL()
const companyInfo = useCompanyInfo()

// JSON-LD：SoftwareApplication（FinanceApplication）＋ Organization ＋ FAQPage，SEO 策略文件列的基線三種；offers／aggregateRating
// 刻意省略（見檔頭），logo 也省（沒有真的圖檔，指向不存在的網址比沒有更糟）。Organization.legalName 2026-09-07 依 Footer.md §4 加：
// name 是品牌 安盈選股，legalName 是頁尾版權列的登記實體（useCompanyInfo），爬蟲看到同一個實體的兩個正確型別的名字。
useHead({
  // Self canonical (2026-09-19, the SEO build) — the landing page had none; every other indexable
  // page declares one, and a tracking-parameter visit（?utm_…）must resolve to this URL.
  link: [{ rel: 'canonical', href: `${requestUrl.origin}/` }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: '安盈選股',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        url: requestUrl.origin
      })
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: '安盈選股',
        legalName: companyInfo.legalName,
        url: requestUrl.origin,
        sameAs: ['https://github.com/oingg-tw']
      })
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQS.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer }
        }))
      })
    }
  ]
})
</script>

<template>
  <div class="landing-page">
    <!-- Reverted to the pre-2026-09-19 hero layout 2026-09-20 per direct request
         ("landing-page__hero 請回復成舊版本") — image-first two-column grid, eyebrow pill,
         3-sentence lead, search box, hero-note disclaimer, with the 核心功能 cards back in their
         own section below rather than inside this one's text column. This undoes the Phase C
         first-screen-fold fix from the interface-complexity plan (the search box no longer
         clears 375×812's fold on its own) — a deliberate trade the user made, not an oversight;
         don't re-apply that fix without asking again. -->
    <section class="landing-page__hero">
      <div class="landing-page__hero-visual">
        <!-- 手機版的 LCP 元素（2026-10-16）：AVIF／WebP 先（同一張圖 95.6 KB → 20／33 KB），舊瀏覽器退回 JPEG；fetchpriority 讓它不必
             排在前面一長串模組預載後面 -->
        <picture>
          <source type="image/avif" srcset="/images/landing-hero-tree.avif">
          <source type="image/webp" srcset="/images/landing-hero-tree.webp">
          <img src="/images/landing-hero-tree.jpg" alt="投資如同種一棵樹，紮根、生長、結果的示意圖" width="736" height="664" fetchpriority="high">
        </picture>
      </div>

      <div class="landing-page__hero-text">
        <span class="landing-page__eyebrow">財報 + 金流分析工具</span>
        <h1 class="landing-page__title">用工具協助解讀財報<br>找出值得長期持有的好公司</h1>
        <!-- 一句話，不再是三句加一個比喻（2026-09-23）：「投資如同種一棵樹」是高概念訴求，UVP 方法論說它不屬於落地頁，旁邊的插圖已經
             表達同一件事；年長讀者會逐字從頭讀到尾，抒情開場會整段讀完才到正題。上面的 h1 是定案的 UVP，沒動。 -->
        <p class="landing-page__lead">
          安盈選股整理公開的財報與交易所資料，陪你看懂每一檔上市櫃公司的數字。
        </p>
        <LandingStockSearch />
        <!-- 資料來源寫在頁面上、不只在頁尾（2026-09-23）：對提防金融詐騙的讀者，「你的數字哪裡來」就是信任問題本身。只留一行，下面的
             免責聲明維持全頁唯一一條——逐句加警語會反效果。 -->
        <p class="landing-page__hero-source">
          資料來自臺灣證券交易所、證券櫃檯買賣中心與公開資訊觀測站。
        </p>
        <p class="landing-page__hero-note">
          本站篩選結果與財報說明僅供投資輔助參考，不構成買賣建議或獲利保證。
        </p>
      </div>
    </section>

    <section class="landing-page__section">
      <h2 class="landing-page__section-title">核心功能</h2>
      <div class="landing-page__highlights">
        <NuxtLink
          v-for="item in HIGHLIGHTS"
          :key="item.key"
          :to="item.to"
          class="landing-page__card"
        >
          <div class="landing-page__card-head">
            <el-icon class="landing-page__card-icon"><component :is="item.icon" /></el-icon>
            <h3 class="landing-page__card-title">{{ item.title }}</h3>
          </div>
          <p class="landing-page__card-desc">{{ item.description }}</p>
        </NuxtLink>
      </div>
    </section>

    <!-- 收合（2026-09-23「首頁資訊太多很雜亂」）：這一塊佔全頁 70 個連結裡的 36 個，而且跟 /stock 幾乎重複（35 個目的地有 34 個）；
         2026-09-19 加它只是讓爬蟲從首頁到得了每個類股頁。留在標記裡、收進原生 <details>：開合都在 SSR HTML 裡，check-hub-pages 的
         industryLinksMin: 30 照過、個股頁維持點擊深度 2。整塊刪掉也可行（/stock 在頁首頁尾都有連結，深度 3 剛好壓線）但要改檢查。 -->
    <section v-if="sectors.length" class="landing-page__section" aria-labelledby="landing-sectors-heading">
      <h2 id="landing-sectors-heading" class="landing-page__section-title">依類股瀏覽上市櫃公司</h2>
      <p class="landing-page__section-lead">
        證交所每個類股各有一頁，列出該類股每家公司的股價、本益比、殖利率與 ROE。
        <NuxtLink to="/industries" class="landing-page__inline-link">看產業索引</NuxtLink>
      </p>
      <details class="hub-details landing-page__sectors">
        <summary>展開 {{ sectors.length }} 個類股</summary>
        <ul class="hub-chip-list">
          <li v-for="sector in sectors" :key="sector.code">
            <NuxtLink :to="sectorPath(sector.code) ?? '/industries'" class="hub-chip">{{ sector.name }} <span class="hub-chip__count">{{ sector.companyCount }}<span class="visually-hidden"> 家</span></span></NuxtLink>
          </li>
        </ul>
      </details>
    </section>

    <section class="landing-page__section">
      <h2 class="landing-page__section-title">常見問題</h2>
      <div class="landing-page__faqs">
        <div v-for="faq in FAQS" :key="faq.question" class="landing-page__faq">
          <h3 class="landing-page__faq-question">{{ faq.question }}</h3>
          <p class="landing-page__faq-answer">{{ faq.answer }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 背景純色（2026-10-21，使用者：「背景不要 再有 樣式 改成純色就好」）：原本這裡是五團主色光暈（::before 滿版），拿掉 */
.landing-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 48px;
}

/* Grid 不用 flex（見檔頭）：舊的 flex-column 單欄 hero 三次修「子元素照自己內容定寬」，根因是 align-items: flex-start；Grid 項目
   預設 stretch，改成雙欄也不會再犯。960px 以下單欄：插圖 1408×768 寬扁，768px 就擺不下。 */
.landing-page__hero {
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  gap: 24px;
  padding: 24px 0;

  @media (min-width: 960px) {
    grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
    gap: 40px;
  }
}

/* Bordered, rounded panel — deliberately NOT trying to blend the image's own dark canvas into
   the page background (which varies by theme: this app's dark mode is #121212, but users can
   switch to several light accent themes too, see theme.css). A framed illustration reads as
   intentional in every theme; an edge-bleeding image whose own background doesn't match the
   page's would only look right in one specific theme. */
.landing-page__hero-visual {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);

  picture {
    display: block;
  }

  img {
    display: block;
    width: 100%;
    /* height: auto 不能省：<img> 的 height="664" 屬性會把高度固定成 664px，aspect-ratio 就不生效，手機上整張被拉長再裁掉（2026-10-16 加屬性時量到） */
    height: auto;
    aspect-ratio: 736 / 664;
    object-fit: cover;
  }
}

.landing-page__hero-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.landing-page__eyebrow {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--el-color-primary-light-5);
  color: var(--el-color-primary);
  font-size: 1rem;
  font-weight: 600;
}

/* 手機 30px（28px 低於退休族首頁指引的 36–40px H1）、768px 起放大。width: 100% 不能省：.landing-page__hero-text 是
   align-items: flex-start（讓 eyebrow 與 CTA 維持自然寬度），沒有明確寬度每個 flex 子元素都照自己內容定寬——就是檔頭說修過三次的
   那個 bug。只要跟下面的搜尋框同寬，不用管 hero 外面的核心功能格。 */
.landing-page__title {
  width: 100%;
  font-size: 1.875rem;
  font-weight: 700;
  line-height: 1.4;
  margin: 0;

  @media (min-width: 768px) {
    font-size: 2.375rem;
  }
}

/* 18px，比全站 16px 地板高一階：首頁是最面向退休族的頁面（指引「內文最低 16px，建議 18–19px 起跳」）；次要文字（hero-note、
   eyebrow）刻意留 16px。width: 100% 的理由同 .landing-page__title。40em 上限 2026-09-20 隨全站一起拿掉（見 main.css 的 .hub-answer）。 */
.landing-page__lead {
  width: 100%;
  font-size: 1.125rem;
  line-height: 1.8;
  color: var(--el-text-color-secondary);
  margin: 0;
}

/* Provenance sits ABOVE the disclaimer and reads darker than it: one says where the numbers come
   from（a reason to trust the page）, the other limits what they mean（a caveat）. Giving them the
   same weight would flatten a statement of fact into a second piece of legal hedging. */
.landing-page__hero-source {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-regular);
}

.landing-page__hero-note {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}

.landing-page__section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.landing-page__section-title {
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0;
}

/* 卡片間距 40px 大於卡片內距 20px——2026-09-23 之前是反的（gap 16、padding 20），版面指引點名那是噪音：間距比內距小時只能靠外框
   分隔，頁面看起來比內容更忙。這也是把這頁拉回消費型網站密度（35–50%）最便宜的一步。 */
.landing-page__highlights {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 40px;
}

/* 底部強調線＋hover 上浮：2026-09-05 使用者從四個預覽裡挑的方向，取代圖示放在色塊徽章的做法（前兩輪都「還是複雜了」）。
   --el-bg-color 是本站的「浮起表面」token。2px 不是原本的 3px（「border-bottom 數字變小」），::after 短線的版本已改回全寬。
   hover 時 border-bottom-color 維持實心主色（border-color 簡寫會連它一起變淡）。 */
.landing-page__card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-bottom: 2px solid var(--el-color-primary);
  border-radius: 12px;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.landing-page__card:hover {
  border-color: var(--el-color-primary-light-5);
  border-bottom-color: var(--el-color-primary);
  box-shadow: 0 12px 28px -8px rgba(0, 0, 0, 0.3);
  transform: translateY(-2px);
}

.landing-page__card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.landing-page__card-icon {
  flex-shrink: 0;
  font-size: 1.375rem;
  color: var(--el-color-primary);
}

.landing-page__card-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.landing-page__card-desc {
  margin: 0;
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.landing-page__faqs {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 依類股瀏覽 (2026-09-19) — one lead sentence above the sector chips（main.css's .hub-chip-list）. */
/* The chip list needs room once it is inside a disclosure — .hub-details styles the shell, this
   only pads what unfolds out of it. */
.landing-page__sectors > .hub-chip-list {
  padding: 0 16px 16px;
}

.landing-page__section-lead {
  margin: -8px 0 16px;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.landing-page__inline-link {
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.landing-page__faq-question {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 6px;
}

/* 40em cap removed 2026-09-20 with every other one — see main.css's .hub-answer comment. */
.landing-page__faq-answer {
  margin: 0;
  font-size: 1.125rem;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}
</style>
