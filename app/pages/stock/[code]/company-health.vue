<script setup lang="ts">
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import type { FilterSchema } from '~/composables/screener/useFilterSchema'
import { GURU_CATEGORY_ICON } from '~/utils/guru-badges'
import type { SeriesTableColumn } from '~/utils/stock-series-table'
import { catalogColumn } from '~/utils/stock-series-table'
import { factTexts, joinClauses, joinSentences } from '~/utils/stock-answers'

// 公司健檢 — real route 2026-09-18, split out of stock/[code]/index.vue's own 卡片模式 per direct
// request ("summary 上面的 卡片 表格 會計 顯示設定 都拔掉。所有卡片一律呈現。卡片 表格 會計 做在
// sidebar上面。財務報表 (會計) 指標歷史 (表格) 公司健檢 (卡片)") — this is that 卡片模式's new home.
// The 8-category anchor-nav system itself (nav, scroll-spy, SECTION_ORDER, all 8 card sections) had
// briefly lived on financial-statements.vue (see that file's own git history, 2026-09-17 commit) —
// moved here instead the very next day once it became clear 卡片模式's own content and 會計模式's
// own content (StockPeriodSelector/StockFinancialStatementsCard) needed to be two separate pages,
// not one.
//
// Rebuilt as a document on 2026-09-19 (the SEO build), on the user's own diagnosis of the
// card-per-metric grid（「我本以為用卡片呈現不同指標是好做法，但現在看卻覺得畫面髒亂」）: each of the
// 8 sections is now a question-form <h2>, a short number-led answer, ONE 20-quarter table of the
// section's metrics（server-rendered from /api/stock/:code/series?page=company-health）, one
// featured chart, and a closed「更多圖表」<details> holding the section's other charts — which
// mount only when opened, so a fresh load runs 8 chart instances instead of 24. The section ids
// (`stock-section-{類別}`) are anchor targets frozen since 2026-09-19 and stay exactly as they were;
// only the heading TEXT is a question now — the nav pills keep the short category nouns.
//
// SSR'd in full since 2026-09-19 (the stock-detail a11y/SEO redesign): the section nav and all 8
// sections used to sit behind `v-if="hasHydrated && preferencesReady"`, so the server-rendered
// HTML for this page contained the summary card and nothing else. Every card's own data composable
// is client-only on a cache miss (see useStockBadges.ts's own guard); the series pre-warm in
// useStockPageDigest renders the featured charts in SSR too where their request is a subset of
// one of this page's groups.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
// Real bug found live 2026-09-10 (see stock/[code]/index.vue's own git history for the full
// original account): a child card's own `formulaLatex` lookup (via useFilterSchema()) got stuck
// permanently serving the offline mock schema when several sibling cards all called
// useAsyncData('filter-schema', ...) simultaneously on mount — awaiting it once here, before any of
// those children mount, resolves the real schema into the shared cache first.
await useFilterSchema()
const { data: filterSchema } = useNuxtData<FilterSchema>('filter-schema')

// Real numbers into the SSR HTML — the section answers, the 8 tables, the「資料摘要與來源」section
// at the bottom and the meta description (see useStockPageDigest.ts).
const { digest, description, series } = await useStockPageDigest(code, 'company-health', { shortName: stockShortName })
const groups = computed(() => series.value?.groups ?? {})

// 錨點導覽的順序，跟原本 el-tab-pane 的手動排序完全一致（同一份「市場評價優先」手動順序）。
const SECTION_ORDER = ['市場評價', '股東回饋', '獲利品質', '獲利能力', '成長動能', '財務韌性', '營運周轉', '大戶籌碼'] as const
type SectionCategory = (typeof SECTION_ORDER)[number]

// Per section: the question the heading asks, the digest facts quoted in its answer, and the
// table's columns（code, series group, timeframe）. Codes come from the page's series plan
// (server/utils/stock-data.ts) — the same catalog names the digest and the cards use.
interface SectionSpec {
  question: (name: string) => string
  answerCodes: string[]
  columns: [string, string, MetricsHistoryTimeframe][]
}

