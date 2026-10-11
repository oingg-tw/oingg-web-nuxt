<script setup lang="ts">
// /stock/:code/dividend-source — 配息從哪來（2026-09-24,「sidebar 亮點與風險下面加一個…我這一頁要
// 放從現金殖利率倒推回營收的每個環節」, named「對 本質上是股息從哪來 找回來 然後改名成 配息從哪來」）.
//
// This URL existed before（64b6e38 merged it into /dividend and dropped its waterfall chart）and
// the 股息從哪裡來 section was deleted from /dividend earlier today. Neither removal was because
// the content was wrong — it was on a page whose subject was「殖利率是多少」, which made that page
// carry two subjects. Here it is the whole subject, and the chain reaches further in both
// directions than it ever did as a section.
//
// The chain is a chain of IDENTITIES, which is the only reason it can be published at all: every
// step is one filed figure times one filed rate, so nothing here predicts anything. Verified
// against live data before the page was written（2330 2026Q2: 每股營收 171.23 × 稅後淨利率 50.38%
// = EPS 86.27, and 86.27 × 盈餘發放率 23.76% = 每股股利 20.50, both to the cent）.
//
// Two representations, not one, and they answer different questions. StockDividendSegmentLine is
// the part-whole picture — one division per press, columns growing rightwards on a desktop and
// stacked rows on a phone — and it teaches. The table under it is the precise record and the SSR payload, and it is
// the only one that survives a company the diagram cannot draw（negative parts; see that
// component's own guard）. Still no waterfall and no Sankey: the 高齡友善圖表選型規範 ruling that
// removed the original bridge chart here stands, since a flow diagram asks the reader to track
// width, direction and branching at once.
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '配息從哪來'

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)
const { digest, fiscalYear, prevFiscalYear, visibleSteps, hasTable, hasChain, chartDrawn, chainAnswer, segment } = await useDividendSourceChain(code, stockShortName)


