<script setup lang="ts">
import type { StockBadgePageResponse } from '#shared/types/stock-badge-page'
// The BADGE half of /stock/{code}/{slug} (2026-09-20), generalizing f-score.vue's per-stock ×
// per-metric template to other guru badges.
//
// Was the route file itself until later the same day, when 指標專頁 arrived and the two kinds
// were split into two templates per direct decision（「我認為把徽章與指標頁面區分成兩個模板會比較
// 容易些」）. Nuxt allows only one dynamic segment per directory, so the route file
// (app/pages/stock/[code]/[slug].vue) is now a dispatcher that mounts either this or
// StockMetricDetailPage.vue. Moved verbatim — this component still reads the route itself rather
// than taking props, which is why the body below needed no changes at all.
//
// Still a catch-all sibling of the named sub-pages (balance-sheet.vue, dividend.vue, …): Nuxt
// resolves a static route before a dynamic one, so those keep winning, and an unrecognized slug
// 404s in the dispatcher.
//
// f-score itself keeps its own dedicated route (/stock/:code/f-score, its own 9-signal
// checklist) rather than moving here — what generalizes is the data sources and page rules
// (question h2s, verbatim limitations/misreadings, a short methodology paragraph linking out
// instead of pasting badge.detail per symbol), not the URL shape. BADGE_PAGES
// (shared/utils/metric-pages.ts) is the one registry this page, the sitemap handler, and
// StockFinancialHighlightsRisksCard's entry-point links all read.
//
// The three question sections a single-value badge needs (vs. f-score's four): 目前值 → 計算依據
// (a real SSR table, since these badges have no 9-signal checklist to fill that role) →
// 優點與限制 → 是什麼. Data comes from /api/stock/:code/badge (one same-origin round trip:
// this symbol's badge entry + its calculation-audit trail).
const route = useRoute()
const code = computed(() => String(route.params.code))
const slug = computed(() => String(route.params.slug))

const badgePage = findBadgePage(slug.value)
if (!badgePage) throw createError({ statusCode: 404, statusMessage: 'unknown stock sub-page' })

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

const { data: badgeData, refresh: refreshBadgeData } = await useAsyncData<StockBadgePageResponse | null>(
  () => `stock-badge-${code.value}-${slug.value}`,
  async () => {
    try {
      return await $fetch<StockBadgePageResponse>(`/api/stock/${code.value}/badge`, { query: { slug: slug.value }, retry: 0, timeout: BFF_REQUEST_TIMEOUT_MS })
    } catch (error) {
      devWarn('stock-badge', `GET /api/stock/${code.value}/badge?slug=${slug.value} unavailable`, error)
      return null
    }
  },
  { watch: [code, slug], default: () => null }
)

// The badge's own catalog definition (name/author/summary/threshold/source link) — same
// buildGuruBadges() every badge UI reads, so this page and the dialog never disagree.
// `undefined` when the badge has been withdrawn from the catalog (analysis-ts's ongoing badge-
// takedown rounds) — the page still renders (its own value/provenance are independent data), it
// just drops the 徽章門檻 line and the 是什麼 section's summary/author, and goes `noindex`.
const badgeDefinition = computed(() => buildGuruBadges(filterSchema.value?.categories ?? []).find(badge => badge.id === badgePage.metricCode) ?? null)
// The badge's OWN threshold source (catalog `badge.sourceUrl`, 2026-09-20) — never the metric's
// referenceUrl, which answers "what is this metric" rather than "why is the threshold ≥ 40%".
// Renders nothing when absent (毛利率 and 淨利率 are exactly that case: their threshold comes from
// a print book); see GuruBadge.sourceUrl's own comment.
const sourceUrl = computed(() => badgeDefinition.value?.sourceUrl ?? null)
const unit = computed(() => findMetricInSchema(filterSchema.value?.categories ?? [], badgePage.metricCode)?.metric.unit ?? '')
// The metricCode the 目前值 chart queries — same provenanceMetricCode substitution the
// calculation-audit table already makes (see badgePageChartMetricCode's own comment). Reusing
// `unit` above rather than a second lookup keyed on this: verified live that liveGrahamNumber and
// its provenance substitute grahamNumber share the same unit (倍), so one lookup covers both.
const chartMetricCode = badgePageChartMetricCode(badgePage)

