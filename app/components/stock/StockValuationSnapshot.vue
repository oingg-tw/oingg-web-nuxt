<script setup lang="ts">
import type { IndustryPageData } from '#shared/types/hub'

// 個股首頁「財報亮點與風險」段的常見估值指標小表（使用者 2026-10-05：「亮點與風險除了徽章以外，也要有常見的
// 欄位，PER PBR 殖利率」）。只在這一段出現——其他頁維持 2026-09-21 全站移除的決定（StockSummaryCard.vue）。
//
// 數值與中位數取自同一份產業表（screener 的 .EOD 交易所欄位、同一個收盤日）。不用 index 頁已載入的
// /stocks/{code} valuation：那是 analysis-ts 自算的 livePeRatio／livePbRatio，虧損公司會是負值（1101 = -21.49
// 倍），中位數卻是 exchangePeRatio（交易所不公布虧損公司的 PE）——兩個指標並列會對不上（bff-ts 2026-10-06 確認）。
//
// 比較基準是同產業中位數。不放自己的近 5 年百分位，那是用財報
// 公布日股價算的 peRatio.TTM，口徑不同，並列會誤導。只陳述數字，不比高低、不上色、不加箭頭。
const props = defineProps<{
  code: string
  sectorCode: string | null
}>()

const sector = computed(() => (props.sectorCode ? SECTORS[props.sectorCode] : undefined))

// transform 讓 SSR payload 只帶這一檔的那一列和三個中位數，不帶整張產業表；資料本身由 Nitro 快取（getSectorCompanies）
const { data: snapshot } = await useFetch(() => `/api/hub/industry/${props.sectorCode}`, {
  key: () => `hub-industry-snapshot-${props.sectorCode}-${props.code}`,
  immediate: !!sector.value,
  transform: (data: IndustryPageData) => ({
    row: data.companies.rows.find(row => row.symbol === props.code) ?? null,
    quoteDate: data.companies.quoteDate,
    medians: {
      peRatio: data.companies.stats.peRatio.median,
      pbRatio: data.companies.stats.pbRatio.median,
      dividendYield: data.companies.stats.dividendYield.median
    }
  })
})

const rows = computed(() => [
  { key: 'peRatio', label: '本益比', unit: ' 倍', link: `/stock/${props.code}/pe-ratio`, linkText: '近 5 年走勢' },
  { key: 'pbRatio', label: '股價淨值比', unit: ' 倍', link: `/stock/${props.code}/pb-ratio`, linkText: '近 5 年走勢' },
  { key: 'dividendYield', label: '殖利率', unit: '%', link: `/stock/${props.code}/dividend`, linkText: '股利' }
] as const)

function show(value: number | null | undefined, unit: string): string {
  return value === null || value === undefined ? '－' : `${value.toFixed(2)}${unit}`
}

const dateText = computed(() => (sector.value ? snapshot.value?.quoteDate?.slice(5).replace('-', '/') : undefined))
</script>

<template>
  <div class="valuation-snapshot">
    <h3 class="valuation-snapshot__title">常見估值指標<template v-if="dateText">（{{ dateText }} 收盤）</template></h3>
    <SharedTableScroll :label="`${code} 的常見估值指標`">
      <table class="seo-table" data-ssr-table>
        <caption class="visually-hidden">{{ code }} 的本益比、股價淨值比、殖利率，以及同產業的中位數</caption>
        <thead>
          <tr>
            <th scope="col">指標</th>
            <th scope="col">數值</th>
            <th scope="col">同產業<template v-if="sector">（{{ sector.name }}）</template>中位數</th>
            <th scope="col">延伸閱讀</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key">
            <th scope="row">{{ row.label }}</th>
            <td>{{ show(sector ? snapshot?.row?.[row.key] : null, row.unit) }}</td>
            <td>{{ show(sector ? snapshot?.medians[row.key] : null, row.unit) }}</td>
            <td><NuxtLink :to="row.link" class="valuation-snapshot__link">{{ row.linkText }} →</NuxtLink></td>
          </tr>
        </tbody>
      </table>
    </SharedTableScroll>
  </div>
</template>

<style scoped>
.valuation-snapshot {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.valuation-snapshot__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.valuation-snapshot td {
  font-variant-numeric: tabular-nums;
  vertical-align: middle;
}

.valuation-snapshot__link {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  font-weight: 600;
  color: var(--el-color-primary-dark-2);
  white-space: nowrap;
  text-decoration: none;
}
</style>
