<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import type { HubSector, SectorDividendSummaryPageData } from '#shared/types/hub'
import { getAccentColor, getChartInk, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

// 產業追蹤 — RETIRED the supply-chain tree 2026-09-20: analysis-ts hard-deleted GET
// /industries/chain-tree (and chain-clusters, chain-classification) with no replacement (commit
// a7489d65, a compliance call). What was left was a search box over the 36 sector names plus a
// chip list, which materially overlapped /stock's own sector table — flagged then for a follow-up.
//
// 2026-09-30 這一頁變成**產業索引**（「menubar 要有地方可以選產業…點下去以後，才攤開每個產業的
// 統計資料」「會有一個頁面作為各個產業的索引」）：一張散佈圖把 34 個類股放在同一個座標上，底下
// 一張逐類股的數字表。跟 /stock 的重疊也解掉了——那一頁是「哪些公司屬於哪個類股」的目錄，這一頁
// 是「這些類股的股利長什麼樣」。
//
// 未註冊的 ECharts 系列型別不會丟錯，只是靜靜不畫（本站踩過），所以 ScatterChart 要顯式註冊。
use([SVGRenderer, ScatterChart, GridComponent, TooltipComponent])

const requestUrl = useRequestURL()
useSeoMeta({
  title: '台股產業索引：34 個證交所類股的殖利率與股利成長',
  description: '證交所 34 個類股各自的配息公司平均殖利率與股利 3 年成長率中位數，畫在同一張圖上，附逐類股數據表；點類股名稱看該類股公司的股價、本益比、殖利率與 ROE 一覽表。'
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}/industries` }] })

const { data: sectors } = await useFetch<HubSector[]>('/api/hub/sectors', { key: 'hub-sectors', default: () => [] })
const { data: summary } = await useFetch<SectorDividendSummaryPageData | null>('/api/hub/sector-dividend-summary', {
  key: 'hub-sector-dividend-summary',
  default: () => null
})

// 兩軸的統計量不同，而且是刻意的：
//   Y（殖利率）用**平均**——直接指示。
//   X（股利 3 年成長率）用**中位數**——兩個後端各自獨立建議同一件事，理由也一樣：成長率有極端值，
//     而 mean 與 median 在 34 個類股裡有 8 個正負號相反（實測 2026-09-30：食品、電機機械、建材營造、
//     電腦及週邊設備、電子零組件、其他電子、文化創意、運動休閒）。那個正負號就是這個軸要講的整句話
//     （配息在成長還是在縮），用 mean 會對其中 8 個給出相反的結論。
//
// 這個不對稱本身值得記一筆：一個點的 Y 是平均、X 是中位數，解釋起來不漂亮。我已經把「兩軸都用
// 中位數」的論點送到使用者面前，在他改變指定之前照指定做。
const MIN_SAMPLE = 5
const yieldText = (value: number | null): string => (value === null ? '—' : `${value.toFixed(2)}%`)
const growthText = (value: number | null): string => (value === null ? '—' : `${value.toFixed(1)}%`)

const rows = computed(() => summary.value?.sectors ?? [])

// 任一軸 n < 5 就不畫（analysis-ts 建議，bff-ts 建議 10）。取 5 的理由與取捨都是量出來的：
// n≥5 留 30 個、n≥10 留 24、n≥20 留 19、n≥30 留 13。5 保住 30 個類股，而低樣本的點用點大小
// 明顯地弱化，而不是讓 2 家公司的點看起來跟 161 家一樣可信——那是 bff-ts 的顧慮，點大小處理掉了。
//
// **5 是判斷不是有出處的統計標準**（analysis-ts 自己標註的）：n<5 時中位數只要一家公司變動就會
// 大幅位移，平均更敏感。門檻放前端常數，API 不加 plottable 欄位，要調就改這裡。
const plotted = computed(() =>
  rows.value.filter(row =>
    row.dividendYield.count >= MIN_SAMPLE
    && row.dividendGrowthRate3y.count >= MIN_SAMPLE
    && row.dividendYield.mean !== null
    && row.dividendGrowthRate3y.median !== null)
)
const excluded = computed(() => rows.value.filter(row => !plotted.value.includes(row)))

const latestAnswer = computed(() => {
  if (!rows.value.length) return null
  const covered = rows.value.reduce((total, row) => total + row.companyCount, 0)
  return `證交所把上市櫃公司分成 ${rows.value.length} 個類股，共 ${covered.toLocaleString('en-US')} 家。下圖每一個點是一個類股：縱軸是該類股有配息公司的平均現金殖利率（${summary.value?.dividendYieldTradeDate ?? ''} 收盤價計算），橫軸是股利 3 年成長率的中位數。`
})

const chartAnswer = computed(() => {
  if (!rows.value.length) return null
  const names = excluded.value.map(row => `${row.sectorName}（殖利率 ${row.dividendYield.count} 家、成長率 ${row.dividendGrowthRate3y.count} 家）`)
  const base = `點的大小代表該類股殖利率有值的公司數。兩個軸的家數不一樣，因為它們各自算各自有值的公司——例如半導體業 206 家裡，殖利率有值 161 家、成長率有值 120 家。`
  return names.length
    ? `${base}任一軸少於 ${MIN_SAMPLE} 家的類股沒有畫進圖裡，共 ${names.length} 個：${names.join('、')}。它們的數字仍然在下面的表格裡。`
    : base
})

// 標籤只在寬畫面顯示。實測（2026-09-30，30 個點、圖高 640px）：1440px 有 8 組標籤互相重疊、
// 375px 有 31 組——手機上的散佈圖標籤沒有解，字級又有 16px 下限不能縮。所以窄畫面只畫點，名字
// 靠底下那張表；ECharts 的 labelLayout.hideOverlap 在這裡量到完全沒有作用（開與不開都是 26 個
// 標籤、16 組重疊），所以不靠它。
//
// 這是**圖表選項**不是版面標記，所以不牴觸「不要用 isWide 在渲染時挑 markup」那條——選項變了
// ECharts 自己重繪，沒有 hydration 的問題。useIsDesktop 本身也是 SSR 先給 false、掛載後才校正。
const isDesktop = useIsDesktop()

const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))

interface ScatterParam { data?: { value: [number, number]; row: (typeof rows)['value'][number] } }

const chartOption = computed(() => {
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  const maxCount = Math.max(1, ...plotted.value.map(row => row.dividendYield.count))
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { left: 8, right: 16, top: 24, bottom: 28, containLabel: true },
    tooltip: {
      trigger: 'item',
      appendTo: 'body',
      backgroundColor: CHART_TOOLTIP.backgroundColor,
      borderColor: CHART_TOOLTIP.borderColor,
      textStyle: { color: CHART_TOOLTIP_INK.primary },
      formatter: (param: ScatterParam) => {
        const row = param.data?.row
        if (!row) return ''
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${row.sectorName}</div>`
          + `<div>平均殖利率 ${yieldText(row.dividendYield.mean)}（${row.dividendYield.count} 家）</div>`
          + `<div>股利 3 年成長率中位數 ${growthText(row.dividendGrowthRate3y.median)}（${row.dividendGrowthRate3y.count} 家）</div>`
          + `<div style="color:${CHART_TOOLTIP_INK.secondary}">類股共 ${row.companyCount} 家</div></div>`
      }
    },
    xAxis: {
      type: 'value',
      name: '股利 3 年成長率中位數 %',
      nameLocation: 'middle',
      nameGap: 28,
      nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
      axisLine: { lineStyle: { color: chartInk.value.baseline } },
      splitLine: { lineStyle: { color: chartInk.value.gridline } },
      axisLabel: { color: chartInk.value.muted, fontSize: 16, formatter: (value: number) => `${value}%` }
    },
    yAxis: {
      type: 'value',
      name: '平均殖利率 %',
      // 靠左對齊：預設的 nameLocation 'end' 把軸名放在頂端置中，實測它會飄在圖的正上方、看起來
      // 不像屬於 Y 軸。
      nameTextStyle: { color: chartInk.value.muted, fontSize: 16, align: 'left' },
      axisLine: { lineStyle: { color: chartInk.value.baseline } },
      splitLine: { lineStyle: { color: chartInk.value.gridline } },
      axisLabel: { color: chartInk.value.muted, fontSize: 16, formatter: (value: number) => `${value}%` }
    },
    series: [
      {
        type: 'scatter',
        // 點大小＝殖利率那一軸的家數，開根號後映射，讓 161 家不會大到蓋掉旁邊的點。最小 10px
        // 仍然高於高齡友善規格對標記的 8px 下限。
        symbolSize: (_: unknown, param: ScatterParam) => {
          const count = param.data?.row.dividendYield.count ?? 0
          return 10 + 22 * Math.sqrt(count / maxCount)
        },
        itemStyle: { color: accent, opacity: 0.75 },
        label: {
          show: isDesktop.value,
          position: 'right',
          fontSize: 16,
          color: chartInk.value.primary,
          formatter: (param: ScatterParam) => param.data?.row.sectorName ?? ''
        },
        // 34 個標籤一定會互相壓到——讓 ECharts 自己把壓到的藏起來，剩下的仍然標得出來；
        // 每一個點的完整數字在 tooltip 與下面的表格裡，所以藏掉標籤不會少掉資訊。
        // 先試著把壓到的標籤上下推開（moveOverlap），推不開才藏（hideOverlap）。只用 hideOverlap
        // 時實測 30 個點只剩 23 個標籤，而且右側密集區仍然有幾組疊在一起。
        data: plotted.value.map(row => ({
          value: [row.dividendGrowthRate3y.median as number, row.dividendYield.mean as number],
          row
        }))
      }
    ]
  }
})