const SECTION_SPECS: Record<SectionCategory, SectionSpec> = {
  市場評價: {
    question: name => `${name}的市場評價：本益比、淨值比多少？`,
    answerCodes: ['bvps'],
    columns: [['peRatio', 'TTM_A_20', 'TTM'], ['pbRatio', 'Q_A_20', 'Q'], ['bvps', 'Q_B_20', 'Q'], ['stockPrice', 'Q_B_20', 'Q']]
  },
  股東回饋: {
    question: name => `${name}的股東回饋：配息與買回多少？`,
    answerCodes: ['dividendPerShare', 'dividendPayoutRatio', 'dividendCoverageRatio', 'shareholderYield', 'buybackYield', 'consecutiveDividendYears', 'dividendGrowthRate5y', 'chowderNumber'],
    columns: [['dividendPerShare', 'TTM_A_20', 'TTM'], ['dividendCoverageRatio', 'TTM_A_20', 'TTM'], ['buybackYield', 'TTM_A_20', 'TTM'], ['shareholderYield', 'TTM_A_20', 'TTM']]
  },
  獲利品質: {
    question: name => `${name}的獲利品質：現金流有沒有跟上獲利？`,
    answerCodes: ['piotroskiFScore', 'accrualsRatio', 'ocfToNetIncome', 'consecutiveProfitYears', 'ocfPerShare', 'fcfPerShare'],
    columns: [['piotroskiFScore', 'Q_B_20', 'Q'], ['accrualsRatio', 'Q_B_20', 'Q'], ['ocfToNetIncome', 'Q_B_20', 'Q'], ['ocfPerShare', 'TTM_A_20', 'TTM'], ['fcfPerShare', 'TTM_A_20', 'TTM']]
  },
  獲利能力: {
    question: name => `${name}的獲利能力：ROE、毛利率多少？`,
    answerCodes: ['eps', 'roe', 'roa', 'grossMargin', 'operatingMargin', 'netProfitMargin'],
    columns: [['eps', 'Q_A_20', 'Q'], ['roe', 'Q_A_20', 'Q'], ['roa', 'Q_A_20', 'Q'], ['grossMargin', 'Q_A_20', 'Q'], ['operatingMargin', 'Q_A_20', 'Q'], ['netProfitMargin', 'Q_A_20', 'Q']]
  },
  成長動能: {
    question: name => `${name}的成長動能：營收與 EPS 成長多少？`,
    answerCodes: ['revenueGrowthRate', 'epsGrowthRate', 'netIncomeGrowthRate', 'sue', 'epsCagr5y', 'revenueCagr5y'],
    columns: [['revenueGrowthRate', 'Q_A_20', 'Q'], ['epsGrowthRate', 'Q_A_20', 'Q'], ['netIncomeGrowthRate', 'Q_A_20', 'Q'], ['sue', 'Q_C_20', 'Q']]
  },
  財務韌性: {
    question: name => `${name}的財務韌性：負債比與流動比多少？`,
    answerCodes: ['debtRatio', 'currentRatio', 'quickRatio', 'cashRatio', 'interestCoverage', 'altmanZScore', 'netDebtToEbitda'],
    columns: [['debtRatio', 'Q_B_20', 'Q'], ['currentRatio', 'Q_B_20', 'Q'], ['quickRatio', 'Q_B_20', 'Q'], ['cashRatio', 'Q_B_20', 'Q'], ['interestCoverage', 'Q_B_20', 'Q'], ['altmanZScore', 'TTM_A_20', 'TTM'], ['netDebtToEbitda', 'TTM_A_20', 'TTM']]
  },
  營運周轉: {
    question: name => `${name}的營運周轉：週轉率與資本支出多少？`,
    answerCodes: ['inventoryTurnover', 'receivablesTurnover', 'payablesTurnover', 'cashConversionCycle', 'capexToRevenue'],
    columns: [['inventoryTurnover', 'Q_C_20', 'Q'], ['receivablesTurnover', 'Q_C_20', 'Q'], ['payablesTurnover', 'Q_C_20', 'Q'], ['capexToRevenue', 'Q_C_20', 'Q'], ['cashConversionCycle', 'TTM_A_20', 'TTM']]
  },
  大戶籌碼: {
    question: name => `${name}的大戶籌碼：外資持股多少？`,
    answerCodes: [],
    columns: []
  }
}

const sectionQuestions = computed<Record<SectionCategory, string>>(() => {
  const name = stockShortName.value
  return Object.fromEntries(SECTION_ORDER.map(category => [category, SECTION_SPECS[category].question(name)])) as Record<SectionCategory, string>
})

