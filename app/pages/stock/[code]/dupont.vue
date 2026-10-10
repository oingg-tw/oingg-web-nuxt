<script setup lang="ts">
import type { LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'
import type { LookbackWindow } from '~/utils/lookback-window'
import { DUPONT_METRIC_CODES, type StockDupontPageResponse } from '#shared/types/stock-dupont-page'
import type { MetricsHistoryEntry } from '#shared/types/metrics-history'
// /stock/:code/dupont — 杜邦分析（「杜邦分析該怎麼呈現 放在哪個分類下?」）。三個因子分屬三個型錄分類（淨利率在獲利能力、資產週轉在
// 營運效率、權益乘數在安全韌性），那個分散就是主題：ROE 不是獨立的獲利數字，是獲利 × 資產效率 × 槓桿。歸在獲利能力（ROE 在型錄裡
// 的位置）。恆等式的量測與兩次差點讓這一頁夭折的錯誤量測見 shared/types/stock-dupont-page.ts。
// **刻意不做**：把 ROE 的變化歸因到某一個因子——算術只支持「三者相乘等於它」，ΔROE 的對數分解是前端自創的分析，排行與篩選器的
// 合規線同樣適用；五欄並排，讀者自己下結論（杜邦分析傳統上也是這樣教）。
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '杜邦分析'

// 四條線（2026-09-22「線圖怎麼只剩下一條？請給我稅後淨利率 總資產周轉 權益乘數 ROE」）。原本只畫 ROE，理由是三個因子單位不同
//（%、次、倍）「不能共軸」、而指數化到共同基期被否決（淨利率在虧損年是負的，負基期會翻轉後面每一點的符號）。漏掉的是：不必共用一個
// 軸——百分比在左、倍數在右（次與倍都是 0–2 之間的無量綱比率），tooltip 各自標單位。四組不同的（線型, 符號）配對，不靠顏色就分得開
//（WCAG 1.4.1），也看得出哪條線屬於哪個軸。仍然不把 ROE 的變動歸因給某個因子。
const rateText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)}%`)
const timesText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)} 次`)
const multipleText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)} 倍`)

// Each name carries its own unit, which is what tells a reader WHICH AXIS a line is measured
// against — the standing trap of a dual-axis chart. 權益乘數 tracks near 1.5 on the right axis and
// crosses the left axis's gridlines around 54; without「（倍）」on the legend entry, reading it as
// 54% is the obvious mistake, and it is the chart's job to prevent it, not the reader's to avoid it.
const ROE_SERIES = [
  { code: 'roe', name: '股東權益報酬率（%）', lineType: 'solid', symbol: 'circle' },
  { code: 'netProfitMargin', name: '稅後淨利率（%）', lineType: 'dashed', symbol: 'triangle' },
  { code: 'assetTurnover', name: '資產週轉率（次）', lineType: 'dotted', symbol: 'rect', axis: 'right', format: timesText },
  { code: 'equityMultiplier', name: '權益乘數（倍）', lineType: 'solid', symbol: 'diamond', axis: 'right', format: multipleText }
] as const satisfies readonly LineSeriesSpec[]

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

const { data: dupontData } = await useAsyncData<StockDupontPageResponse | null>(
  () => `stock-dupont-${code.value}`,
  async () => {
    try {
      return await $fetch<StockDupontPageResponse>(`/api/stock/${code.value}/dupont`, { retry: 0, timeout: BFF_REQUEST_TIMEOUT_MS })
    } catch (error) {
      devWarn('stock-dupont', `GET /api/stock/${code.value}/dupont unavailable`, error)
      return null
    }
  },
  { watch: [code], default: () => null }
)

// 三因子、權益乘數是其中之一（2026-09-22「杜邦分析用三部分，權益乘數要是其中一個因子」）。上線時是五因子版，理由是三因子當時量到
// 82/83；analysis-ts 改用平均分母重算之後重量（恆等式 ±0.05pp／15 檔完整覆蓋）：三項近四季 109/109／13 檔、單季 115/115／15 檔，
// 五項近四季 101/101／12 檔——五項不再換到精度、反而少覆蓋（掉的正是三個獲利階段因子 insufficient_history 的公司，例如 2207）。
// 五因子展開沒有刪，放在下面自己的段落（2026-10-07 前是收合的 details）：「淨利率為什麼動了」是下一個問題，資料同一次請求就有。
const REQUIRED = ['roe', 'netProfitMargin', 'assetTurnover', 'equityMultiplier']
const activeSeries = computed(() => (basis.value === 'Q' ? dupontData.value?.quarterlySeries : dupontData.value?.series))

// 每一期都留著、缺因子的也不濾掉（2026-09-23 修正）。濾掉會讓圖對時間說謊：類別軸只認識給它的列，2330 的近四季序列把
// 「2021 Q3、2021 Q4、2024 Q1」畫成三個相鄰刻度、一條不斷的線，兩年半壓成一步——截圖抓到的，所有斷言都過。
// StockMultiSeriesLineChart 本來就 connectNulls: false 讓沒申報的期別在線上留真的缺口，在這裡濾掉等於讓 ECharts 看不到 null。
// 表格也顯示那些列（格式化後印 尚無資料），只有 latest 跳過它們（標題句要引一個真的分解得出來的期別）。
// 頭尾的空白仍然修掉、也只修頭尾：軸應該涵蓋資料真正覆蓋的範圍，而範圍內的洞是關於資料的事實。這是常態不是假設：bff-ts 2026-09-23
// ——一般公司的近四季序列從 2021Q4 才有值（109Q4 的 XBRL 損益表全市場只有約 51 家），1101／2317／1216 都剛好有一個開頭的 null 季。
// 2330 沒有這個現象（2020Q3 起兩種基準都有值），bff-ts 因此警告別拿它當開發樣本——它是例外，而這頁的截圖都對著它。
const isComplete = (entry: MetricsHistoryEntry) => REQUIRED.every(metricCode => entry.values[metricCode]?.value != null)
const ascending = computed<MetricsHistoryEntry[]>(() => {
  const all = activeSeries.value?.entries ?? []
  const first = all.findIndex(isComplete)
  if (first < 0) return []
  let last = all.length - 1
  while (last > first && !isComplete(all[last]!)) last--
  return all.slice(first, last + 1)
})
const periods = computed(() => [...ascending.value].reverse())
const latest = computed(() => periods.value.find(isComplete) ?? null)

// 期別切換（2026-09-22「杜邦分析圖表要可以選單季與近四季」）：兩種序列同一次請求就有，切換是換資料不是重抓。預設仍是近四季（單季
// ROE 是季報酬，9.71% 被讀成年化會高估約四倍）——但不藏基準也能防誤讀，所以 basisLabel 穿過這一頁的每一句、每個標題與註記。
const basis = ref<'TTM' | 'Q'>('TTM')
const basisLabel = computed(() => TIMEFRAME_LABELS[basis.value])
// 資產週轉率's plain-language gloss is the quiet half of the same trap: 0.14 次 is a QUARTER's
// turnover, and the table said「一年」unconditionally.
const turnoverPeriodWord = computed(() => (basis.value === 'Q' ? '一季' : '一年'))

// 圖表區間（2026-09-22「圖表要可以選 1235 年」）：全站同一組 近 1/2/3/5/8 年、同一個 SharedLookbackWindowSelect，從已載入的 20 期
// 切片不重抓。停用的視窗是量出來的不是常數：原本只停 [8]，但這一頁能畫的不是抓回來的期數而是過 required 篩選後剩下的——2330 量到
// 20 期近四季裡 equityMultiplier 在 2024Q1 之前十期全是 null（analysis-ts 的平均分母重算只回溯到那裡，回填中），近 5 年其實只畫
// 2.5 年。所以依「篩選後的筆數」逐基準停用；回填到了選項自己恢復，淺歷史的公司也同樣適用。型別是 number[]（select 收 number[]）。
const DISABLED_WINDOW_YEARS = computed<number[]>(() => LOOKBACK_YEARS.filter(years => ascending.value.length < years * 4))

// 頁面自己的 ref，不用 useMetricHistoryChartWindow()（它的鍵是專用的，一頁的視窗不該動到另一頁）。這裡存的是讀者要的視窗、這一頁
// 永遠不寫它；真正畫的是下面的 effectiveWindow——可用深度會隨基準切換而變（2330：近四季 2.5 年、單季 5 年），夾住 ref 本身會把
// 我們的收窄變成他們的選擇，切回單季就卡在沒選過的窄視窗。
const chartWindow = ref<LookbackWindow>('近5年')

// The widest window at or below the requested one that the data can actually fill. Equal to
// `chartWindow` whenever that is available, which is the normal case.
const effectiveWindow = computed<LookbackWindow>(() => {
  const disabled = DISABLED_WINDOW_YEARS.value
  if (!disabled.includes(LOOKBACK_WINDOW_YEARS[chartWindow.value])) return chartWindow.value
  const widest = [...LOOKBACK_YEARS].reverse().find(years => !disabled.includes(years))
  return widest ? (`近${widest}年` as LookbackWindow) : chartWindow.value
})

const windowedAscending = computed<MetricsHistoryEntry[]>(() => {
  const years = LOOKBACK_WINDOW_YEARS[effectiveWindow.value] ?? 5
  return ascending.value.slice(-years * 4)
})

const valueOf = (metricCode: string): number | null => latest.value?.values[metricCode]?.value ?? null

const roe = computed(() => valueOf('roe'))
const netProfitMargin = computed(() => valueOf('netProfitMargin'))
const taxBurden = computed(() => valueOf('dupontTaxBurden'))
const interestBurden = computed(() => valueOf('dupontInterestBurden'))
const ebitMargin = computed(() => valueOf('dupontEbitMargin'))
const assetTurnover = computed(() => valueOf('assetTurnover'))
const equityMultiplier = computed(() => valueOf('equityMultiplier'))

const hasFactors = computed(() => latest.value !== null)

// 沒有分解的原因有兩種，2026-09-22 之前是一種錯的：空狀態無條件寫「銀行、保險與金控的資產是放款和保單」，因為設計時沒資料的
// 全是金融股（25 檔抽 8 檔）。analysis-ts 重算後覆蓋從 8/15 變 12/15，剩下的 2207 和泰車不是金融股——有資產週轉與權益乘數，三個獲利
// 階段因子 insufficient_history。所以原因從資料讀：金融股根本沒有資產週轉率、歷史淺的公司有它但缺三個因子，兩者都沒有才是一般的
// 「沒有資料」。
const latestRaw = computed(() => {
  const entries = dupontData.value?.series?.entries ?? []
  return entries[entries.length - 1] ?? null
})
const emptyReason = computed<'financial' | 'history' | 'none'>(() => {
  const entry = latestRaw.value
  if (!entry) return 'none'
  if (entry.values.assetTurnover?.value == null) return 'financial'
  return 'history'
})

const periodLabel = (entry: { fiscalYear: number; fiscalQuarter: number | null }): string => (entry.fiscalQuarter === null ? `${entry.fiscalYear} 年` : `${entry.fiscalYear} Q${entry.fiscalQuarter}`)
const latestPeriodText = computed(() => (latest.value ? periodLabel(latest.value) : ''))

const dataSources = computed(() => collectMetricSources(filterSchema.value?.categories ?? [], DUPONT_METRIC_CODES))

// 兩位小數＋明說整條鏈有四捨五入——不用 margins／solvency 那套「讓算術剛好閉合」：這個恆等式是乘積不是加總，相對誤差會沿五個因子
// 累積。2330 實測：後端三個百分比因子已是 2 位，資產週轉與權益乘數是 4 位（0.5505／1.4761），那兩個也印 2 位會讓鏈從差 0.001pp 變
// 差 0.070pp（頁上寫 40.94%、旁邊的數字相乘是 41.01）。印 4 位能閉合但對這群讀者是錯的取捨；財報本身也是這樣處理。
// 三個數值格式化函式在上面 ROE_SERIES 旁邊，它引用其中兩個。

// The five-factor expansion only renders when all three profit-stage factors are there. They are
// the ones that come back `insufficient_history` on a short-history company, so this is checked
// separately from hasFactors rather than folded into it — the three-factor page must stand up
// without them.
const hasExpansion = computed(() =>
  taxBurden.value !== null && interestBurden.value !== null && ebitMargin.value !== null
)

const valueAnswer = computed(() => {
  if (!hasFactors.value) return null
  return joinClauses([
    `${stockShortName.value}（${code.value}）${latestPeriodText.value} 的股東權益報酬率（${basisLabel.value}）為 ${rateText(roe.value)}`,
    `稅後淨利率 ${rateText(netProfitMargin.value)}`,
    `資產週轉率 ${timesText(assetTurnover.value)}`,
    `權益乘數 ${multipleText(equityMultiplier.value)}`
  ])
})

const chainAnswer = computed(() => {
  if (!hasFactors.value) return null
  // 用字精簡（2026-10-07「但我希望用字精簡點。圖表優先 文字其次」）：只留算式
  return `${rateText(netProfitMargin.value)} × ${timesText(assetTurnover.value)} × ${multipleText(equityMultiplier.value)} ≈ ${rateText(roe.value)}。`
})

const expansionAnswer = computed(() => {
  if (!hasExpansion.value) return null
  return `${rateText(taxBurden.value)} × ${rateText(interestBurden.value)} × ${rateText(ebitMargin.value)} ≈ ${rateText(netProfitMargin.value)}。`
})

const historyAnswer = computed(() => {
  const list = periods.value
  if (list.length < 2) return null
  return `${stockShortName.value}共 ${list.length} 期（${periodLabel(list[list.length - 1]!)}～${periodLabel(list[0]!)}，${basisLabel.value}），由新到舊。`
})

const description = computed(() => {
  if (!hasFactors.value) return null
  return clampDescription(joinSentences([valueAnswer.value, historyAnswer.value]) ?? '')
})

const noindex = computed(() => !hasFactors.value)

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '杜邦分析三項拆解 ROE',
  pathSuffix: '/dupont',
  stock,
  summary,
  description,
  noindex,
  sectorCode: computed(() => profile.value?.sectorCode ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="app-page app-page--compact stock-dupont-page">
    <template v-if="stockPending" />
    <SharedStockNotFound v-else-if="!stock" />

    <template v-else>
      <StockSummaryCard :stock="stock" :is-emerging="profile?.isEmerging ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-dupont-value" :question="`${stockShortName}（${code}）的 ROE 由哪三個部分組成？`" :answer="valueAnswer">
        <el-card shadow="never" class="stock-dupont-page__card stock-dupont-page__chart-card">
          <!-- 期別 to the LEFT of the window select inside one corner group, the arrangement
               StockMetricHistoryChartInteractive.vue already established site-wide（「每個卡片
               近五年的左邊要有選項選擇 TTM 或是 單季」）. -->
          <div v-if="hasFactors" class="stock-dupont-page__corner">
            <el-radio-group v-model="basis" aria-label="期別（單季或近四季）">
              <el-radio-button value="TTM">近四季</el-radio-button>
              <el-radio-button value="Q">單季</el-radio-button>
            </el-radio-group>
            <SharedLookbackWindowSelect :model-value="effectiveWindow" :disabled-years="DISABLED_WINDOW_YEARS" @update:model-value="chartWindow = $event" />
          </div>
          <StockMultiSeriesLineChart v-if="hasFactors" :entries="windowedAscending" :series="ROE_SERIES" unit="%" unit-right="倍 / 次" :format="rateText" />
          <p v-else-if="emptyReason === 'financial'" class="stock-dupont-page__line">
            銀行、保險與金控不適用：資產是放款與保單，資產週轉率沒有意義。
          </p>
          <p v-else-if="emptyReason === 'history'" class="stock-dupont-page__line">
            財報期數還不夠，三項裡有一項算不出來；累積夠了就會出現。
          </p>
          <p v-else class="stock-dupont-page__line">
            目前沒有這檔股票的杜邦拆解資料。
          </p>
        </el-card>
      </StockQuestionSection>

      <StockQuestionSection v-if="chainAnswer" id="stock-dupont-chain" question="這三項是怎麼乘成 ROE 的？" :answer="chainAnswer">
        <SharedTableScroll :label="`${stockShortName} ${code} 的杜邦三項拆解`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ stockShortName }} {{ code }} {{ latestPeriodText }} 的 ROE 三項拆解（{{ basisLabel }}）</caption>
            <thead>
              <tr>
                <th scope="col">項目</th>
                <th scope="col">數值</th>
                <th scope="col">意思</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">稅後淨利率</th>
                <td>{{ rateText(netProfitMargin) }}</td>
                <td>每 100 元營收最後留下多少</td>
              </tr>
              <tr>
                <th scope="row">資產週轉率</th>
                <td>{{ timesText(assetTurnover) }}</td>
                <td>資產{{ turnoverPeriodWord }}做出幾倍營收</td>
              </tr>
              <tr>
                <th scope="row">權益乘數</th>
                <td>{{ multipleText(equityMultiplier) }}</td>
                <td>總資產是自有資本的幾倍（槓桿）</td>
              </tr>
              <tr>
                <th scope="row">三項相乘＝ROE</th>
                <td>{{ rateText(roe) }}</td>
                <td>股東每 1 元一年賺回多少</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>

        <p class="stock-answer stock-dupont-page__note">
          ROE 變高可能是更賺錢、資產更有效率，或只是槓桿變大——權益乘數變大不代表本業變強。
        </p>

        <!-- Stated rather than engineered away: rounded factors multiplied together drift from the
             rounded ROE beside them, and a reader who checks with a calculator should find the
             reason on the page instead of finding a contradiction. Smaller with three factors than
             it was with five, but not zero. -->
        <p class="stock-answer stock-dupont-page__rounding">
          數字四捨五入到兩位小數，自己相乘可能和 ROE 差零點零幾。
        </p>

        <!-- The five-factor version, demoted to a closed details on 2026-09-22 rather than deleted:
             it answers the follow-up（「淨利率為什麼動了」）and its data arrives in the same request,
             but it needs three factors that a short-history company doesn't have, so it must never
             be what the page depends on（v-if 仍在：資料不夠的公司整段不出現）。
             2026-10-07 起不摺疊（使用者：「dupont 不摺疊了 都展開吧」），summary 改成小標題。 -->
        <section v-if="expansionAnswer" class="stock-dupont-page__expansion" aria-labelledby="stock-dupont-expansion-title">
          <h3 id="stock-dupont-expansion-title" class="stock-dupont-page__expansion-title">再往下拆：稅後淨利率的三個來源</h3>
          <p class="stock-answer">{{ expansionAnswer }}</p>
          <SharedTableScroll :label="`${stockShortName} ${code} 的稅後淨利率拆解`">
            <table class="seo-table" data-ssr-table>
              <caption>{{ stockShortName }} {{ code }} {{ latestPeriodText }} 的稅後淨利率拆解（{{ basisLabel }}）</caption>
              <thead>
                <tr>
                  <th scope="col">項目</th>
                  <th scope="col">數值</th>
                  <th scope="col">意思</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">稅務負擔</th>
                  <td>{{ rateText(taxBurden) }}</td>
                  <td>繳稅後留下幾成</td>
                </tr>
                <tr>
                  <th scope="row">利息負擔</th>
                  <td>{{ rateText(interestBurden) }}</td>
                  <td>付利息後留下幾成</td>
                </tr>
                <tr>
                  <th scope="row">EBIT 利潤率</th>
                  <td>{{ rateText(ebitMargin) }}</td>
                  <td>每 100 元營收的本業獲利</td>
                </tr>
                <tr>
                  <th scope="row">三項相乘＝稅後淨利率</th>
                  <td>{{ rateText(netProfitMargin) }}</td>
                  <td>每 100 元營收最後留下多少</td>
                </tr>
              </tbody>
            </table>
          </SharedTableScroll>
        </section>

        <p class="stock-answer stock-dupont-page__links">
          相關：<NuxtLink :to="`/stock/${code}/roe`">股東權益報酬率</NuxtLink>、<NuxtLink :to="`/stock/${code}/net-profit-margin`">稅後淨利率</NuxtLink>、<NuxtLink :to="`/stock/${code}/margins`">財報三率</NuxtLink>、<NuxtLink :to="`/stock/${code}/solvency`">安全韌性的組成</NuxtLink>、<NuxtLink :to="`/stock/${code}/income-statement`">損益表</NuxtLink>、<NuxtLink :to="`/stock/${code}/balance-sheet`">資產負債表</NuxtLink>。
        </p>
      </StockQuestionSection>

      <StockQuestionSection v-if="historyAnswer" id="stock-dupont-history" :question="`${stockShortName}的杜邦三項歷年變化如何？`" :answer="historyAnswer">
        <SharedTableScroll :label="`${stockShortName} ${code} 的杜邦三項逐期數據`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ stockShortName }} {{ code }} 逐期的杜邦三項拆解（{{ basisLabel }}，由新到舊）</caption>
            <thead>
              <tr>
                <th scope="col">期別</th>
                <th scope="col">稅後淨利率</th>
                <th scope="col">資產週轉率</th>
                <th scope="col">權益乘數</th>
                <th scope="col">ROE</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in periods" :key="`${entry.fiscalYear}-${entry.fiscalQuarter}`">
                <th scope="row">{{ periodLabel(entry) }}</th>
                <td>{{ rateText(entry.values.netProfitMargin?.value ?? null) }}</td>
                <td>{{ timesText(entry.values.assetTurnover?.value ?? null) }}</td>
                <td>{{ multipleText(entry.values.equityMultiplier?.value ?? null) }}</td>
                <td>{{ rateText(entry.values.roe?.value ?? null) }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
      </StockQuestionSection>

      <StockQuestionSection id="stock-dupont-method" question="杜邦分析是什麼？" >
        <el-card shadow="never" class="stock-dupont-page__card">
          <p class="stock-dupont-page__line">
            把 ROE 拆成稅後淨利率 × 資產週轉率 × 權益乘數，看同樣的 ROE 從哪裡來。名稱來自杜邦公司 1920 年代的管理方法。金融業不適用。
          </p>
          <p v-if="dataSources.length" class="stock-dupont-page__line">資料來源：{{ dataSources.join('、') }}</p>
        </el-card>
      </StockQuestionSection>
    </template>
  </div>
</template>

<style scoped>
.stock-dupont-page__expansion-title {
  margin: 24px 0 8px;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stock-dupont-page__card {
  border-radius: 12px;
}

/* Same top-right placement every stock-detail chart card uses（「請放在卡片右上角」）. */
.stock-dupont-page__chart-card {
  position: relative;
}

.stock-dupont-page__corner {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

/* Out of the overlay and into normal flow at phone width（2026-09-22）. Floating it over the
   chart's top-right corner only works while nothing else is up there; with four legend entries
   the legend wraps and its first row runs underneath the select, which was covering
  「股東權益報酬率（%）」outright. Same element, same markup — a CSS placement swap, not a second
   tree（see the cookie-less layout note in layouts/default.vue）. */
@media (max-width: 600px) {
  .stock-dupont-page__corner {
    position: static;
    margin-bottom: 8px;
  }
}

.stock-dupont-page__line {
  margin: 0 0 8px;
  font-size: 1rem;
  line-height: 1.7;
}

.stock-dupont-page__line:last-child {
  margin-bottom: 0;
}

.stock-dupont-page__note,
.stock-dupont-page__links {
  margin-top: 12px;
}

.stock-dupont-page__rounding {
  margin-top: 12px;
  color: var(--el-text-color-secondary);
}
</style>