const keyword = ref('')
const filteredRows = computed(() => {
  const trimmed = keyword.value.trim()
  if (!trimmed) return rows.value
  return rows.value.filter(row => row.sectorName.includes(trimmed))
})

const pathFor = (code: string) => sectorPath(code) ?? '/stock'
</script>

<template>
  <div class="industries-page">
    <h1 class="industries-page__title">台股產業索引</h1>

    <section class="stock-page-section" aria-labelledby="industries-overview-heading">
      <h2 id="industries-overview-heading" class="stock-page-section__title">各個類股的殖利率與股利成長長什麼樣？</h2>
      <p v-if="latestAnswer" class="hub-answer">{{ latestAnswer }}</p>
      <p v-if="chartAnswer" class="hub-answer">{{ chartAnswer }}</p>
      <el-card v-if="plotted.length" shadow="never" class="industries-page__card">
        <SharedChart class="industries-page__chart" :option="chartOption" autoresize />
      </el-card>
    </section>

    <section class="stock-page-section" aria-labelledby="industries-table-heading">
      <h2 id="industries-table-heading" class="stock-page-section__title">每個類股的數字是多少？</h2>
      <el-input v-model="keyword" class="industries-page__search" placeholder="搜尋類股名稱，例如 半導體" clearable />
      <SharedTableScroll label="各證交所類股的公司家數、平均殖利率與股利成長率">
        <table class="seo-table" data-ssr-table>
          <caption>證交所類股的股利統計（殖利率為{{ summary?.dividendYieldTradeDate ?? '' }}收盤價計算）</caption>
          <thead>
            <tr>
              <th scope="col">類股</th>
              <th scope="col">公司家數</th>
              <th scope="col">平均殖利率</th>
              <th scope="col">殖利率有值家數</th>
              <th scope="col">股利 3 年成長率中位數</th>
              <th scope="col">成長率有值家數</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRows" :key="row.sectorCode">
              <th scope="row"><NuxtLink :to="pathFor(row.sectorCode)">{{ row.sectorName }}</NuxtLink></th>
              <td>{{ row.companyCount }}</td>
              <td>{{ yieldText(row.dividendYield.mean) }}</td>
              <td>{{ row.dividendYield.count }}</td>
              <td>{{ growthText(row.dividendGrowthRate3y.median) }}</td>
              <td>{{ row.dividendGrowthRate3y.count }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <SharedEmptyState v-if="!filteredRows.length" description="沒有符合的類股名稱" />
    </section>

    <section class="stock-page-section" aria-labelledby="industries-notes-heading">
      <h2 id="industries-notes-heading" class="stock-page-section__title">看這些數字要注意什麼？</h2>
      <ul class="industries-page__notes">
        <li>殖利率只統計有配息的公司。上市與上櫃對「沒有配息」的記法不同，一邊是空值、一邊是 0，所以這裡的平均是「有配息公司的平均」，不是全類股平均。</li>
        <li>兩個欄位的家數不一樣，因為各自只算該欄位有值的公司。公司家數不是平均或中位數的分母，拿它反推總額會算錯。</li>
        <li>股利 3 年成長率全市場約 57% 的公司有值，缺的多半是 111–112 年的季現金流量表還沒有資料（例如瓦斯類公司都從 113 年開始），不是計算失敗。</li>
        <li>殖利率用平均、成長率用中位數。成長率有極端值，34 個類股裡有 8 個的平均與中位數正負號相反，而正負號就是這個欄位在講的事。</li>
      </ul>
      <p class="hub-answer industries-page__sources">資料來源：臺灣證券交易所、證券櫃檯買賣中心公開資訊，以及各公司股利分派公告。母體為上市與上櫃普通股，不含興櫃。</p>
    </section>
  </div>
</template>

<style scoped>
.industries-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.industries-page__title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.industries-page__chart {
  width: 100%;
  height: 640px;
}

.industries-page__search {
  max-width: 360px;
  margin-bottom: 12px;
}

.industries-page__notes {
  margin: 0;
  padding-left: 1.2em;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.industries-page__sources {
  margin-top: 16px;
  color: var(--el-text-color-secondary);
}
</style>