// 市場評價 quotes the daily quote and the PE/PB percentile sentences the digest already computes;
// every other section is its digest facts（「近四季 ROE 34.78%」…）joined into one sentence.
const sectionAnswers = computed<Record<SectionCategory, string | null>>(() => {
  const build = (category: SectionCategory): string | null => {
    const spec = SECTION_SPECS[category]
    if (category === '市場評價') {
      const price = summary.value?.price
      const valuation = summary.value?.valuation
      return joinSentences([
        joinClauses(digest.value?.percentiles.map(item => item.text) ?? []),
        joinClauses([
          price ? `${price.tradeDate} 收盤 ${price.close.toFixed(2)} 元` : null,
          valuation?.dividendYield !== null && valuation?.dividendYield !== undefined ? `殖利率 ${valuation.dividendYield.toFixed(2)}%` : null,
          ...factTexts(digest.value, spec.answerCodes)
        ])
      ])
    }
    return joinClauses(factTexts(digest.value, spec.answerCodes))
  }
  return Object.fromEntries(SECTION_ORDER.map(category => [category, build(category)])) as Record<SectionCategory, string | null>
})

const sectionColumns = computed<Record<SectionCategory, SeriesTableColumn[]>>(() => {
  const categories = filterSchema.value?.categories ?? []
  return Object.fromEntries(
    SECTION_ORDER.map(category => [category, SECTION_SPECS[category].columns.map(([metricCode, group, timeframe]) => catalogColumn(categories, metricCode, group, timeframe))])
  ) as Record<SectionCategory, SeriesTableColumn[]>
})

// The「更多圖表」<details> per section: charts inside mount only once it has been opened（v-if on
// the toggle state）, so the closed default costs nothing and the SSR/hydration DOM agree.
const moreOpen = reactive<Record<string, boolean>>({})
function toggleMore(category: SectionCategory, event: Event) {
  moreOpen[category] = (event.target as HTMLDetailsElement).open
}

// Which section the scroll-spy currently considers "in view" — purely a highlight for the nav,
// never written to the URL. It used to be mirrored into `?tab=` via router.replace on every
// scroll (2026-09-16 anchor-nav version; see git history), which violated this app's own rule
// that view state never enters the URL — every visit gained a `?tab=市場評價` the instant the
// scroll-spy fired on mount, canonicalized away only by the bare-path canonical. Section identity
// is now addressable the way anchors are meant to be: `#stock-section-…` fragments, which the
// nav links below produce natively and search engines ignore.
const activeCategory = ref<string>(SECTION_ORDER[0])

// Per direct follow-up ("分頁要有 Icon") — same icon assignments MoleculeIndicatorPickerBody.vue
// already uses for the 6 shared financial-analysis dimensions in the screener's own category
// picker. Moved into guru-badges.ts's own GURU_CATEGORY_ICON (see that file's own comment) once
// guru-indicators.vue's nav row also needed this exact same mapping. Decorative (aria-hidden)
// everywhere they render here — the Chinese label right next to each one is the real name.
const TAB_ICONS = GURU_CATEGORY_ICON

// Section ids are the anchor targets the nav links point at AND what external links may deep-link
// to (`/stock/2330/company-health#stock-section-財務韌性`) — frozen once live, never renamed.
function sectionElementId(category: string): string {
  return `stock-section-${category}`
}

function sectionHeadingId(category: string): string {
  return `stock-section-${category}-heading`
}

const navEl = ref<HTMLElement | null>(null)

const sectionEls = new Map<string, HTMLElement>()
function registerSectionEl(category: string) {
  return (el: unknown) => {
    if (el instanceof HTMLElement) sectionEls.set(category, el)
    else sectionEls.delete(category)
  }
}

let scrollSpyTicking = false
function updateActiveSectionFromScroll() {
  const threshold = (navEl.value?.getBoundingClientRect().bottom ?? 0) + 8
  let current: string | null = null
  let bestDistance = Infinity
  for (const category of SECTION_ORDER) {
    const el = sectionEls.get(category)
    if (!el) continue
    const distance = Math.abs(el.getBoundingClientRect().top - threshold)
    if (distance < bestDistance) {
      bestDistance = distance
      current = category
    }
  }
  if (current) activeCategory.value = current
}

