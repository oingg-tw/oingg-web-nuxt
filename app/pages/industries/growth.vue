<script setup lang="ts">
import { use } from 'echarts/core'
import { ScatterChart } from 'echarts/charts'
import { LabelLayout } from 'echarts/features'
import type { SectorGrowthRow, SectorGrowthSummary } from '#shared/types/hub'
// 產業成長座標圖（2026-10-09，使用者核准的產業分析設計第 1 張）：每個點一個證交所類股，X＝營收近四季年增率中位數、
// Y＝淨利近四季年增率中位數，兩條 0 線分出四區，y＝x 對角線回答「成長有沒有變成獲利」——線上方是淨利成長比營收快。
// 形狀照 /industries/dividend：中位數、少於 MIN_SAMPLE 家不畫、點大小＝有值家數、桌機才標籤；逐類股數字在 /industries 的表格。
// 只陳述數字與家數，不排序類股、不標好壞（合規：不做產業排行）。

// 散佈圖只有產業頁用，自己註冊（SharedChart 只註冊共用的零件）。LabelLayout 是 labelLayout（標籤避讓）的必要功能，
// 沒註冊時 moveOverlap／hideOverlap 靜靜失效——/industries/dividend 註解裡「量到完全沒有作用」的原因。
use([ScatterChart, LabelLayout])

const requestUrl = useRequestURL()
useSeoMeta({
  title: '台股類股成長分析：營收與淨利成長座標圖',
  description: '證交所各類股的營收與淨利近四季年增率中位數畫在同一張圖上，對角線以上代表淨利成長比營收快；點的大小是有值的公司數，樣本少於 5 家的類股不畫。'
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}/industries/growth` }] })

const { data: summary } = await useFetch<SectorGrowthSummary | null>('/api/hub/sector-growth-summary', {
  key: 'hub-sector-growth-summary',
  default: () => null
})

const MIN_SAMPLE = 5
// 軸範圍：各軸依資料取整（10 的倍數）再留白，含 0；超過 ±100% 的類股（基期極低時中位數仍可能到上百 %）畫在 ±100 的
// 邊界、改用三角形，tooltip 照寫真實數字。2026-10-09 第一版固定 −50～＋100，實測營收那一軸只用到 −10～＋20，34 個點擠成一團。
const LIMIT = 100
const clamp = (value: number) => Math.min(LIMIT, Math.max(-LIMIT, value))
function axisRange(values: number[]): { min: number; max: number } {
  const clamped = values.map(clamp)
  return { min: Math.floor(Math.min(0, ...clamped) / 10) * 10 - 10, max: Math.ceil(Math.max(0, ...clamped) / 10) * 10 + 10 }
}
const pct = (value: number | null): string => (value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`)

const rows = computed(() => summary.value?.sectors ?? [])
const plotted = computed(() =>
  rows.value.filter(row =>
    row.revenueGrowthRate.count >= MIN_SAMPLE
    && row.netIncomeGrowthRate.count >= MIN_SAMPLE
    && row.revenueGrowthRate.median !== null
    && row.netIncomeGrowthRate.median !== null)
)
const excluded = computed(() => rows.value.filter(row => !plotted.value.includes(row)))

// 四區與對角線的家數——描述分布，不點名排序
const counts = computed(() => {
  let both = 0; let revenueOnly = 0; let profitOnly = 0; let neither = 0; let aboveDiagonal = 0
  for (const row of plotted.value) {
    const x = row.revenueGrowthRate.median as number
    const y = row.netIncomeGrowthRate.median as number
    if (x >= 0 && y >= 0) both++
    else if (x >= 0) revenueOnly++
    else if (y >= 0) profitOnly++
    else neither++
    if (y > x) aboveDiagonal++
  }
  return { both, revenueOnly, profitOnly, neither, aboveDiagonal }
})

const leadAnswer = computed(() => {
  if (!plotted.value.length) return null
  const c = counts.value
  return `圖上 ${plotted.value.length} 個類股裡，營收與淨利中位數都比去年增加的有 ${c.both} 個、只有營收增加的 ${c.revenueOnly} 個、只有淨利增加的 ${c.profitOnly} 個、兩者都減少的 ${c.neither} 個。落在對角線上方、淨利成長比營收快的有 ${c.aboveDiagonal} 個。`
})

const chartAnswer = computed(() => {
  if (!rows.value.length) return null
  const base = `每一個點是一個類股：橫軸是營收近四季年增率的中位數，縱軸是淨利近四季年增率的中位數${summary.value?.fundamentalsDate ? `（財報資料到 ${summary.value.fundamentalsDate}）` : ''}。點的大小是營收年增率有值的公司數。`
  const names = excluded.value.map(row => `${row.name}（營收 ${row.revenueGrowthRate.count} 家、淨利 ${row.netIncomeGrowthRate.count} 家）`)
  return names.length ? `${base}任一軸少於 ${MIN_SAMPLE} 家的類股沒有畫，共 ${names.length} 個：${names.join('、')}。` : base
})

const isDesktop = useIsDesktop()
const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))

interface ScatterParam { data?: { value: [number, number]; row: SectorGrowthRow; clipped: boolean } }