// 2026-09-29：這一段改用指標頁那張互動卡片。先前用的是靜態的 StockMetricHistoryChart——徽章模板
// 先做，之後每一次改進（基準切換、近5/8/10年、自訂區間、百分位量尺、跟誰一起看）都只進了指標模板，
// 於是這 7 頁停在舊世代。實測的症狀：毛利率與營業利益率是同一組三率裡的兩支，前者沒有基準切換、
// 後者有——而毛利率的型錄明明有 Q 與 TTM。全站 52 頁裡有 5 頁是這個狀態
//（roe／gross-margin／net-profit-margin／interest-coverage／accruals-ratio，都是 Q/TTM）。
//
// 另外 22 頁沒有切換是**誠實的**：那些指標本來就只有一個基準，顯示一個只有一個選項的切換鈕比沒有更糟
//（2026-09-21「不是每個卡片都要用TTM，但是都要可以選擇1235年」）。所以這次只補那 5 頁，不是「全部統一」。
//
// 基準清單讀 CHART 那一支的型錄條目，不是徽章那一支：liveGrahamNumber 是 EOD-only，圖畫的是它的
// provenance 替身 grahamNumber，兩者的 fields 不同。
const chartMetricEntry = computed(() => findMetricInSchema(filterSchema.value?.categories ?? [], chartMetricCode)?.metric ?? null)
const chartTimeframes = computed<MetricsHistoryTimeframe[]>(() => {
  const periods = chartMetricEntry.value?.fields.map(field => field.period) ?? []
  return (['TTM', 'Q', 'FY'] as const).filter(tf => periods.includes(tf))
})
// 一起畫的第二支指標的顯示名稱，規則同指標頁（配對由 registry 決定，沒有選單）。
const compareName = computed(() => {
  const code = badgePage.compareMetricCode
  if (!code) return undefined
  const metric = findMetricInSchema(filterSchema.value?.categories ?? [], code)?.metric
  if (!metric) return undefined
  return metric.nameSuffix ? `${metric.nameSuffix} ${metric.name}` : metric.name
})

// 對照指標自己支援的期別，從同一份型錄取（見 StockMetricHistoryChartInteractive 的 compareTimeframes
// 註解：不給的話，切到對照指標沒有的期別會讓整個請求 400、連主指標都畫不出來）。
const compareTimeframes = computed<MetricsHistoryTimeframe[]>(() => {
  const code = badgePage.compareMetricCode
  if (!code) return []
  const periods = findMetricInSchema(filterSchema.value?.categories ?? [], code)?.metric.fields.map(field => field.period) ?? []
  return (['TTM', 'Q', 'FY'] as const).filter(tf => periods.includes(tf))
})


// 讀失敗 vs 真的沒有（2026-09-30，同 StockMetricDetailPage 的註解）。這兩個在畫面上一直是同一句話。
// 徽章頁的兩個 null 意義不同：`badgeData` 整包是 null 才是讀失敗，`badgeData.entry` 是 null 是
// 200 回來但這家公司不在這個徽章的適用範圍（或徽章已撤），那是真的沒有，不是我們壞了。
const readFailed = computed(() => badgeData.value === null)
// 讀不到時交給全站的讀取失敗彈窗（AppLoadFailureDialog），畫面上不再各自出訊息（2026-10-08）
watchLoadFailure(() => `stock-badge:${code.value}:${slug.value}`, () => readFailed.value, refreshBadgeData)

const entry = computed(() => badgeData.value?.entry ?? null)
// 對帳用的值，只在溯源查的就是徽章自己那一支時才給（見 StockMetricProvenanceSection 的註解）。
// liveGrahamNumber 這種 EOD 徽章畫的／查的是季報的 grahamNumber 替身，兩個數字本來就不相等
// （用的收盤價不同天），那時對帳會錯殺一張有效的表。
const provenanceExpectedValue = computed(() =>
  badgePage.provenanceMetricCode === badgePage.metricCode ? entry.value?.value ?? null : null
)
const provenance = computed(() => badgeData.value?.provenance ?? null)

