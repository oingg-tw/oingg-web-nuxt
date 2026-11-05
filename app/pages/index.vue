<script setup lang="ts">
// 首頁是公開的 SEO 落地頁（從儀表板拆出：即時資料的儀表板沒有可索引的東西，而最高權重的網址卻閒著）。2026-11-02 改版（使用者從兩輪、
// 六個方案裡選了「讓資料自己說話、以月曆為首頁」的 B-3——先做的 B-1 兩週週曆文字折行太亂——再套用使用者給的《網站首頁高質感設計架構論》）。
// 首頁是用來說服第一次來的人，所以沒有登入後的個人化：
//   首屏：H1（定案的 UVP，沒動）＋搜尋（唯一的主要動作）＋資料來源與資料涵蓋（信任條）＋唯一一條免責聲明
//   接下來的除權息與發放（LandingUpcomingDividends）：伺服器輸出的真資料，每天不一樣
//   你想做什麼？：大小不一的便當盒格，每格放真資料（今年每月除權息、篩選範本的符合檔數、排行數、類股數），連結取自 SITE_MAP
//   依類股瀏覽（收合，爬蟲照樣走得到每個類股頁）→ 常見問題（FAQPage 結構化資料）
// 刻意沒有的：精選股與排行清單（跟本站不給精選的規則衝突）、定價、AggregateRating、編出來的數字（YMYL 誤導）。原本的樹插圖
// （public/images/landing-hero-tree.*，使用者提供）這版不用了，檔案留著
import { Calendar, Filter, OfficeBuilding, Reading, Sort, Star } from '@element-plus/icons-vue'
import type { HomePageData, HubSector } from '#shared/types/hub'
import type { SiteMapGroup } from '~/utils/app-features'

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

// The 36 exchange sectors, server-rendered as links so a crawler starting here reaches every
// /industry/… page (and through them every stock page) without JavaScript. Cached 24h on the
// server (/api/hub/sectors); an empty list simply hides the section.
const [{ data: sectors }, { data: home }] = await Promise.all([
  useFetch<HubSector[]>('/api/hub/sectors', { key: 'hub-sectors', default: () => [] }),
  // 每一塊讀不到就是 null，那一塊不畫（server/api/hub/home.get.ts）
  useFetch<HomePageData>('/api/hub/home', { key: 'hub-home' })
])

const coverageItems = computed(() => {
  const coverage = home.value?.coverage
  if (!coverage) return []
  return [
    { label: '普通股', value: coverage.common, unit: '檔' },
    { label: 'ETF', value: coverage.etf, unit: '檔' },
    { label: '特別股', value: coverage.preferred, unit: '檔' },
    { label: '財報指標', value: coverage.metrics, unit: '項' }
  ]
})

// 便當盒格的連結與說明都取自網站導覽（/sitemap 和頁尾用的同一份），不另外寫一份
const linksOf = (key: SiteMapGroup['key']) => SITE_MAP.find(group => group.key === key)?.links ?? []
const dividendLinks = linksOf('dividends')
const findLinks = linksOf('find')
const screenerLinks = findLinks.filter(link => link.to.startsWith('/screener'))
const rankLink = findLinks.find(link => link.to === '/rank')!
const industriesLink = findLinks.find(link => link.to === '/industries')!
const companyCount = computed(() => sectors.value.reduce((sum, sector) => sum + sector.companyCount, 0))