const chartOption = computed(() => {
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  const maxCount = Math.max(1, ...plotted.value.map(row => row.revenueGrowthRate.count))
  const xRange = axisRange(plotted.value.map(row => row.revenueGrowthRate.median as number))
  const yRange = axisRange(plotted.value.map(row => row.netIncomeGrowthRate.median as number))
  // 對角線只畫在兩軸範圍的交集
  const diagonalFrom = Math.max(xRange.min, yRange.min)
  const diagonalTo = Math.min(xRange.max, yRange.max)
  // 手機的圖只有約 262px 高，點縮小（最小 8px，高齡友善規格的標記下限）
  const [baseSize, extraSize] = isDesktop.value ? [10, 22] : [8, 10]
  const axis = (name: string, range: { min: number; max: number }) => ({
    type: 'value',
    name,
    ...range,
    axisLabel: { formatter: (value: number) => `${value}%` }
  })
  return {
    grid: { left: 8, right: 16, top: 32, bottom: 28, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (param: ScatterParam) => {
        const row = param.data?.row
        if (!row) return ''
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${row.name}</div>`
          + `<div>營收年增率中位數 ${pct(row.revenueGrowthRate.median)}（${row.revenueGrowthRate.count} 家）</div>`
          + `<div>淨利年增率中位數 ${pct(row.netIncomeGrowthRate.median)}（${row.netIncomeGrowthRate.count} 家）</div></div>`
      }
    },
    xAxis: { ...axis('營收年增率中位數 %', xRange), nameLocation: 'middle', nameGap: 28 },
    yAxis: { ...axis('淨利年增率中位數 %', yRange), nameTextStyle: { align: 'left' } },
    series: [
      {
        type: 'scatter',
        symbol: (_: unknown, param: ScatterParam) => (param.data?.clipped ? 'triangle' : 'circle'),
        symbolSize: (_: unknown, param: ScatterParam) => baseSize + extraSize * Math.sqrt((param.data?.row.revenueGrowthRate.count ?? 0) / maxCount),
        itemStyle: { color: accent, opacity: 0.75 },
        label: {
          show: isDesktop.value,
          position: 'right',
          fontSize: 16,
          color: chartInk.value.primary,
          formatter: (param: ScatterParam) => param.data?.row.name ?? ''
        },
        // 先把相疊的標籤上下推開，推不開才藏；名字與數字都還在 tooltip 和 /industries 的表格
        labelLayout: { moveOverlap: 'shiftY', hideOverlap: true },
        // 0 線兩條、y＝x 對角線一條（同一個中性墨色，虛線；對角線多一個起訖座標）
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: chartInk.value.baseline, type: 'dashed' },
          data: [
            { xAxis: 0 },
            { yAxis: 0 },
            [{ coord: [diagonalFrom, diagonalFrom] }, { coord: [diagonalTo, diagonalTo] }]
          ]
        },
        data: plotted.value.map(row => {
          const x = row.revenueGrowthRate.median as number
          const y = row.netIncomeGrowthRate.median as number
          return { value: [clamp(x), clamp(y)], row, clipped: clamp(x) !== x || clamp(y) !== y }
        })
      }
    ]
  }
})
</script>

<template>
  <div class="app-page app-page--compact industries-page">
    <h1 class="app-page__title industries-page__title">台股類股成長分析</h1>
    <IndustryNav />

    <section class="stock-page-section" aria-labelledby="industries-growth-heading">
      <h2 id="industries-growth-heading" class="stock-page-section__title">各個類股的營收與獲利在成長嗎？</h2>
      <p v-if="leadAnswer" class="hub-answer">{{ leadAnswer }}</p>
      <p v-if="chartAnswer" class="hub-answer">{{ chartAnswer }}</p>
      <el-card v-if="plotted.length" shadow="never" class="industries-page__card">
        <SharedChart class="app-chart industries-page__chart" :option="chartOption" autoresize aria-label="各類股營收年增率中位數與淨利年增率中位數的散佈圖" />
      </el-card>
    </section>

    <section class="stock-page-section" aria-labelledby="industries-growth-notes-heading">
      <h2 id="industries-growth-notes-heading" class="stock-page-section__title">看這些數字要注意什麼？</h2>
      <p class="hub-answer">每個類股的兩個中位數，在<NuxtLink to="/industries" class="hub-inline-link">產業索引</NuxtLink>那一頁的表格裡。</p>
      <ul class="industries-page__notes">
        <li>對角線以上代表淨利成長比營收快，也就是每一元營收留下的獲利變多；對角線以下則相反。</li>
        <li>兩個年增率都用近四季加總和去年同期比，避開單季的淡旺季。各公司的財報期別不一定相同，這是每家公司各自最新的近四季。</li>
        <li>去年基期接近零或是虧損的公司，年增率會很大或正負號沒有意義；用中位數可以減少這些公司對整個類股的影響。中位數超過 ±100% 的類股畫在 ±100% 的邊界，以三角形表示。</li>
        <li>兩個欄位的家數不一樣，因為各自只算該欄位有值的公司。</li>
      </ul>
      <p class="hub-answer hub-sources industries-page__sources">資料來源：臺灣證券交易所、證券櫃檯買賣中心公開資訊與各公司財報。母體為上市與上櫃普通股，不含興櫃。</p>
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