// 不適用（產業排除）vs 尚無資料 — same distinction StockGuruBadgeDialog.vue's currentValueText()
// makes, off the same `nullReason` field.
const valueText = computed(() => {
  const value = entry.value?.value ?? null
  if (value === null) return nullReasonShortText(entry.value?.nullReason)
  return `${formatSignificantDigits(value, 3)}${unit.value}`
})

const passedText = computed(() => {
  const passed = entry.value?.passed ?? null
  return passed === null ? '無法判定' : passed ? '符合' : '未符合'
})

// 「目前的」only for an EOD badge, whose value really IS computed from today's price — the badges
// endpoint states each badge's own `timeframe`, so this reads it rather than guessing per slug
// (2026-09-21). The badge pages are genuinely mixed: liveGrahamNumber and livePegRatio are EOD
// live-price computations where 目前 is exactly right, while psr/roe/grossMargin/netProfitMargin
// are TTM figures pinned to a filed period — and analysis-ts confirmed the same day that this
// app's price-based ratios divide by the close on the FILING's knowledge date, a frozen historical
// price, so「目前的PSR」beside「資料時間 2026-08-11」was claiming something the number doesn't carry.
const valueAnswer = computed(() => {
  if (!entry.value) return null
  const lead = entry.value.timeframe === 'EOD' ? `${stockShortName.value}目前的` : `${stockShortName.value}的`
  // The rank clause only appears on a percentileRank badge, where the threshold is relative（「前
  // 20%」）and the verdict means nothing without it. Both fields are checked rather than assumed —
  // an absolute-threshold badge sends neither.
  const rank = entry.value.rank
  const totalCount = entry.value.totalCount
  return joinClauses([
    `${lead}${badgePage.topic}為 ${valueText.value}`,
    rank != null && totalCount != null ? `全市場第 ${rank} 名（共 ${totalCount} 檔）` : null,
    entry.value.knowledgeDate ? `資料時間 ${entry.value.knowledgeDate}` : null,
    badgeDefinition.value ? `徽章門檻「${badgeDefinition.value.threshold.description}」本期${passedText.value}` : null
  ])
})

// 計算依據（審計鏈）表與歷年變化表 2026-10-01 都搬到共用元件
// （StockMetricProvenanceSection / StockMetricHistorySection），指標頁與徽章頁用同一份。
// 原本只有這裡有計算依據表、只有指標頁有歷年變化表，兩邊各缺對方的一張。
const metricEntry = computed(() => findMetricInSchema(filterSchema.value?.categories ?? [], badgePage.metricCode)?.metric ?? null)
// Same frontend-first resolution StockMetricDetailPage uses — see shared/utils/metric-copy.ts for
// why the prose moved here while the maths stayed with analysis-ts. The two templates share the
// file rather than each keeping their own: 10 of the 29 pages are badges and 19 are metrics, but a
// metric's 什麼時候不適用 does not change depending on which template happens to render it.
// Same 相關指標 line the metric template carries — see its own comment and the registry field's.
const related = resolveRelatedPages(badgePage.related)

const copy = computed(() => findMetricCopy(badgePage.metricCode))
// 標題隨內容變（2026-09-30）：13 個指標頁沒有前端文案、因此沒有「跟誰比」那一句，標題若照寫
// 「要跟誰比、什麼時候會看錯？」就是承諾了一個段落裡沒有的東西（實測 /operating-expense、
// /cost-of-goods-sold 就是這種）。有 compare 才把它寫進標題。
const notesQuestion = computed(() =>
  copy.value?.reading?.compare
    ? `${badgePage.topic}要跟誰比、什麼時候會看錯？`
    : `${badgePage.topic}什麼時候會看錯？`
)

const limitations = computed<string[]>(() =>
  copy.value?.limitations ?? (metricEntry.value?.limitations ? [metricEntry.value.limitations] : [])
)
const misreadings = computed<string[]>(() =>
  copy.value?.misreadings ?? (metricEntry.value?.misreadings ? [metricEntry.value.misreadings] : [])
)

