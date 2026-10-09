<script setup lang="ts">
import { use } from 'echarts/core'
import { ScatterChart } from 'echarts/charts'
import { LabelLayout } from 'echarts/features'
import type { HubSector, SectorDividendSummaryPageData } from '#shared/types/hub'
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

// 散佈圖只有產業頁用，自己註冊（SharedChart 只註冊共用的零件）。LabelLayout 是標籤避讓（labelLayout）的必要功能。
use([ScatterChart, LabelLayout])

const requestUrl = useRequestURL()
useSeoMeta({
  title: '台股類股殖利率分析：34 個證交所類股的股利地圖',
  description: '證交所 34 個類股的現金殖利率中位數與股利 3 年成長率中位數畫在同一張圖上，點的大小代表家數；樣本少於 5 家的類股不畫，數字另附於產業索引頁。'
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}/industries/dividend` }] })

const { data: sectors } = await useFetch<HubSector[]>('/api/hub/sectors', { key: 'hub-sectors', default: () => [] })
const { data: summary } = await useFetch<SectorDividendSummaryPageData | null>('/api/hub/sector-dividend-summary', {
  key: 'hub-sector-dividend-summary',
  default: () => null
})

// **兩軸都用中位數**（2026-09-30 使用者拍板）。原本 Y 軸指定用平均，我提的論點被接受了：一個點的
// Y 是平均、X 是中位數解釋起來不漂亮，而成長率那一軸非用中位數不可——34 個類股裡有 8 個的 mean
// 與 median 正負號相反（食品、電機機械、建材營造、電腦及週邊設備、電子零組件、其他電子、文化創意、
// 運動休閒），而正負號就是那個軸在講的整句話。mean 欄位上游仍然保留，要換回去不必改規格。
//
// **殖利率含不配息的公司（0% 算進去）**，2026-09-30 改的。證交所從 2026-08-28 起把沒配息的公司
// 從 0.00 改成空白，使用者決定那之後的空白一律當 0，於是上市與上櫃的寫法一致了。所以文案**不能**
// 再寫「配息公司的平均」——實測 34 個類股裡有 31 個的殖利率 count 已經等於 companyCount，而造紙
// 工業的中位數是 0（過半公司不配息），那個 0 是真的不是缺值。
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
    && row.dividendYield.median !== null
    && row.dividendGrowthRate3y.median !== null)
)
const excluded = computed(() => rows.value.filter(row => !plotted.value.includes(row)))

const latestAnswer = computed(() => {
  if (!rows.value.length) return null
  const covered = rows.value.reduce((total, row) => total + row.companyCount, 0)
  return `證交所把上市櫃公司分成 ${rows.value.length} 個類股，共 ${covered.toLocaleString('en-US')} 家。下圖每一個點是一個類股：縱軸是該類股現金殖利率的中位數（${summary.value?.dividendYieldTradeDate ?? ''} 收盤價計算，沒有配息的公司以 0% 計入），橫軸是股利 3 年成長率的中位數。`
})

const chartAnswer = computed(() => {
  if (!rows.value.length) return null
  const names = excluded.value.map(row => `${row.sectorName}（殖利率 ${row.dividendYield.count} 家、成長率 ${row.dividendGrowthRate3y.count} 家）`)
  const base = `點的大小代表該類股殖利率有值的公司數。兩個軸的家數不一樣，因為它們各自算各自有值的公司——殖利率通常整個類股都有值，成長率則要有連續三年的股利紀錄才算得出來。`
  return names.length
    ? `${base}任一軸少於 ${MIN_SAMPLE} 家的類股沒有畫進圖裡，共 ${names.length} 個：${names.join('、')}。它們的數字仍然在下面的表格裡。`
    : base
})

// 標籤只在寬畫面顯示。實測（2026-09-30，30 個點、圖高 640px）：1440px 有 8 組標籤互相重疊、
// 375px 有 31 組——手機上的散佈圖標籤沒有解，字級又有 16px 下限不能縮。所以窄畫面只畫點，名字
// 靠底下那張表。當時量到 labelLayout.hideOverlap「完全沒有作用」，2026-10-09 查出原因：按需載入的
// ECharts 要另外註冊 LabelLayout 功能，否則 labelLayout 靜靜失效。現在已註冊，桌機的標籤會推開或隱藏。
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
    grid: { left: 8, right: 16, top: 24, bottom: 28, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (param: ScatterParam) => {
        const row = param.data?.row
        if (!row) return ''
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${row.sectorName}</div>`
          + `<div>殖利率中位數 ${yieldText(row.dividendYield.median)}（${row.dividendYield.count} 家）</div>`
          + `<div>股利 3 年成長率中位數 ${growthText(row.dividendGrowthRate3y.median)}（${row.dividendGrowthRate3y.count} 家）</div>`
          + `<div style="color:${CHART_TOOLTIP_INK.secondary}">類股共 ${row.companyCount} 家</div></div>`
      }
    },
    xAxis: {
      type: 'value',
      name: '股利 3 年成長率中位數 %',
      nameLocation: 'middle',
      nameGap: 28,
      axisLabel: { formatter: (value: number) => `${value}%` }
    },
    yAxis: {
      type: 'value',
      name: '殖利率中位數 %',
      // 靠左對齊：預設的 nameLocation 'end' 把軸名放在頂端置中，實測它會飄在圖的正上方、看起來
      // 不像屬於 Y 軸。
      nameTextStyle: { align: 'left' },
      axisLabel: { formatter: (value: number) => `${value}%` }
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
        // 34 個標籤一定會互相壓到：先上下推開，推不開才藏；完整數字在 tooltip 與產業索引的表格裡。
        labelLayout: { moveOverlap: 'shiftY', hideOverlap: true },
        data: plotted.value.map(row => ({
          value: [row.dividendGrowthRate3y.median as number, row.dividendYield.median as number],
          row
        }))
      }
    ]
  }
})

