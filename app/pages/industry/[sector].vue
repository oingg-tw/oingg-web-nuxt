<script setup lang="ts">
import { use } from 'echarts/core'
import { ScatterChart } from 'echarts/charts'
import type { HubSector, IndustryPageData, SectorStat } from '#shared/types/hub'
// /industry/{code}-{slug} — one 證交所類股's company table (2026-09-19, the SEO build): every
// company the screener has fundamentals for, with the day's price/PE/PB/殖利率 and 近四季 ROE /
// 單季負債比率, plus the sector's distribution (median/quartiles) and the listed members that have
// no screener row yet. Answers「半導體業有哪些上市櫃公司？」— a query no page on this site could
// answer before — and gives every stock page a sector-level parent in its breadcrumb.
//
// URL rules: the code is the exchange's own two-digit sector code and the slug is this app's
// (shared/utils/hub-slugs.ts); a valid code with a stale slug 301s to the canonical path, an
// unknown code or an empty sector is a real 404 (never an empty 200). Fewer than 5 ranked rows →
// `noindex, follow`: still useful to a person, too thin to be worth an index entry.
//
// Wording is the compliance register: counts, medians and quartiles, no adjectives. Column
// sorting is not offered here on purpose — the table is a static reference sorted by 代號 and
// sort state must never become a URL variant; the screener（/screener?sector=NN）is where you
// sort and filter.
// 散佈圖只有產業兩頁用，自己註冊（SharedChart 只註冊共用的零件）
use([ScatterChart])

const INDEXABLE_ROW_FLOOR = 5

const route = useRoute()
const parsed = parseSectorParam(String(route.params.sector))
const known = parsed ? SECTORS[parsed.code] : undefined
if (!parsed || !known) throw createError({ statusCode: 404, statusMessage: '找不到這個類股', fatal: true })
if (parsed.slug !== known.slug) await navigateTo(sectorPath(parsed.code) ?? '/stock', { redirectCode: 301 })

const code = parsed.code
const sectorName = known.name
const canonicalPath = sectorPath(code) ?? '/stock'

const { data, error } = await useFetch<IndustryPageData>(`/api/hub/industry/${code}`, { key: `hub-industry-${code}` })
if (error.value?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: '這個類股目前沒有任何公司', fatal: true })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '類股資料暫時無法取得', fatal: true })
const { data: sectors } = await useFetch<HubSector[]>('/api/hub/sectors', { key: 'hub-sectors', default: () => [] })

const rows = computed(() => data.value?.companies.rows ?? [])
const stats = computed(() => data.value?.companies.stats ?? null)
const unranked = computed(() => data.value?.unranked ?? [])
const catalogCount = computed(() => data.value?.sector.companyCount ?? 0)
const quoteDate = computed(() => data.value?.companies.quoteDate ?? null)

// 公司版散佈圖（2026-10-01「每個產業的個別瀏覽頁 要做」）。軸跟 /industries/dividend 的類股版一樣
// ——X 股利 3 年成長率、Y 現金殖利率——所以從總覽點進來看到的是**同一張圖換一個層級**，不是另一
// 種圖。
//
// 沒有多一次請求：`dividendGrowthRate3y.FY` 是加在既有那一次 screener POST 的 columns 上的
// （server/utils/hub-data.ts 的 SECTOR_COLUMNS）。
//
// 兩軸都有值才畫。實測半導體業 206 家裡 120 家有成長率——那不是錯誤，全市場只有約 57% 的公司有
// 連續三年的股利紀錄。畫不出來的家數要講出來，否則讀者會以為圖上就是全部。
//
// 不標公司名：一個類股最多 200 多個點，標籤沒有任何排法不會糊掉（類股版 34 個點在 375px 就已經
// 有 31 組重疊）。名字在 tooltip 與下面的表格裡。

const scatterRows = computed(() =>
  rows.value.filter(row => row.dividendYield !== null && row.dividendGrowthRate3y !== null)
)

