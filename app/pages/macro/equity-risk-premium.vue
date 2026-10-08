<script setup lang="ts">
import type { EquityRiskPremiumPageData } from '#shared/types/hub'
import { clampDescription } from '~/utils/stock-digest'
import { getAccentColor, getChartInk, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

// /macro/equity-risk-premium — 股票風險溢酬（2026-09-29, analysis-ts 轉達的需求）.
//
// 這一頁不給一個數字，給的是**同一個問題的兩種算法擺在一起**，因為那個差距才是內容。上游建議做成
// 讀者可以切換窗口長度、自己發現「短窗口會被單一段行情拉高」；我改成四個窗口一次並排，理由是
// 現象要靠並排才看得出來——一次只看一個窗口的讀者不知道自己看到的是哪一種，而那正是這一頁想防的
// 誤讀。副作用是整頁都是 SSR，沒有互動狀態要維護。
//
// 上游 warnings 不原樣渲染：它的可信度提醒裡寫著「遠高於文獻常見的…合理區間」，而「合理」是本站的
// 禁用詞（shared/utils/compliance-words.ts），照抄會讓 check-hub-pages 直接 FAIL。同樣的事實由本頁
// 自己用中性的話講：窗口越短，歷史法越容易被單一段行情主導。
//
// 未註冊的 ECharts 元件不會丟錯，只是靜靜不畫——BarChart 是這一頁需要而央行那兩頁沒有的。

const { data, error } = await useFetch<EquityRiskPremiumPageData>('/api/hub/macro-equity-risk-premium', { key: 'hub-macro-equity-risk-premium' })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '股票風險溢酬資料暫時無法取得', fatal: true })

const windows = computed(() => data.value?.windows ?? [])
const components = computed(() => data.value?.components ?? null)
const full = computed(() => windows.value[0] ?? null)

// null 是「沒有數字」不是 0：supplySide 整塊或 erp 本身都可能是 null（上游在市值覆蓋率不足時不算）。
const pct = (value: number | null | undefined): string => (value === null || value === undefined ? '—' : `${value.toFixed(2)}%`)
const yearsText = (months: number): string => `約 ${(months / 12).toFixed(1)} 年`

const latestAnswer = computed(() => {
  const window = full.value
  if (!window) return null
  return `以 ${window.windowStart} 到 ${window.windowEnd}（${window.months} 個月，${yearsText(window.months)}）計算，歷史法的股票風險溢酬是 ${pct(window.erpGeometric)}（幾何平均）或 ${pct(window.erpArithmetic)}（算術平均），供給面模型是 ${pct(window.supplySideErp)}。`
})

const spanAnswer = computed(() => {
  if (windows.value.length < 2) return null
  const shortest = windows.value[windows.value.length - 1]!
  const window = full.value
  if (!window) return null
  return `下圖是同樣兩種算法在四個窗口長度下的結果。歷史法從 ${pct(window.erpGeometric)}（${yearsText(window.months)}）變到 ${pct(shortest.erpGeometric)}（${yearsText(shortest.months)}），供給面模型從 ${pct(window.supplySideErp)} 變到 ${pct(shortest.supplySideErp)}。窗口越短，歷史法越容易被單一段行情主導；供給面模型的四個組成來自通膨、成長、股利殖利率與無風險利率，不直接反映那段期間的漲跌。`
})

const componentsAnswer = computed(() => {
  const parts = components.value
  const window = full.value
  if (!parts || !window) return null
  return `供給面模型把股票的長期報酬拆成四項，再減掉無風險利率：${pct(parts.expectedInflation)}（預期通膨）加 ${pct(parts.realEarningsGrowth)}（實質盈餘成長）加 ${pct(parts.dividendYield)}（股利殖利率）加 ${pct(parts.peGrowth)}（本益比成長）減 ${pct(parts.riskFreeRate)}（無風險利率），得到 ${pct(window.supplySideErp)}。`
})