function onScrollSpyTick() {
  if (scrollSpyTicking) return
  scrollSpyTicking = true
  requestAnimationFrame(() => {
    updateActiveSectionFromScroll()
    scrollSpyTicking = false
  })
}

// The nav links are real `<a href="#…">` anchors — the browser's own fragment jump (honoring each
// section's scroll-margin-top and main.css's reduced-motion-aware smooth scrolling) does the
// scrolling, no JS scrollIntoView interception. The scroll-spy only follows along to move the
// highlight, including right after a hash-deep-link load.
onMounted(() => {
  window.addEventListener('scroll', onScrollSpyTick, { passive: true })
  updateActiveSectionFromScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScrollSpyTick)
})

// title/description/og/robots/canonical/BreadcrumbList (2026-09-19) — see useStockPageSeo.ts.
const sectorCode = computed(() => profile.value?.industry ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: '公司健檢', titleKeywords: '公司健檢：獲利、成長與財務韌性', pathSuffix: '/company-health', stock, summary, description, sectorCode })
</script>

<template>
  <div v-loading="stockPending" class="stock-company-health-page">
    <template v-if="stockPending" />
    <el-result
      v-else-if="!stock"
      icon="warning"
      sub-title="請確認股票代號是否正確"
    >
      <template #title>
        <h1 class="stock-not-found__title">找不到這檔股票</h1>
      </template>
      <template #extra>
        <el-button type="primary" @click="router.push('/')">回首頁</el-button>
      </template>
    </el-result>

    <template v-else>
      <!-- Page subject lives in the summary card's single <h1> (「台積電 2330 公司健檢」) since
           2026-09-19 — see StockSummaryCard.vue's own heading comment. -->
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" topic="公司健檢" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <!-- UX 大改 2026-09-16 — 原本 el-tabs「切換顯示」的分頁列，換成一個純錨點導覽的 nav；下面 8 個
           section 全部同時渲染，不再靠 v-if 切換誰顯示誰隱藏。2026-09-19 起這些是真正的
           <a href="#…"> 錨點連結（不再是攔截捲動的 <button>）：爬蟲跟鍵盤使用者都能追蹤，
           aria-current="location" 標出目前捲到的 section。第三個 <nav>（另兩個是「個股頁面」跟
           「麵包屑」），所以 aria-label 必須彼此不同。 -->
      <nav ref="navEl" class="stock-detail-page__section-nav" aria-label="公司健檢分類">
        <a
          v-for="category in SECTION_ORDER"
          :key="category"
          :href="`#${sectionElementId(category)}`"
          class="stock-detail-page__section-nav-item"
          :class="{ 'is-active': activeCategory === category }"
          :aria-current="activeCategory === category ? 'location' : undefined"
        >
          <el-icon aria-hidden="true"><component :is="TAB_ICONS[category]" /></el-icon>
          <span>{{ category }}</span>
        </a>
      </nav>

      <!-- Section order here is a hardcoded, manually-maintained sequence (SECTION_ORDER in this
           file's own script) — NOT derived from STOCK_CARD_CATEGORIES/FINANCIAL_ANALYSIS_
           DIMENSIONS at runtime (see the 2026-09-10 "two independently-ordered lists" bug in this
           file's own history). tabindex="-1" on every section so a fragment jump (nav link, deep
           link) reliably moves keyboard/screen-reader focus INTO the section, not just the viewport.
           Every section: question <h2> → answer → table → featured chart → 更多圖表. -->
      <section
        :id="sectionElementId('市場評價')"
        :ref="registerSectionEl('市場評價')"
        class="stock-detail-page__section"
        tabindex="-1"
        :aria-labelledby="sectionHeadingId('市場評價')"
      >
        <h2 :id="sectionHeadingId('市場評價')" class="stock-detail-page__section-title">
          <el-icon aria-hidden="true"><component :is="TAB_ICONS['市場評價']" /></el-icon>
          <span>{{ sectionQuestions['市場評價'] }}</span>
        </h2>
        <p v-if="sectionAnswers['市場評價']" class="stock-answer">{{ sectionAnswers['市場評價'] }}</p>
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 市場評價指標`" :columns="sectionColumns['市場評價']" :groups="groups" />
        <!-- 本益比河流圖 stays visible as the section's one chart（色帶＝EPS×本益比倍數，線為股價）;
             淨值比／股價與月營收／營收與股價反應／大盤連動程度 are one click away below. -->
        <div class="stock-detail-page__featured">
          <StockValuationRiverChart
            :symbol="stock.code"
            kind="pe"
            title="本益比"
            info-text="色帶＝EPS×本益比倍數，線為股價"
          />
        </div>
        <details class="stock-more-charts" @toggle="toggleMore('市場評價', $event)">
          <summary class="stock-more-charts__summary">更多圖表（4）：淨值比、股價與月營收、營收與股價反應、大盤連動程度</summary>
          <div v-if="moreOpen['市場評價']" class="stock-detail-page__grid">
            <StockValuationRiverChart
              :symbol="stock.code"
              kind="pb"
              title="淨值比"
              info-text="色帶＝每股淨值×淨值比倍數，線為股價"
            />
            <StockPriceRevenueChart :symbol="stock.code" />
            <StockRevenuePriceReactionCard :symbol="stock.code" />
            <StockBetaComparisonChart :symbol="stock.code" :name="stockShortName" />
          </div>
        </details>
      </section>

      <section
        :id="sectionElementId('股東回饋')"
        :ref="registerSectionEl('股東回饋')"
        class="stock-detail-page__section"
        tabindex="-1"
        :aria-labelledby="sectionHeadingId('股東回饋')"
      >
        <h2 :id="sectionHeadingId('股東回饋')" class="stock-detail-page__section-title">
          <el-icon aria-hidden="true"><component :is="TAB_ICONS['股東回饋']" /></el-icon>
          <span>{{ sectionQuestions['股東回饋'] }}</span>
        </h2>
        <p v-if="sectionAnswers['股東回饋']" class="stock-answer">{{ sectionAnswers['股東回饋'] }}</p>
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 股東回饋指標`" :columns="sectionColumns['股東回饋']" :groups="groups" />
        <!-- 配息穩定度／下次除權息 live on dividend.vue（2026-09-15）; the dividend page is the
             document for those, this section is the metric series. -->
        <div class="stock-detail-page__featured">
          <StockDividendCoverageChart :symbol="stock.code" />
        </div>
        <details class="stock-more-charts" @toggle="toggleMore('股東回饋', $event)">
          <summary class="stock-more-charts__summary">更多圖表（2）：現金流量股利成長率、Chowder Number</summary>
          <div v-if="moreOpen['股東回饋']" class="stock-detail-page__grid">
            <StockDividendGrowthRateCard :symbol="stock.code" />
            <StockChowderNumberChart :symbol="stock.code" />
          </div>
        </details>
        <p class="stock-page-section__link">
          <NuxtLink :to="`/stock/${code}/dividend`">看 {{ stockShortName }} {{ code }} 的配股配息與歷年股利</NuxtLink>
        </p>
      </section>

      <section
        :id="sectionElementId('獲利品質')"
        :ref="registerSectionEl('獲利品質')"
        class="stock-detail-page__section"
        tabindex="-1"
        :aria-labelledby="sectionHeadingId('獲利品質')"
      >
        <h2 :id="sectionHeadingId('獲利品質')" class="stock-detail-page__section-title">
          <el-icon aria-hidden="true"><component :is="TAB_ICONS['獲利品質']" /></el-icon>
          <span>{{ sectionQuestions['獲利品質'] }}</span>
        </h2>
        <p v-if="sectionAnswers['獲利品質']" class="stock-answer">{{ sectionAnswers['獲利品質'] }}</p>
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 獲利品質指標`" :columns="sectionColumns['獲利品質']" :groups="groups" />
        <div class="stock-detail-page__featured">
          <StockCashEarningsChart :symbol="stock.code" />
        </div>
        <details class="stock-more-charts" @toggle="toggleMore('獲利品質', $event)">
          <summary class="stock-more-charts__summary">更多圖表（2）：杜邦因子、應計項目品質</summary>
          <div v-if="moreOpen['獲利品質']" class="stock-detail-page__grid">
            <StockDupontFactorLevelChart :symbol="stock.code" />
            <StockAccrualsQualityChart :symbol="stock.code" />
          </div>
        </details>
        <!-- Contextual link to the per-stock methodology page template (2026-09-19) — the 9
             Piotroski signals behind this section's F-Score. -->
        <p class="stock-page-section__link">
          <NuxtLink :to="`/stock/${code}/f-score`">看 Piotroski F-Score 的 9 項訊號逐項結果</NuxtLink>
        </p>
      </section>

      <section
        :id="sectionElementId('獲利能力')"
        :ref="registerSectionEl('獲利能力')"
        class="stock-detail-page__section"
        tabindex="-1"
        :aria-labelledby="sectionHeadingId('獲利能力')"
      >
        <h2 :id="sectionHeadingId('獲利能力')" class="stock-detail-page__section-title">
          <el-icon aria-hidden="true"><component :is="TAB_ICONS['獲利能力']" /></el-icon>
          <span>{{ sectionQuestions['獲利能力'] }}</span>
        </h2>
        <p v-if="sectionAnswers['獲利能力']" class="stock-answer">{{ sectionAnswers['獲利能力'] }}</p>
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 獲利能力指標`" :columns="sectionColumns['獲利能力']" :groups="groups" />
        <div class="stock-detail-page__featured">
          <StockMarginsChart :symbol="stock.code" />
        </div>
        <details class="stock-more-charts" @toggle="toggleMore('獲利能力', $event)">
          <summary class="stock-more-charts__summary">更多圖表（4）：EPS、ROE、ROA、Fama-French 營業獲利能力</summary>
          <div v-if="moreOpen['獲利能力']" class="stock-detail-page__grid">
            <StockMetricHistoryChart
              :symbol="stock.code"
              metric-code="eps"
              title="EPS"
              chart-type="bar"
              unit="元"
              info-text="每股盈餘（單季或近四季合計）"
              source-label="公開發行公司財務報表"
            />
            <StockMetricHistoryChart
              :symbol="stock.code"
              metric-code="roe"
              title="ROE"
              chart-type="line"
              unit="%"
              info-text="股東權益報酬率＝稅後淨利÷股東權益"
              source-label="公開發行公司財務報表"
            />
            <StockMetricHistoryChart
              :symbol="stock.code"
              metric-code="roa"
              title="ROA"
              chart-type="line"
              unit="%"
              info-text="資產報酬率＝稅後淨利÷總資產"
              source-label="公開發行公司財務報表"
            />
            <StockFamaFrenchProfitabilityChart :symbol="stock.code" />
          </div>
        </details>
      </section>

      <section
        :id="sectionElementId('成長動能')"
        :ref="registerSectionEl('成長動能')"
        class="stock-detail-page__section"
        tabindex="-1"
        :aria-labelledby="sectionHeadingId('成長動能')"
      >
        <h2 :id="sectionHeadingId('成長動能')" class="stock-detail-page__section-title">
          <el-icon aria-hidden="true"><component :is="TAB_ICONS['成長動能']" /></el-icon>
          <span>{{ sectionQuestions['成長動能'] }}</span>
        </h2>
        <p v-if="sectionAnswers['成長動能']" class="stock-answer">{{ sectionAnswers['成長動能'] }}</p>
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 成長動能指標`" :columns="sectionColumns['成長動能']" :groups="groups" />
        <div class="stock-detail-page__featured">
          <StockGrowthDecompositionChart :symbol="stock.code" kind="eps" />
        </div>
        <details class="stock-more-charts" @toggle="toggleMore('成長動能', $event)">
          <summary class="stock-more-charts__summary">更多圖表（2）：淨值成長分解、SUE</summary>
          <div v-if="moreOpen['成長動能']" class="stock-detail-page__grid">
            <StockGrowthDecompositionChart :symbol="stock.code" kind="equity" />
            <StockSueChart :symbol="stock.code" />
          </div>
        </details>
      </section>

      <section
        :id="sectionElementId('財務韌性')"
        :ref="registerSectionEl('財務韌性')"
        class="stock-detail-page__section"
        tabindex="-1"
        :aria-labelledby="sectionHeadingId('財務韌性')"
      >
        <h2 :id="sectionHeadingId('財務韌性')" class="stock-detail-page__section-title">
          <el-icon aria-hidden="true"><component :is="TAB_ICONS['財務韌性']" /></el-icon>
          <span>{{ sectionQuestions['財務韌性'] }}</span>
        </h2>
        <p v-if="sectionAnswers['財務韌性']" class="stock-answer">{{ sectionAnswers['財務韌性'] }}</p>
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 財務韌性指標`" :columns="sectionColumns['財務韌性']" :groups="groups" />
        <div class="stock-detail-page__featured">
          <StockLeverageChart :symbol="stock.code" />
        </div>
        <details class="stock-more-charts" @toggle="toggleMore('財務韌性', $event)">
          <summary class="stock-more-charts__summary">更多圖表（3）：流動性、償債保障、銀行資本適足</summary>
          <div v-if="moreOpen['財務韌性']" class="stock-detail-page__grid">
            <StockLiquidityChart :symbol="stock.code" />
            <StockDebtCoverageChart :symbol="stock.code" />
            <StockBankCapitalChart :symbol="stock.code" />
          </div>
        </details>
      </section>

      <section
        :id="sectionElementId('營運周轉')"
        :ref="registerSectionEl('營運周轉')"
        class="stock-detail-page__section"
        tabindex="-1"
        :aria-labelledby="sectionHeadingId('營運周轉')"
      >
        <h2 :id="sectionHeadingId('營運周轉')" class="stock-detail-page__section-title">
          <el-icon aria-hidden="true"><component :is="TAB_ICONS['營運周轉']" /></el-icon>
          <span>{{ sectionQuestions['營運周轉'] }}</span>
        </h2>
        <p v-if="sectionAnswers['營運周轉']" class="stock-answer">{{ sectionAnswers['營運周轉'] }}</p>
        <StockMetricSeriesTable :caption="`${stockShortName} ${code} 營運周轉指標`" :columns="sectionColumns['營運周轉']" :groups="groups" />
        <div class="stock-detail-page__featured">
          <StockTurnoverRatioChart :symbol="stock.code" />
        </div>
        <details class="stock-more-charts" @toggle="toggleMore('營運周轉', $event)">
          <summary class="stock-more-charts__summary">更多圖表（3）：現金轉換循環、資產使用效率、資本支出強度</summary>
          <div v-if="moreOpen['營運周轉']" class="stock-detail-page__grid">
            <StockCashConversionCycleChart :symbol="stock.code" />
            <StockAssetUtilizationChart :symbol="stock.code" />
            <StockCapexIntensityChart :symbol="stock.code" />
          </div>
        </details>
      </section>

      <!-- Renamed 公司資訊 → 大戶籌碼 2026-09-10 per direct request ("Tab 公司資訊 改為 大戶籌碼")
           — 外資持股比例變化 moved in from 市場評價 the same day; 股本變化 removed 2026-09-14 (see
           useStockCards.ts's own comment). No metric series exists for this section, so it is the
           one chart alone. -->
      <section
        :id="sectionElementId('大戶籌碼')"
        :ref="registerSectionEl('大戶籌碼')"
        class="stock-detail-page__section"
        tabindex="-1"
        :aria-labelledby="sectionHeadingId('大戶籌碼')"
      >
        <h2 :id="sectionHeadingId('大戶籌碼')" class="stock-detail-page__section-title">
          <el-icon aria-hidden="true"><component :is="TAB_ICONS['大戶籌碼']" /></el-icon>
          <span>{{ sectionQuestions['大戶籌碼'] }}</span>
        </h2>
        <div class="stock-detail-page__featured">
          <StockForeignShareholdingChart :symbol="stock.code" />
        </div>
      </section>

      <StockProfileCard v-if="profile" :profile="profile" class="stock-detail-page__profile" />
      <StockProfileCardShell v-else class="stock-detail-page__profile" />
      <StockPageDigest :digest="digest" />
    </template>
  </div>
</template>

<style scoped>
.stock-company-health-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
  container-type: inline-size;
}

/* sticky，跟著捲動固定在畫面上方，不管使用者捲到哪個 section 都能直接點其他分類跳過去——這正是
   這次改版的核心訴求（"tabs 現在提供的是快速滑過去的功能"）。top 的 offset 沿用
   --app-header-height/--app-banner-height 這兩個全域 CSS var（layouts/default.vue 自己的
   .app-shell__content padding-top 算 sticky header 實際高度時也是用同一組變數，這裡沿用同一份
   數字保持一致，不是另外量出來的獨立數字）。窄螢幕下連結超出可視寬度就用一般
   overflow-x:auto 水平捲動——不再需要 el-tabs 那套「量測 nav 真實寬度來判斷要不要顯示箭頭」
   機制，普通的捲動容器沒有那個測量循環依賴的問題（見今天稍早那一輪修法的完整教訓）。 */
.stock-detail-page__section-nav {
  position: sticky;
  top: calc(var(--app-header-height) + var(--app-banner-height) + 8px);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  padding: 8px;
  border-radius: 12px;
  background: var(--el-fill-color-light);
}

/* Real anchors now (2026-09-19) — same pill look the <button>s had, plus the link resets.
   min-height 48px is this app's own touch-target floor. */
.stock-detail-page__section-nav-item {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  min-height: 3rem;
  padding: 8px 16px;
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-primary);
  font-size: 1rem;
  font-weight: 600;
  white-space: nowrap;
  text-decoration: none;
}