// 今年每個月的除權息：長條的長度＝那個月的檔數 ÷ 最多的那個月。還沒到的月份是去年同月試算（跟除權息月覽同一份）
const yearBars = computed(() => {
  const cells = home.value?.cells ?? []
  const max = Math.max(1, ...cells.map(cell => cell.counts.all))
  const current = home.value?.today.slice(0, 7)
  return cells.map(cell => ({
    month: Number(cell.month.slice(5)),
    count: cell.counts.all,
    share: cell.counts.all / max,
    estimated: cell.estimated,
    current: cell.month === current
  }))
})
const yearCaption = computed(() => {
  const bars = yearBars.value
  if (!bars.length) return ''
  const top = bars.reduce((best, bar) => (bar.count > best.count ? bar : best))
  const estimated = bars.filter(bar => bar.estimated).map(bar => bar.month)
  const topText = `${top.month} 月最多${top.estimated ? '（去年同月）' : ''}，${groupThousands(top.count)} 檔`
  return estimated.length ? `${topText}；${estimated.join('、')} 月還沒到，用去年同月試算。` : `${topText}。`
})

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
    <!-- 首屏：桌機左邊標題、右邊搜尋與信任條，月曆在下面跨兩欄；手機依序是標題、搜尋、月曆，資料來源與免責聲明緊貼在月曆下面 -->
    <section class="landing-page__top">
      <div class="landing-page__intro">
        <span class="landing-page__eyebrow">財報 + 金流分析工具</span>
        <!-- 只在 <wbr> 斷行（keep-all）：手機第二句放不下時斷在「長期｜持有」，不會剩一個「公司」掉到第三行 -->
        <h1 class="landing-page__title">用工具協助<wbr>解讀財報<br>找出值得長期<wbr>持有的好公司</h1>
        <p class="landing-page__lead">
          安盈選股整理公開的財報與交易所資料，陪你看懂每一檔上市櫃公司的數字。
        </p>
      </div>
      <LandingStockSearch class="landing-page__search" />
      <!-- 資料來源寫在頁面上、不只在頁尾（2026-09-23）：對提防金融詐騙的讀者，「你的數字哪裡來」就是信任問題本身。涵蓋的檔數是
           資料算出來的（GET /securities 與指標目錄），不是寫死的數字。免責聲明維持全頁唯一一條——逐句加警語會反效果 -->
      <div class="landing-page__trust">
        <p class="landing-page__hero-source">資料來自臺灣證券交易所、證券櫃檯買賣中心與公開資訊觀測站</p>
        <ul v-if="coverageItems.length" class="landing-page__coverage" aria-label="資料涵蓋">
          <li v-for="item in coverageItems" :key="item.label">{{ item.label }} <b>{{ groupThousands(item.value) }}</b> {{ item.unit }}</li>
        </ul>
        <p class="landing-page__hero-note">
          本站篩選結果與財報說明僅供投資輔助參考，不構成買賣建議或獲利保證。
        </p>
      </div>
      <LandingUpcomingDividends v-if="home?.upcoming" :ex="home.upcoming.ex" :pay="home.upcoming.pay" :today="home.today" class="landing-page__calendar" />
    </section>

    <section class="landing-page__section" aria-labelledby="landing-tasks-heading">
      <h2 id="landing-tasks-heading" class="landing-page__section-title">你想做什麼？</h2>
      <div class="landing-bento">
        <div class="app-card landing-bento__tile landing-bento__tile--year">
          <h3 class="landing-bento__title"><el-icon aria-hidden="true"><Calendar /></el-icon>我想知道什麼時候配息</h3>
          <template v-if="yearBars.length">
            <p class="landing-bento__text">今年每個月的除權息檔數。{{ yearCaption }}</p>
            <ol class="landing-year" aria-label="今年每個月的除權息檔數">
              <li
                v-for="bar in yearBars"
                :key="bar.month"
                class="landing-year__bar"
                :class="{ 'landing-year__bar--estimated': bar.estimated, 'landing-year__bar--current': bar.current }"
                :style="{ '--share': bar.share }"
              >
                <span class="landing-year__label">{{ bar.month }}<span class="landing-year__unit"> 月</span></span>
                <span class="landing-year__fill" aria-hidden="true" />
                <span class="landing-year__count">{{ groupThousands(bar.count) }}<span class="visually-hidden"> 檔{{ bar.estimated ? '，去年同月試算' : '' }}{{ bar.current ? '，本月' : '' }}</span></span>
              </li>
            </ol>
          </template>
          <p class="landing-bento__links">
            <NuxtLink v-for="link in dividendLinks" :key="link.to" :to="link.to">{{ link.label }} ›</NuxtLink>
          </p>
        </div>

        <div class="app-card landing-bento__tile landing-bento__tile--wide">
          <h3 class="landing-bento__title"><el-icon aria-hidden="true"><Filter /></el-icon>我想找符合條件的股票</h3>
          <!-- 範本只給符合的檔數、不列名單（名單讀起來就是推薦），跟 /screener/common/{slug} 條件頁同一個規則 -->
          <ul v-if="home?.templates?.length" class="landing-bento__templates">
            <li v-for="template in home.templates" :key="template.slug">
              <NuxtLink :to="screenerTemplatePath(template.slug)" class="landing-bento__template">
                <span class="landing-bento__template-text"><b>{{ template.name }}</b><span>{{ template.rule }}</span></span>
                <span v-if="template.count !== null" class="landing-bento__template-count">{{ groupThousands(template.count) }}<span> 檔</span></span>
              </NuxtLink>
            </li>
          </ul>
          <p class="landing-bento__links">
            <NuxtLink v-for="link in screenerLinks" :key="link.to" :to="link.to">{{ link.label }} ›</NuxtLink>
          </p>
        </div>

        <NuxtLink :to="rankLink.to" class="app-card landing-bento__tile landing-bento__stat">
          <el-icon class="landing-bento__icon" aria-hidden="true"><Sort /></el-icon>
          <span class="landing-bento__stat-title">{{ rankLink.label }}</span>
          <span class="landing-bento__stat-value">{{ RANK_PAGES.length }}<span> 種</span></span>
          <span class="landing-bento__text">{{ rankLink.description }}</span>
        </NuxtLink>
        <NuxtLink :to="industriesLink.to" class="app-card landing-bento__tile landing-bento__stat">
          <el-icon class="landing-bento__icon" aria-hidden="true"><OfficeBuilding /></el-icon>
          <span class="landing-bento__stat-title">{{ industriesLink.label }}</span>
          <span v-if="sectors.length" class="landing-bento__stat-value">{{ sectors.length }}<span> 個類股</span></span>
          <span class="landing-bento__text"><template v-if="companyCount">{{ groupThousands(companyCount) }} 家公司。</template>{{ industriesLink.description }}</span>
        </NuxtLink>

        <div class="app-card landing-bento__tile landing-bento__tile--wide">
          <h3 class="landing-bento__title"><el-icon aria-hidden="true"><Star /></el-icon>我想記下自己的股票<span class="landing-bento__note">需登入</span></h3>
          <ul class="landing-bento__subs">
            <li v-for="link in linksOf('mine')" :key="link.to">
              <NuxtLink :to="link.to" class="app-card landing-bento__sub"><b>{{ link.label }} ›</b><span>{{ link.description }}</span></NuxtLink>
            </li>
          </ul>
        </div>
        <div class="app-card landing-bento__tile landing-bento__tile--wide">
          <h3 class="landing-bento__title"><el-icon aria-hidden="true"><Reading /></el-icon>我想學會看這些數字</h3>
          <ul class="landing-bento__subs">
            <li v-for="link in linksOf('learn')" :key="link.to">
              <NuxtLink :to="link.to" class="app-card landing-bento__sub"><b>{{ link.label }} ›</b><span>{{ link.description }}</span></NuxtLink>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- 收合（2026-09-23「首頁資訊太多很雜亂」）：這一塊跟 /industries 幾乎重複，留著是讓爬蟲從首頁到得了每個類股頁。收進原生
         <details>：開合都在 SSR HTML 裡，check-hub-pages 的 industryLinksMin: 30 照過、個股頁維持點擊深度 2 -->
    <section v-if="sectors.length" class="landing-page__section" aria-labelledby="landing-sectors-heading">
      <h2 id="landing-sectors-heading" class="landing-page__section-title">依類股瀏覽上市櫃公司</h2>
      <p class="landing-page__section-lead">
        證交所每個類股各有一頁，列出該類股每家公司的股價、本益比、殖利率與 ROE。
        <NuxtLink to="/industries" class="landing-page__inline-link">看產業索引</NuxtLink>
      </p>
      <details class="app-card hub-details landing-page__sectors">
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
/* 背景純色（2026-10-21，使用者：「背景不要 再有 樣式 改成純色就好」）。間距與中文排版照《網站首頁高質感設計架構論》（2026-11-02）：
   區塊之間 96px（手機 64px），內文行高 1.7、字距 0.02em，標題行高 1.35、字距 0.04em */