// dividendYieldMarketCapCoverage 2026-09-30 起**不再顯示**：證交所把不配息公司的殖利率從 0.00
// 改成空白、上游把空白讀成 0 之後，這個欄位永遠是 100（實測 98.3966 → 100）。它看起來像「資料
// 修好了」，其實是母體定義變了——當成「殖利率資料齊不齊」的健康指標會永遠報平安。欄位還在回應
// 裡，只是不印在畫面上。
const { breadcrumbs } = useHubPageSeo({
  title: '台股股票風險溢酬：兩種算法對照',
  description: () => clampDescription(latestAnswer.value ?? '台股股票風險溢酬的歷史法與供給面模型結果，四個窗口長度並排，附供給面模型的四個組成。'),
  path: '/macro/equity-risk-premium',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '總經特區', to: '/macro' },
    { label: '股票風險溢酬', to: '/macro/equity-risk-premium' }
  ]
})

const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))

interface AxisTooltipParam { dataIndex?: number }

// 分組柱狀圖，兩組：歷史法（幾何）與供給面。算術平均不進圖——它跟幾何平均永遠同向且差距固定來自
// 波動度，第三根柱子只會讓「兩種算法」這件事變成「三種」。它在下面的表格裡。
const chartOption = computed(() => {
  const list = windows.value
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  return {
    grid: { left: 8, right: 8, top: 48, bottom: 28, containLabel: true },
    legend: { top: 0 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
        const index = (Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0
        const window = list[index]
        if (!window) return ''
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${window.label}（${window.windowStart} ～ ${window.windowEnd}）</div>`
          + `<div>歷史法（幾何） ${pct(window.erpGeometric)}</div>`
          + `<div>歷史法（算術） ${pct(window.erpArithmetic)}</div>`
          + `<div>供給面模型 ${pct(window.supplySideErp)}</div>`
          + `<div style="color:${CHART_TOOLTIP_INK.secondary}">${window.months} 個月</div>`
          + '</div>'
      }
    },
    xAxis: {
      type: 'category',
      data: list.map(window => window.label),
    },
    yAxis: {
      type: 'value',
      name: '%',
      axisLabel: { formatter: (value: number) => `${value}%` }
    },
    series: [
      {
        name: '歷史法（幾何平均）',
        type: 'bar',
        itemStyle: { color: accent },
        data: list.map(window => window.erpGeometric)
      },
      {
        name: '供給面模型',
        type: 'bar',
        itemStyle: { color: chartInk.value.primary },
        data: list.map(window => window.supplySideErp)
      }
    ]
  }
})
</script>

<template>
  <div class="macro-erp-page">
    <h1 class="macro-erp-page__title">台股股票風險溢酬：兩種算法對照</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <MacroNav />

    <section class="stock-page-section" aria-labelledby="macro-erp-latest-heading">
      <h2 id="macro-erp-latest-heading" class="stock-page-section__title">股票比公債多賺多少？</h2>
      <p v-if="latestAnswer" class="hub-answer">{{ latestAnswer }}</p>
      <p class="hub-answer">歷史法是加權股價指數實際的年化報酬，減掉同期 10 年期公債的平均殖利率——回頭看那段期間實際發生了什麼。供給面模型照 Ibbotson &amp; Chen（2003）的做法，把股票報酬拆成通膨、實質盈餘成長、股利殖利率與本益比成長，再減掉無風險利率——從經濟的基本面推算。兩者算的是同一件事，方法不同。</p>
    </section>

    <section class="stock-page-section" aria-labelledby="macro-erp-window-heading">
      <h2 id="macro-erp-window-heading" class="stock-page-section__title">為什麼窗口長度會改變答案？</h2>
      <p v-if="spanAnswer" class="hub-answer">{{ spanAnswer }}</p>
      <el-card shadow="never" class="macro-erp-page__card">
        <SharedChart v-if="windows.length > 1" class="macro-erp-page__chart" :option="chartOption" autoresize />
      </el-card>
      <SharedTableScroll label="四個窗口長度的股票風險溢酬">
        <table class="seo-table" data-ssr-table>
          <caption>四個窗口長度的股票風險溢酬（窗口終點相同，起點不同）</caption>
          <thead>
            <tr>
              <th scope="col">窗口</th>
              <th scope="col">期間</th>
              <th scope="col">月數</th>
              <th scope="col">歷史法（幾何）</th>
              <th scope="col">歷史法（算術）</th>
              <th scope="col">供給面模型</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="window in windows" :key="window.label">
              <th scope="row">{{ window.label }}</th>
              <td>{{ window.windowStart }} ～ {{ window.windowEnd }}</td>
              <td>{{ window.months }}</td>
              <td>{{ pct(window.erpGeometric) }}</td>
              <td>{{ pct(window.erpArithmetic) }}</td>
              <td>{{ pct(window.supplySideErp) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </section>

    <section class="stock-page-section" aria-labelledby="macro-erp-components-heading">
      <h2 id="macro-erp-components-heading" class="stock-page-section__title">供給面模型是怎麼拆出來的？</h2>
      <p v-if="componentsAnswer" class="hub-answer">{{ componentsAnswer }}</p>
      <SharedTableScroll label="供給面模型的組成">
        <table v-if="components" class="seo-table" data-ssr-table>
          <caption>供給面模型的四個組成與無風險利率（完整窗口）</caption>
          <thead>
            <tr>
              <th scope="col">項目</th>
              <th scope="col">數值</th>
              <th scope="col">怎麼取得</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">預期通膨</th>
              <td>{{ pct(components.expectedInflation) }}</td>
              <td>窗口內消費者物價指數年增率的平均</td>
            </tr>
            <tr>
              <th scope="row">實質盈餘成長</th>
              <td>{{ pct(components.realEarningsGrowth) }}</td>
              <td>以實質 GDP 成長率近似</td>
            </tr>
            <tr>
              <th scope="row">股利殖利率</th>
              <td>{{ pct(components.dividendYield) }}</td>
              <td>上市公司市值加權，{{ components.dividendYieldTradeDate ?? '最新交易日' }} 共 {{ components.dividendYieldCompanyCount ?? '—' }} 家</td>
            </tr>
            <tr>
              <th scope="row">本益比成長</th>
              <td>{{ pct(components.peGrowth) }}</td>
              <td>固定為 0：估值擴張不是公司供給出來的報酬</td>
            </tr>
            <tr>
              <th scope="row">無風險利率</th>
              <td>{{ pct(components.riskFreeRate) }}</td>
              <td>窗口終點的 10 年期公債殖利率</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <ul class="macro-erp-page__limits">
        <li>台灣沒有抗通膨公債，所以預期通膨是用同期實際通膨代替，不是市場對未來通膨的報價。</li>
        <li>盈餘成長長期會因為新股發行稀釋而低於 GDP 成長，所以這一項可能被高估。</li>
        <li>股利殖利率只有最新一天的資料。表上其他窗口的供給面數字，殖利率那一項用的仍是最新交易日，跟該窗口的終點不是同一個時間點。</li>
      </ul>
      <p class="hub-answer macro-erp-page__sources">資料來源：臺灣證券交易所加權股價指數與上市公司股利殖利率、中央銀行 10 年期公債殖利率、行政院主計總處消費者物價指數與國內生產毛額。模型依 Ibbotson, R. G. &amp; Chen, P. (2003), Long-Run Stock Returns: Participating in the Real Economy, Financial Analysts Journal 59(1)。</p>
    </section>
  </div>
</template>

<style scoped>
.macro-erp-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.macro-erp-page__title {
  margin: 0;
  font-size: 1.5rem;
}

.macro-erp-page__chart {
  width: 100%;
  height: 380px;
}

.macro-erp-page__limits {
  margin: 16px 0 0;
  padding-left: 1.2em;
  color: var(--el-text-color-secondary);
}

.macro-erp-page__limits li + li {
  margin-top: 8px;
}

.macro-erp-page__sources {
  margin-top: 16px;
  color: var(--el-text-color-secondary);
}
</style>