const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '從營收一路推到殖利率',
  pathSuffix: '',
  learnPath: computed(() => `/learn/dividend-source/${code.value}`),
  stock,
  summary: computed(() => null),
  description: computed(() =>
    clampDescription(
      hasChain.value
        ? `${stockShortName.value}（${code.value}）的配息如何從營收算出來：每股營收、毛利率、營業利益率、稅後淨利率、EPS、盈餘發放率到每股股利，逐步列出每一個環節。`
        : `${stockShortName.value}（${code.value}）目前沒有足夠的財報資料可以逐步列出配息的來源。`
    )
  ),
  sectorCode: computed(() => profile.value?.sectorCode ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="app-page stock-dividend-source-page">
    <template v-if="stock">
      <StockSummaryCard :stock="stock" :is-emerging="profile?.isEmerging ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <LearnNav active-to="/learn/dividends" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection
        v-if="chainAnswer"
        id="stock-dividend-source-chain"
        :question="`${stockShortName}（${code}）配的息，是從哪一塊錢來的？`"
        :answer="chainAnswer"
      >
        <!-- 類比那一句、卡片與互動拆解在 LearnDividendChain（2026-10-12 抽出來，新手專區首頁也用）；卡片與類比句的理由寫在那裡 -->
        <LearnDividendChain :segment="segment" :drawn="chartDrawn" />

      </StockQuestionSection>

      <!-- 表格有自己的 h2（2026-09-25「或許我想要的是給表格一個正當的 H2，並且表格本身的內容要完整
           涵蓋前面的五步驟拆解到的元素」）。它跟上面那一段問的不是同一件事：圖表問「配的息從哪來」，
           表格問「這一年實際上是多少」。而它的十三列現在完整涵蓋圖上九根長條，以及解釋那些長條需要的
           每一個科目（營業費用、其他營業收支、業外、所得稅、少數股東），不再只有七個轉折點。 -->
      <StockQuestionSection
        v-if="hasTable"
        id="stock-dividend-source-table"
        :question="`${stockShortName} ${code} ${fiscalYear === null ? '' : `${fiscalYear} 年度`}的損益表，每一段各是多少？`"
        :answer="prevFiscalYear === null
          ? '由上往下就是損益表自己的順序，每一列都是每股金額。'
          : `由上往下就是損益表自己的順序，每一列都是每股金額；右邊一欄是 ${prevFiscalYear} 年度的同一個數字，可以直接對照。`"
      >
      <!-- 不再收合（2026-09-25「表格就不要隱藏」）。它是這一頁唯一帶有這家公司自身數字的結構化
           資料——索引段那 28 個連結在 2000 多頁上逐字相同，這張表每頁都不同——而且它是全站檢查
           `ssrTables` 要求的那一個 data-ssr-table。收在 <details> 裡讀者多一個動作才看得到，
           而它本來就是這一段的內容而不是附錄。 -->
      <div class="stock-dividend-source-page__table">
        <SharedTableScroll :label="`${stockShortName} ${code} 從營收到配息的每一個環節`">
        <table class="seo-table" data-ssr-table>
          <!-- visually-hidden 不是刪掉（2026-09-25「想刪掉。但是想不到強化 SEO 的替代方案」）。
               caption 是表格的無障礙名稱，拿掉會讓螢幕閱讀器與爬蟲都少一段，而它在畫面上其實是
               多餘的——上面的 h2 已經說了這是什麼。main.css 的 .visually-hidden 就是為這件事存在的
               （「for screen readers and search engines rather than the visual layout」），
               StockFinancialHighlightsRisksCard.vue:336 已經是同一個寫法。
               既然沒有版面成本，就寫完整一點：把第三欄在做什麼也講出來。 -->
          <caption class="visually-hidden">{{ stockShortName }} {{ code }} {{ fiscalYear === null ? '' : `${fiscalYear} 年度` }}從營收一路分到股利，每一列是該環節的每股金額，以及它怎麼從上一列算出來</caption>
          <thead>
            <tr>
              <th scope="col"><span class="visually-hidden">運算</span></th>
              <th scope="col">項目</th>
              <th scope="col">{{ fiscalYear === null ? '每股金額（元）' : `${fiscalYear} 年度（元）` }}</th>
              <th v-if="prevFiscalYear !== null" scope="col">{{ prevFiscalYear }} 年度（元）</th>
              <th scope="col">怎麼來的</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="step in visibleSteps" :key="step.label">
              <td class="stock-dividend-source-page__op" aria-hidden="true">{{ step.op }}</td>
              <th scope="row">{{ step.label }}</th>
              <td class="seo-table__num">{{ step.value }}</td>
              <td v-if="prevFiscalYear !== null" class="seo-table__num">{{ step.prev }}</td>
              <td>{{ step.from }}</td>
            </tr>
          </tbody>
        </table>
        </SharedTableScroll>
      </div>
      </StockQuestionSection>

      <!-- 索引段。分組與順序跟圖上的五刀一致，讀者停在哪一步就在這裡找得到同一個標題。
           全部在 SSR 裡，所以它同時是上週那 16 個損益表 metric 頁的爬取路徑——它們目前不在側邊欄。 -->
      <StockQuestionSection
        id="stock-dividend-source-index"
        question="每一環還可以往下看什麼？"
        :answer="`把${stockShortName}這一年的損益表拆成五刀之後，每一刀底下還有各自的細節頁；下面照圖上的順序列出來。`"
      >
        <!-- 每個指標一句鉤子（2026-09-25「我總覺得都放文字總有哪些詭異，真的有人會看嗎？…假設我是用戶，
             我甚麼都不知道，才有機會繼續往下點選我好奇的那個項目」）。先前是 28 個裸連結排成五行——連結
             本身不會告訴一個什麼都不懂的人為什麼要點。
             形狀直接照 app/pages/rank/index.vue:37-42：連結一行、說明一行，grid 排版、無邊框無背景。
             那是這個站唯一「每一項配自己一句話」的既有寫法，而卡片式在這一頁是被否決過的。
             組標題用 h3 不是 strong：strong 只是視覺加粗，對輔助技術不是標題，而 h1→h2→h3 是
             check-stock-pages.mjs 的 outlineIsValid 允許的層級。 -->
        <div v-for="group in DIVIDEND_CHAIN_INDEX" :key="group.stage" class="stock-dividend-source-page__index-group">
          <h3 class="stock-dividend-source-page__index-stage">{{ group.stage }}</h3>
          <ul class="stock-dividend-source-page__index">
            <li v-for="link in group.links" :key="link.slug" class="stock-dividend-source-page__index-item">
              <NuxtLink :to="`/stock/${code}/${link.slug}`" class="stock-dividend-source-page__index-link">{{ link.label }}</NuxtLink>
              <span class="stock-dividend-source-page__index-hook">{{ link.hook }}</span>
            </li>
          </ul>
        </div>
      </StockQuestionSection>

      <StockPageFooter :sources="digest?.sources ?? []" :freshness="digest && buildDigestFreshnessText(digest)" />
    </template>

    <SharedStockNotFound v-else-if="!stockPending" />
  </div>
</template>

<style scoped>
/* 形狀抄 app/pages/rank/index.vue:68-95，值也一樣——那是站上既有的「連結 ＋ 一行說明」清單。
   沒有邊框、沒有背景：卡片式在這一頁被明確否決過（「card-per-metric ＝ 畫面髒亂」）。
   min-height 48px 是這個站的觸控下限，沒有共用 class 可以重用（見本檔 summary 的同一條註解）。 */
/* 運算子欄。aria-hidden：「−」「＝」對螢幕閱讀器是雜訊，而每一列的算式在最後一欄用文字講完整了。 */
.stock-dividend-source-page__op {
  width: 1.5em;
  padding-inline-end: 0;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.stock-dividend-source-page__index-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stock-dividend-source-page__index-stage {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stock-dividend-source-page__index {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 12px 24px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.stock-dividend-source-page__index-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 48px;
}

.stock-dividend-source-page__index-link {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.stock-dividend-source-page__index-hook {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

</style>