const scatterAnswer = computed(() => {
  if (!rows.value.length) return null
  return `下圖每一個點是一家公司：橫軸是股利 3 年成長率，縱軸是現金殖利率。${rows.value.length} 家裡有 ${scatterRows.value.length} 家兩個數字都有，其餘的沒有連續三年的股利紀錄，算不出成長率。沒有配息的公司殖利率計為 0%。`
})

const { resolvedMode, color: accentColorName } = useAppTheme()

interface ScatterParam { data?: { row: (typeof scatterRows)['value'][number] } }

const scatterOption = computed(() => ({
  grid: { left: 8, right: 16, top: 24, bottom: 28, containLabel: true },
  tooltip: {
    trigger: 'item',
    formatter: (param: ScatterParam) => {
      const row = param.data?.row
      if (!row) return ''
      return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${row.symbol} ${row.name}</div>`
        + `<div>${row.dividendYield === 0 ? NO_DIVIDEND_TEXT : `現金殖利率 ${row.dividendYield?.toFixed(2)}%`}</div>`
        + `<div>股利 3 年成長率 ${row.dividendGrowthRate3y?.toFixed(1)}%</div></div>`
    }
  },
  xAxis: {
    type: 'value',
    name: '股利 3 年成長率 %',
    nameLocation: 'middle',
    nameGap: 28,
    axisLabel: { formatter: (value: number) => `${value}%` }
  },
  yAxis: {
    type: 'value',
    name: '現金殖利率 %',
    nameTextStyle: { align: 'left' },
    axisLabel: { formatter: (value: number) => `${value}%` }
  },
  series: [
    {
      type: 'scatter',
      // 10px：高齡友善規格對標記的下限是 8px，這裡取 10 讓密集區仍然點得到。
      symbolSize: 10,
      itemStyle: { color: getAccentColor(resolvedMode.value, accentColorName.value), opacity: 0.7 },
      data: scatterRows.value.map(row => ({
        value: [row.dividendGrowthRate3y as number, row.dividendYield as number],
        row
      }))
    }
  ]
}))
const fundamentalsDate = computed(() => data.value?.companies.fundamentalsDate ?? null)
const otherSectors = computed(() => sectors.value.filter(sector => sector.code !== code))

// Deterministic on both renders: toFixed only, null → '－'.
function num(value: number | null, decimals = 2): string {
  return value === null ? '－' : value.toFixed(decimals)
}

function statText(stat: SectorStat | undefined, unit: string): string | null {
  if (!stat || stat.median === null) return null
  const quartiles = stat.q1 !== null && stat.q3 !== null ? `，四分位距 ${stat.q1.toFixed(2)}–${stat.q3.toFixed(2)}${unit}` : ''
  return `中位數 ${stat.median.toFixed(2)}${unit}（${stat.count} 家有值${quartiles}）`
}

const distribution = computed(() => {
  const current = stats.value
  if (!current) return []
  return [
    { label: '本益比', text: statText(current.peRatio, ' 倍') },
    { label: '股價淨值比', text: statText(current.pbRatio, ' 倍') },
    { label: '殖利率', text: statText(current.dividendYield, '%') },
    { label: 'ROE（近四季）', text: statText(current.roe, '%') }
  ].filter((item): item is { label: string; text: string } => item.text !== null)
})

const medianClauses = computed(() => {
  const current = stats.value
  const parts: string[] = []
  if (current?.peRatio.median !== null && current?.peRatio.median !== undefined) parts.push(`本益比中位數 ${current.peRatio.median.toFixed(2)} 倍`)
  if (current?.dividendYield.median !== null && current?.dividendYield.median !== undefined) parts.push(`殖利率中位數 ${current.dividendYield.median.toFixed(2)}%`)
  if (current?.roe.median !== null && current?.roe.median !== undefined) parts.push(`近四季 ROE 中位數 ${current.roe.median.toFixed(2)}%`)
  return parts
})

const distributionLead = computed(() => (medianClauses.value.length ? `${sectorName}有指標資料的 ${rows.value.length} 家公司：${medianClauses.value.join('、')}。` : ''))

const noindex = computed(() => rows.value.length < INDEXABLE_ROW_FLOOR)

const { breadcrumbs } = useHubPageSeo({
  title: `${sectorName}上市櫃公司名單：本益比、殖利率與 ROE`,
  // Numbers first, ≤ 90 characters（clampDescription trims at a clause boundary）.
  description: () => {
    if (!rows.value.length) return `${sectorName}（證交所類股 ${code}）上市櫃公司 ${catalogCount.value} 家；本站尚無這些公司的財報指標資料，本頁列出全部名單，每家公司連到其個股頁面。`
    const dated = quoteDate.value ? `（${quoteDate.value}）` : ''
    const medians = medianClauses.value.slice(0, 2).join('、')
    return clampDescription(`${sectorName}上市櫃公司 ${catalogCount.value} 家，${rows.value.length} 家列出股價、本益比、殖利率、ROE 與負債比率${dated}${medians ? `；${medians}` : ''}。`)
  },
  path: canonicalPath,
  // 2 levels (was 3, dropping 個股總表) — 2026-09-19 interface-complexity review, same reasoning
  // as useStockPageSeo.ts's own breadcrumb comment: 個股總表 is one 找股票 header click away
  // regardless of which page a visitor is on.
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: sectorName, to: canonicalPath }
  ],
  noindex
})
</script>

<template>
  <div class="app-page industry-page">
    <h1 class="app-page__title industry-page__title">{{ sectorName }}（證交所類股 {{ code }}）上市櫃公司名單</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <IndustryNav />

    <section v-if="scatterRows.length > 1" class="stock-page-section" aria-labelledby="industry-scatter-heading">
      <h2 id="industry-scatter-heading" class="stock-page-section__title">{{ sectorName }}公司的殖利率與股利成長長什麼樣？</h2>
      <p v-if="scatterAnswer" class="hub-answer">{{ scatterAnswer }}</p>
      <el-card shadow="never" class="industry-page__card">
        <SharedChart class="app-chart industry-page__chart" :option="scatterOption" autoresize aria-label="類股內各公司現金殖利率與股利三年成長率的散佈圖" />
      </el-card>
      <p class="hub-answer">同樣的兩個數字，34 個類股各自的中位數畫在一起是<NuxtLink to="/industries/dividend" class="hub-inline-link">類股殖利率分析</NuxtLink>。</p>
    </section>

    <section class="stock-page-section" aria-labelledby="industry-companies-heading">
      <h2 id="industry-companies-heading" class="stock-page-section__title">{{ sectorName }}有哪些上市櫃公司？</h2>
      <p class="hub-answer">
        證交所歸在{{ sectorName }}的上市櫃公司共 {{ catalogCount }} 家。本站有財報指標資料的 {{ rows.length }} 家列於下表，依代號排序；
        <template v-if="quoteDate">股價與估值為 {{ quoteDate }} 的收盤資料</template><template v-if="quoteDate && fundamentalsDate">，</template><template v-if="fundamentalsDate">財報數據至 {{ fundamentalsDate }}</template>。
        點代號看該公司的個股頁。
      </p>
      <SharedTableScroll v-if="rows.length" :label="`${sectorName}公司名單`">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">{{ sectorName }}上市櫃公司的股價、本益比、股價淨值比、殖利率、近四季 ROE 與單季負債比率</caption>
          <thead>
            <tr>
              <th scope="col">代號</th>
              <th scope="col">名稱</th>
              <th scope="col" class="seo-table__num">股價（元）</th>
              <th scope="col" class="seo-table__num">本益比（倍）</th>
              <th scope="col" class="seo-table__num">股價淨值比（倍）</th>
              <th scope="col" class="seo-table__num">殖利率（%）</th>
              <th scope="col" class="seo-table__num">ROE（近四季，%）</th>
              <th scope="col" class="seo-table__num">負債比率（單季，%）</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.symbol">
              <th scope="row"><NuxtLink :to="`/stock/${row.symbol}`" class="seo-table__link">{{ row.symbol }}</NuxtLink></th>
              <td>{{ row.name }}</td>
              <td class="seo-table__num">{{ num(row.price) }}</td>
              <td class="seo-table__num">{{ num(row.peRatio) }}</td>
              <td class="seo-table__num">{{ num(row.pbRatio) }}</td>
              <!-- 個股的 0 寫成「不配息」；上面類股中位數那幾句維持數字（中位數 0 不代表整個類股不配息） -->
              <td class="seo-table__num">{{ row.dividendYield === 0 ? NO_DIVIDEND_TEXT : num(row.dividendYield) }}</td>
              <td class="seo-table__num">{{ num(row.roe) }}</td>
              <td class="seo-table__num">{{ num(row.debtRatio) }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p v-else class="hub-answer">目前沒有這個類股任何一家公司的財報指標資料。</p>
      <template v-if="unranked.length">
        <h3 class="industry-page__subtitle">本類股其他公司（尚無指標資料，{{ unranked.length }} 家）</h3>
        <ul class="hub-company-list">
          <li v-for="company in unranked" :key="company.symbol">
            <NuxtLink :to="`/stock/${company.symbol}`" class="hub-company-list__link">{{ company.symbol }} {{ company.name }}</NuxtLink>
          </li>
        </ul>
      </template>
    </section>

    <section v-if="distribution.length" class="stock-page-section" aria-labelledby="industry-distribution-heading">
      <h2 id="industry-distribution-heading" class="stock-page-section__title">{{ sectorName }}的本益比與殖利率分布如何？</h2>
      <p class="hub-answer">{{ distributionLead }}</p>
      <dl class="hub-stat-list">
        <div v-for="item in distribution" :key="item.label" class="hub-stat-list__item">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.text }}</dd>
        </div>
      </dl>
    </section>

    <section class="stock-page-section" aria-labelledby="industry-screener-heading">
      <h2 id="industry-screener-heading" class="stock-page-section__title">想用更多條件篩選{{ sectorName }}公司？</h2>
      <p class="hub-answer">
        <NuxtLink :to="`/screener?sector=${code}`" class="hub-inline-link">到個股篩選器，把類股限定為{{ sectorName }}</NuxtLink>，再加上 ROE、負債比率、殖利率等指標條件，結果可依任一欄位排序。
      </p>
    </section>

    <section class="stock-page-section" aria-labelledby="industry-other-sectors-heading">
      <h2 id="industry-other-sectors-heading" class="stock-page-section__title">其他類股</h2>
      <!-- Wrapped in <details> 2026-09-19 (interface-complexity review, Playwright-measured at
           375px: this page ran 17 phone screens) — 35 chips is the single longest block on the
           page after the company table itself, and a visitor reading one sector's numbers rarely
           needs every other sector listed open by default. Closed by default; still fully in the
           SSR HTML (a crawler reads it regardless of the <details> state) and reachable without
           JS via the native disclosure widget. -->
      <details class="hub-details">
        <summary>其他 {{ otherSectors.length }} 個類股</summary>
        <nav aria-label="其他類股">
          <ul class="hub-chip-list">
            <li v-for="sector in otherSectors" :key="sector.code">
              <NuxtLink :to="sectorPath(sector.code) ?? '/stock'" class="hub-chip">{{ sector.name }}（{{ sector.companyCount }}）</NuxtLink>
            </li>
          </ul>
        </nav>
        <p class="hub-answer"><NuxtLink to="/stock" class="hub-inline-link">回個股總表</NuxtLink></p>
      </details>
    </section>

    <section class="stock-page-section" aria-labelledby="industry-sources-heading">
      <h2 id="industry-sources-heading" class="stock-page-section__title">資料來源與說明</h2>
      <p class="hub-answer">
        類股歸屬、股價、本益比、股價淨值比與殖利率來自台灣證券交易所與證券櫃檯買賣中心的每日公開資料；ROE 與負債比率整理自公開資訊觀測站的財務報表。本益比在虧損時無值，以「－」表示。
      </p>
      <p class="hub-disclaimer">本頁面提供之客觀排行與指標統計僅供研究參考，非屬投顧法之推薦買賣建議，使用者應獨立審慎評估風險。</p>
    </section>
  </div>
</template>

<style scoped>

.industry-page__subtitle {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}
</style>