.stock-detail-page__section-nav-item .el-icon {
  font-size: 1.25rem;
}

/* White label on --el-color-primary-dark-2, not on --el-color-primary: axe measured white on
   the GOLD accent at 4.34:1 (2026-09-19) — the light-mode accents were tuned to the 3:1
   UI-component bar (see main.css's light-mode accent comment), but this pill's label is 16px
   bold text, which needs 4.5:1. dark-2 gives 6.2:1 for GOLD and clears 4.5:1 for every accent.
   Filled pill vs. plain text is a shape/fill difference, not colour alone. */
.stock-detail-page__section-nav-item.is-active {
  background: var(--el-color-primary-dark-2);
  color: #fff;
}

.stock-detail-page__section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  /* Fragment jumps (nav link, deep link) must land the section's own <h2> BELOW both sticky
     layers. The sticky nav's bottom edge sits at header + banner + 8px (its own top offset) +
     64px (8px padding ×2 + 48px items), so 84px = that 72px plus a 12px gap. The previous 64px
     value skipped the nav's own top offset and left the first 8px of every jumped-to title under
     the nav (measured live 2026-09-19: section top 124px vs nav bottom 132px). Nuxt's default
     scrollBehavior reads this same computed value for the vue-router half of the jump. */
  scroll-margin-top: calc(var(--app-header-height) + var(--app-banner-height) + 84px);
}