.landing-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 96px;
  padding: 24px 0 32px;
  line-height: 1.7;
  letter-spacing: 0.02em;

  @media (max-width: 767px) {
    gap: 64px;
    padding-top: 8px;
    letter-spacing: 0.01em;
  }
}

/* Grid 不用 flex：單欄版「子元素照自己內容定寬」的 bug 修過三次（f21baf2／4e60a40／b2720c3），Grid 項目預設 stretch。
   960px 以下單欄，資料來源與免責聲明排到月曆下面，緊貼資料 */
.landing-page__top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 480px);
  grid-template-areas:
    'intro search'
    'intro trust'
    'calendar calendar';
  align-items: end;
  gap: 16px 48px;

  @media (max-width: 959px) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'intro' 'search' 'calendar' 'trust';
    gap: 24px;
  }
}

.landing-page__intro {
  grid-area: intro;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.landing-page__search {
  grid-area: search;
}

.landing-page__trust {
  grid-area: trust;
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.landing-page__calendar {
  grid-area: calendar;
  margin-top: 32px;

  @media (max-width: 959px) {
    margin-top: 16px;
  }
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

  /* 手機讓月曆早一點出現 */
  @media (max-width: 767px) {
    display: none;
  }
}

/* 手機 30px、768px 起 38px（退休族首頁指引的 36–40px）。width: 100% 理由見 .landing-page__intro 的 align-items */
.landing-page__title {
  width: 100%;
  font-size: 1.875rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.04em;
  word-break: keep-all;
  /* 字放大（外觀設定）連一段都放不下時，照樣斷行，不撐出橫向捲動 */
  overflow-wrap: anywhere;
  margin: 0;

  @media (min-width: 768px) {
    font-size: 2.375rem;
  }
}

/* 18px，比全站 16px 地板高一階：首頁是最面向退休族的頁面 */
.landing-page__lead {
  width: 100%;
  max-width: 30em;
  font-size: 1.125rem;
  line-height: 1.8;
  color: var(--el-text-color-secondary);
  margin: 0;
}

/* Provenance reads darker than the disclaimer: one says where the numbers come from（a reason to trust
   the page）, the other limits what they mean（a caveat）. */
.landing-page__hero-source {
  margin: 0;
  color: var(--el-text-color-regular);
}

/* 信任條：灰階、單色，只有數字用正文色。兩欄兩列：一列放不下四項，換行時分隔線會掉到下一行開頭 */
.landing-page__coverage {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: 4px 24px;
  color: var(--el-text-color-regular);

  b {
    color: var(--el-text-color-primary);
    font-variant-numeric: tabular-nums;
  }
}

.landing-page__hero-note {
  margin: 0;
  color: var(--el-text-color-placeholder);
}

.landing-page__section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.landing-page__section-title {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.04em;
  margin: 0;
}

/* 便當盒格：桌機四欄（配息那格佔兩欄兩列），960px 以下兩欄 */
.landing-bento {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px;

  @media (max-width: 959px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
}

.landing-bento__tile {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;

  @media (max-width: 767px) {
    padding: 16px;
  }
}

.landing-bento__tile--year {
  grid-column: span 2;
  grid-row: span 2;

  @media (max-width: 959px) {
    grid-row: auto;
  }
}

.landing-bento__tile--wide {
  grid-column: span 2;
}

.landing-bento__title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.04em;

  .el-icon {
    font-size: 1.5rem;
    color: var(--el-color-primary);
  }
}

.landing-bento__note {
  margin-left: auto;
  font-size: 1rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: var(--el-text-color-secondary);
}

.landing-bento__text {
  margin: 0;
  color: var(--el-text-color-regular);
}

.landing-bento__links {
  margin: auto 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0 24px;

  a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    font-weight: 700;
    color: var(--el-color-primary-dark-2);
    text-underline-offset: 3px;
  }
}

/* 今年每個月的除權息：桌機直條（檔數在上、月份在下），手機橫條（月份、長條、檔數一列）。桌機的格子被旁邊兩格撐高，長條跟著
   填滿：每一欄拉滿整格高，長條佔「欄高扣掉檔數與月份兩行」的 share */
.landing-year {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-template-rows: minmax(240px, 1fr);
  gap: 8px;
}

.landing-year__bar {
  display: flex;
  flex-direction: column-reverse;
  justify-content: flex-start;
  align-items: center;
  gap: 4px;
  min-height: 0;
}

.landing-year__label {
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

/* 桌機一格約 30px，「12 月」放不下，只寫數字；「月」留給螢幕閱讀器與手機 */
.landing-year__unit {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.landing-year__bar--current .landing-year__label {
  color: var(--el-text-color-primary);
  font-weight: 700;
}

.landing-year__fill {
  width: 100%;
  max-width: 40px;
  flex: 0 0 calc(var(--share) * (100% - 64px));
  min-height: 3px;
  border-radius: 4px 4px 0 0;
  background: var(--el-color-primary);
}

/* 去年同月試算的月份：虛線框，跟除權息月覽的「估」同一個意思 */
.landing-year__bar--estimated .landing-year__fill {
  background: var(--el-color-primary-light-9);
  outline: 1.5px dashed var(--el-color-primary);
  outline-offset: -1.5px;
}

.landing-year__count {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}

.landing-bento__templates {
  list-style: none;
  margin: 0;
  padding: 0;
}

.landing-bento__template {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 64px;
  border-top: 1px solid var(--app-divider);
  color: inherit;
  text-decoration: none;

  &:hover b {
    color: var(--el-color-primary-dark-2);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

.landing-bento__template-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.5;

  > span {
    color: var(--el-text-color-secondary);
  }
}

.landing-bento__template-count {
  font-size: 1.375rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  color: var(--el-color-primary-dark-2);
  white-space: nowrap;

  > span {
    font-size: 1rem;
  }
}

.landing-bento__stat {
  color: inherit;
  text-decoration: none;
  gap: 8px;
  transition: border-color 160ms cubic-bezier(0.23, 1, 0.32, 1);

  &:hover {
    border-color: var(--el-color-primary-light-5);
  }
}

.landing-bento__icon {
  font-size: 1.5rem;
  color: var(--el-color-primary);
}

.landing-bento__stat-title {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.landing-bento__stat-value {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;

  > span {
    font-size: 1.125rem;
    font-weight: 600;
  }
}

.landing-bento__subs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;

  /* 手機一欄：說明是網站導覽的原文，兩欄會擠成四、五行 */
  @media (max-width: 767px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
}

.landing-bento__sub {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 88px;
  padding: 16px;
  color: inherit;
  text-decoration: none;
  line-height: 1.5;
  transition: border-color 160ms cubic-bezier(0.23, 1, 0.32, 1);

  b {
    font-size: 1.125rem;
    color: var(--el-color-primary-dark-2);
  }

  span {
    color: var(--el-text-color-secondary);
  }

  &:hover {
    border-color: var(--el-color-primary-light-5);
  }

  @media (max-width: 767px) {
    min-height: 64px;
    padding: 8px 12px;
  }
}

/* The chip list needs room once it is inside a disclosure — .hub-details styles the shell, this
   only pads what unfolds out of it. */
.landing-page__sectors > .hub-chip-list {
  padding: 0 16px 16px;
}

.landing-page__section-lead {
  margin: -8px 0 0;
  max-width: 40em;
  color: var(--el-text-color-regular);
}

.landing-page__inline-link {
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
  text-underline-offset: 3px;
  white-space: nowrap;
}

/* 兩欄：每行約 28 字，在文件建議的 30–40 字以內 */
.landing-page__faqs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 40px 48px;

  @media (max-width: 767px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
}

.landing-page__faq-question {
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.5;
  margin: 0 0 8px;
}

.landing-page__faq-answer {
  margin: 0;
  font-size: 1.125rem;
  line-height: 1.8;
  color: var(--el-text-color-secondary);
}

@media (max-width: 767px) {
  /* stretch：直排的 flex 預設是撐滿，不寫的話每一列會縮成內容寬 */
  .landing-year {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }

  .landing-year__bar {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) 56px;
    align-items: center;
    gap: 8px;
  }

  .landing-year__unit {
    position: static;
    width: auto;
    height: auto;
    overflow: visible;
    clip: auto;
  }

  .landing-year__fill {
    width: calc(var(--share) * 100%);
    max-width: none;
    min-width: 2px;
    height: 16px;
    min-height: 0;
    border-radius: 0 4px 4px 0;
  }

  .landing-year__count {
    text-align: right;
  }
}
</style>