</script>

<template>
  <div class="app-page app-page--compact industries-page">
    <h1 class="app-page__title industries-page__title">台股類股殖利率分析</h1>
    <IndustryNav />

    <section class="stock-page-section" aria-labelledby="industries-overview-heading">
      <h2 id="industries-overview-heading" class="stock-page-section__title">各個類股的殖利率與股利成長長什麼樣？</h2>
      <p v-if="latestAnswer" class="hub-answer">{{ latestAnswer }}</p>
      <p v-if="chartAnswer" class="hub-answer">{{ chartAnswer }}</p>
      <el-card v-if="plotted.length" shadow="never" class="industries-page__card">
        <SharedChart class="app-chart industries-page__chart" :option="chartOption" autoresize aria-label="各類股殖利率中位數與股利三年成長率中位數的散佈圖" />
      </el-card>
    </section>

    <section class="stock-page-section" aria-labelledby="industries-notes-heading">
      <h2 id="industries-notes-heading" class="stock-page-section__title">看這些數字要注意什麼？</h2>
      <p class="hub-answer">每個類股的逐項數字、公司家數與各自的公司一覽表，在<NuxtLink to="/industries" class="hub-inline-link">產業索引</NuxtLink>那一頁。</p>
      <ul class="industries-page__notes">
        <li>殖利率把沒有配息的公司以 0% 計入。證交所從 2026-08-28 起把沒配息的公司從 0.00 改成空白，這裡一律當 0，所以上市與上櫃的算法一致。中位數是 0 代表該類股過半公司沒有配息。</li>
        <li>兩個欄位的家數不一樣，因為各自只算該欄位有值的公司。公司家數不是平均或中位數的分母，拿它反推總額會算錯。</li>
        <li>股利 3 年成長率全市場約 57% 的公司有值，缺的多半是 111–112 年的季現金流量表還沒有資料（例如瓦斯類公司都從 113 年開始），不是計算失敗。</li>
        <li>兩欄都用中位數。成長率有極端值，34 個類股裡有 8 個的平均與中位數正負號相反，而正負號就是這個欄位在講的事。</li>
      </ul>
      <p class="hub-answer hub-sources industries-page__sources">資料來源：臺灣證券交易所、證券櫃檯買賣中心公開資訊，以及各公司股利分派公告。母體為上市與上櫃普通股，不含興櫃。</p>
    </section>
  </div>
</template>

<style scoped>

.industries-page__title {
  font-weight: 600;
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

</style>