/* tabindex="-1" sections receive programmatic focus on fragment jumps. A mouse click on a nav
   link would otherwise draw the global focus ring around the whole section (the jump itself plus
   the sticky nav's highlight is enough feedback there); keyboard-initiated jumps (Enter on the
   link) keep the ring via :focus-visible, since for those users it's the one visible sign of
   where focus actually landed. */
.stock-detail-page__section:focus:not(:focus-visible) {
  outline: none;
}

.stock-detail-page__section-title {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-text-color-primary);
}

.stock-detail-page__section-title .el-icon {
  flex: 0 0 auto;
  margin-top: 0.2em;
  font-size: 1.25rem;
}

/* The section's one visible chart — full width, not a grid cell. */
.stock-detail-page__featured {
  width: 100%;
}

/* 更多圖表 — a real <details>, so it works without JavaScript and with a keyboard; ≥48px summary
   row, the theme's focus ring via :focus-visible, no custom marker games. */
.stock-more-charts {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-fill-color-blank);
}

.stock-more-charts__summary {
  display: flex;
  align-items: center;
  min-height: 3rem;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
  list-style: revert;
}

.stock-more-charts[open] .stock-more-charts__summary {
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.stock-more-charts .stock-detail-page__grid {
  padding: 16px;
}

/* Fixed 2-column grid per direct request ("grid 一律改成 一個row兩cols") — now only inside
   更多圖表; 3 columns in genuinely wide 滿版 mode via the container query below, 1 on a phone. */
.stock-detail-page__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

/* 1600px, not 1440px: centered mode's container renders at EXACTLY the 1440px cap, which would
   satisfy `min-width: 1440px` trivially (found live 2026-09-14, "現在非滿版也變成三欄了"). */
@container (min-width: 1600px) {
  .stock-detail-page__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 600px) {
  .stock-detail-page__grid {
    grid-template-columns: 1fr;
  }
}
</style>