// Same clauses as valueAnswer (value/knowledgeDate/threshold), built separately rather than
// reused verbatim so the lead reads「{短名}（{代碼}）{主題}」the way every other sub-page's
// description does — a short version dropping straight to "{topic}：{value}。" undershoots the
// 50-CJK-char floor (scripts/check-stock-pages.mjs).
const description = computed(() => {
  if (!entry.value) return null
  const lead = joinClauses([
    `${stockShortName.value}（${code.value}）${badgePage.topic}：${valueText.value}`,
    entry.value.knowledgeDate ? `資料時間 ${entry.value.knowledgeDate}` : null,
    badgeDefinition.value ? `徽章門檻「${badgeDefinition.value.threshold.description}」本期${passedText.value}` : null
  ])
  return clampDescription(joinSentences([lead, badgeDefinition.value?.summary]) ?? '')
})

// noindex whenever the page has nothing symbol-specific to say: outside the shared pilot batch
// (same codes as f-score — 2026-09-19's call to watch indexing before widening), the badge itself
// withdrawn from the catalog, or this company simply has no value for it. Each condition degrades
// the page rather than erroring it; noindex is what keeps a thin/duplicate version out of the
// index while it's still reachable and useful to a visitor who followed a link here.
const noindex = computed(() => !isFScorePilotSymbol(code.value) || !badgeDefinition.value || entry.value?.value == null)

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: badgePage.topic,
  titleKeywords: badgePage.titleKeywords,
  pathSuffix: `/${badgePage.slug}`,
  stock,
  summary,
  description,
  noindex,
  sectorCode: computed(() => profile.value?.industry ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="stock-badge-page">
    <template v-if="stockPending" />
    <SharedStockNotFound v-else-if="!stock" />

    <template v-else>
      <StockSummaryCard :stock="stock" :is-emerging="profile?.isEmerging ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="badgePage.topic" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-badge-value" :question="`${stockShortName}（${code}）的${badgePage.topic}是多少？`" :answer="valueAnswer">
        <!-- 資料時間/徽章門檻 lines removed 2026-09-21（直接要求「stock-page-section
             stock-question-section 移除重複資訊」）— StockQuestionSection's own :answer prop
             (valueAnswer below) already states the value, knowledge date and threshold/pass-fail
             in one sentence directly above this card; these were the same facts restated as
             separate lines right under it. The big number stays — a different visual role (large,
             scannable at a glance), not a duplicate in the way plain repeated text is. -->
        <el-card shadow="never" class="stock-badge-page__card">
          <template v-if="entry">
            <!-- No big value number here either — removed with the metric page's on 2026-09-21
                 for the same reason: this section's answer sentence already states the value, its
                 knowledge date AND the threshold verdict, so a figure above it repeated the first
                 of those with none of the context. See StockMetricDetailPage's own note. -->
            <!-- Same one-line branch StockMetricDetailPage makes, for the same reason: only the
                 chart inside this card differs, never the page's document shape. -->
            <StockValuationRiverChart v-if="badgePage.riverKind" :symbol="code" :kind="badgePage.riverKind" />
            <StockMetricHistoryChartInteractive
              v-else-if="badgePage.chartTimeframe"
              :symbol="code"
              :metric-code="chartMetricCode"
              :topic="badgePage.topic"
              :unit="unit"
              :default-timeframe="badgePage.chartTimeframe"
              :available-timeframes="chartTimeframes"
              :compare-metric-code="badgePage.compareMetricCode"
              :compare-name="compareName"
              :compare-timeframes="compareTimeframes"
            />
          </template>
          <!-- 讀不到：彈窗會說明並自動重讀；這裡留空，免得落到下一行「目前沒有資料」 -->
          <template v-else-if="readFailed" />
          <p v-else class="stock-badge-page__line">目前沒有這檔股票的{{ badgePage.topic }}資料。</p>
        </el-card>
      </StockQuestionSection>

      <!-- 歷年變化（2026-10-01 補上）。這 7 頁一直只有圖沒有表，而 series 本來就在同一包回應裡
           （實測 roe 20 期）——缺的只是這張表。圖與表的順序跟指標頁一致：圖在前、SSR 表格在後。 -->
      <StockMetricHistorySection
        v-if="badgeData?.series && badgePage.chartTimeframe"
        :entries="badgeData.series.entries"
        :metric-code="chartMetricCode"
        :timeframe="badgeData.series.timeframe"
        :topic="badgePage.topic"
        :unit="unit"
        :short-name="stockShortName"
        :code="code"
      />

      <StockMetricProvenanceSection :symbol="code" :short-name="stockShortName" :topic="badgePage.topic" :provenance="provenance" :expected-value="provenanceExpectedValue">
        <!-- 「優點」2026-09-30 從自己的段落搬進這裡：它講的就是上面這張計算依據表的性質（門檻是誰訂
             的、每個輸入能不能回溯），不是這個指標的優點，所以它屬於「怎麼算出來的」而不是一個獨立的
             問句段落。原本那個段落叫「用 X 判斷有什麼優點與限制？」，而它其實同時裝著三種東西：徽章
             的優點、指標的限制、指標的常見誤讀——後兩者已經搬到下面「要跟誰比、什麼時候會看錯？」，
             跟 45 個指標頁用同一組段落。
            「不含本站自訂的判斷」was the wording here until 2026-09-22. It said the right thing and
             said it in the one shape analysis-ts's own compliance rule rejects: writing「本站」as the
             actor makes us the definer, which is exactly what this sentence is trying to deny.
             Stating whose threshold it is does the same job without the claim.
             這一段是徽章頁獨有的（指標頁沒有門檻可以講），所以它留在呼叫端的 slot 裡，不進共用元件。 -->
        <section class="stock-badge-page__pros-cons-block" aria-labelledby="stock-badge-pros-heading">
          <h3 id="stock-badge-pros-heading" class="stock-badge-page__pros-cons-title">這份計算依據的性質</h3>
          <ul class="stock-badge-page__pros-cons-list">
            <li>門檻是提出者公開發表的固定數字，每一家公司都用同一套標準比較，我們不會自己改。</li>
            <li>每一個輸入數字都能回溯到財報或交易所公告的原始資料，上表逐項列出。</li>
          </ul>
        </section>
      </StockMetricProvenanceSection>

      <!-- 這三段（是什麼／變大或變小／要跟誰比）2026-09-30 起跟 45 個指標頁**完全一致**，段落名稱、
           順序、小標都一樣。在那之前這 7 頁卡在自己一套：`是多少 → 怎麼算出來的 → 用 X 判斷有什麼
           優點與限制 → X 是什麼`，而且**完全沒有「數字變大／變小」那一段**——即使 roe、毛利率、
           稅後淨利率的 reading 早就寫在 METRIC_COPY 裡。這 7 頁同時是 STOCK_METRIC_INDEX 的目的地，
           所以讀者點「資產報酬率」看得到「數字變大代表什麼」、點「股東權益報酬率」看不到。
           統一之後那個缺口消失，段落分區也跟指標頁一致：公司自己的數字 → 通則 → 頁尾。 -->
      <StockQuestionSection v-if="badgeDefinition" id="stock-badge-method" :question="`${badgePage.topic}是什麼？`">
        <p class="stock-answer">{{ badgeDefinition.summary }}</p>
        <p class="stock-badge-page__footer-line">
          出處：{{ badgeDefinition.author }}
          <template v-if="sourceUrl">・<a :href="sourceUrl" target="_blank" rel="noopener">原始文獻（另開新視窗）</a></template>
        </p>
      </StockQuestionSection>

      <StockQuestionSection v-if="copy?.reading" id="stock-badge-howto" :question="`${badgePage.topic}變大或變小代表什麼？`">
        <div class="stock-badge-page__pros-cons">
          <section class="stock-badge-page__pros-cons-block" aria-labelledby="stock-badge-up-heading">
            <h3 id="stock-badge-up-heading" class="stock-badge-page__pros-cons-title">數字變大</h3>
            <p class="stock-answer">{{ copy.reading.up }}</p>
          </section>
          <section class="stock-badge-page__pros-cons-block" aria-labelledby="stock-badge-down-heading">
            <h3 id="stock-badge-down-heading" class="stock-badge-page__pros-cons-title">數字變小</h3>
            <p class="stock-answer">{{ copy.reading.down }}</p>
          </section>
        </div>
      </StockQuestionSection>

      <StockQuestionSection
        v-if="copy?.reading?.compare || limitations.length || misreadings.length"
        id="stock-badge-reading"
        :question="notesQuestion"
      >
        <div class="stock-badge-page__pros-cons">
          <section v-if="copy?.reading?.compare" class="stock-badge-page__pros-cons-block" aria-labelledby="stock-badge-compare-heading">
            <h3 id="stock-badge-compare-heading" class="stock-badge-page__pros-cons-title">跟誰比</h3>
            <p class="stock-answer">{{ copy.reading.compare }}</p>
          </section>

          <section v-if="limitations.length" class="stock-badge-page__pros-cons-block" aria-labelledby="stock-badge-limits-heading">
            <h3 id="stock-badge-limits-heading" class="stock-badge-page__pros-cons-title">什麼時候不適用</h3>
            <p v-if="limitations.length === 1" class="stock-answer">{{ limitations[0] }}</p>
            <ul v-else class="stock-badge-page__pros-cons-list">
              <li v-for="item in limitations" :key="item">{{ item }}</li>
            </ul>
          </section>

          <section v-if="misreadings.length" class="stock-badge-page__pros-cons-block" aria-labelledby="stock-badge-misreadings-heading">
            <h3 id="stock-badge-misreadings-heading" class="stock-badge-page__pros-cons-title">容易看錯的地方</h3>
            <p v-if="misreadings.length === 1" class="stock-answer">{{ misreadings[0] }}</p>
            <ul v-else class="stock-badge-page__pros-cons-list">
              <li v-for="item in misreadings" :key="item">{{ item }}</li>
            </ul>
          </section>
        </div>
      </StockQuestionSection>

      <!-- 頁尾：出處與去處，刻意沒有 h2（同指標頁）。免責聲明留在這裡而不是跟著定義走——它是整頁的
           聲明，不是「是什麼」的一部分。 -->
      <div class="stock-badge-page__footer">
        <p class="stock-badge-page__footer-line">
          <NuxtLink :to="metricPath(badgePage.metricCode)">看{{ badgePage.topic }}的完整說明</NuxtLink>
        </p>
        <p v-if="related.length" class="stock-badge-page__footer-line">
          接著可以看：<template v-for="(item, index) in related" :key="item.slug"><template v-if="index">、</template><NuxtLink :to="`/stock/${code}/${item.slug}`">{{ item.topic }}</NuxtLink></template>。
        </p>
        <p class="stock-badge-page__footer-line">{{ GURU_BADGE_DISCLAIMER }}</p>
      </div>

      <p class="stock-page-section__link">
        <NuxtLink :to="`/stock/${code}`">回 {{ stockShortName }} {{ code }} 的財報亮點與風險</NuxtLink>
      </p>
    </template>
  </div>
</template>

<style scoped>
.stock-badge-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stock-badge-page__card {
  /* Anchor for the chart components' corner controls, same as .stock-metric-page__card */
  position: relative;
  border-radius: 12px;
}

/* Top/bottom padding trimmed 20px→12px 2026-09-21, same「公司卡片先打薄」pass and same move as
   StockSummaryCard's own body-style trim (and StockMetricDetailPage's own copy of this rule) —
   pure whitespace, no content removed. Targets BOTH el-card instances sharing this class（目前值/
   是什麼 sections）via :deep() since the padding lives on Element Plus's own .el-card__body.
   Horizontal padding untouched. */
.stock-badge-page__card :deep(.el-card__body) {
  padding-top: 12px;
  padding-bottom: 12px;
}

.stock-badge-page__line {
  margin: 0 0 8px;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.stock-badge-page__pros-cons {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 小標比 h2 弱一階，同指標頁（2026-09-30 版面簡化）。 */
.stock-badge-page__pros-cons-title {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* 40em cap removed 2026-09-20 with every other one — see main.css's .hub-answer comment. */
.stock-badge-page__pros-cons-list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

/* 頁尾：出處與去處，字級與顏色退一階、沒有卡片，跟指標頁同一套。 */
.stock-badge-page__footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.stock-badge-page__footer-line {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}
</style>
