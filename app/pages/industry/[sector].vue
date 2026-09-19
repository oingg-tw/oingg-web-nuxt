<script setup lang="ts">
import type { HubSector, IndustryPageData, SectorStat } from '#shared/types/hub'
import { clampDescription } from '~/utils/stock-digest'

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
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '個股總表', to: '/stock' },
    { label: sectorName, to: canonicalPath }
  ],
  noindex
})
</script>

<template>
  <div class="industry-page">
    <h1 class="industry-page__title">{{ sectorName }}（證交所類股 {{ code }}）上市櫃公司名單</h1>
    <StockBreadcrumb :items="breadcrumbs" />

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
              <td class="seo-table__num">{{ num(row.dividendYield) }}</td>
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
      <nav aria-label="其他類股">
        <ul class="hub-chip-list">
          <li v-for="sector in otherSectors" :key="sector.code">
            <NuxtLink :to="sectorPath(sector.code) ?? '/stock'" class="hub-chip">{{ sector.name }}（{{ sector.companyCount }}）</NuxtLink>
          </li>
        </ul>
      </nav>
      <p class="hub-answer"><NuxtLink to="/stock" class="hub-inline-link">回個股總表</NuxtLink></p>
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
.industry-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.industry-page__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
}

.industry-page__subtitle {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}
</style>
