<script setup lang="ts">
import type { IndustryPageData } from '#shared/types/hub'
import type { SortableColumn } from '~/components/shared/SharedSortableTable.vue'
// 類股面向：公司名單（2026-09-19 SEO 版那一頁的主體；2026-10-21 起自成一頁，類股首頁改成指標速覽）。回答「半導體業有哪些上市櫃公司？」：
// screener 有財報指標的每一家，附當天的股價、本益比、股價淨值比、殖利率與近四季 ROE、單季負債比率，沒有指標數值的成員另外列。
// 伺服器照代號輸出，點表頭排序只在瀏覽器、不進網址（SharedSortableTable）；要加條件篩選去普通股篩選（/screener/common?sector=NN）。
// 用詞是合規的那一組：家數、數值，不寫形容詞
const industry = await useIndustry('companies')
const { code, sectorName, data, rows, noindex } = industry

type CompanyRow = IndustryPageData['companies']['rows'][number]
const COLUMNS: SortableColumn<CompanyRow>[] = [
  { key: 'symbol', label: '代號', sortValue: row => row.symbol },
  { key: 'name', label: '名稱', sortValue: row => row.name },
  { key: 'price', label: '股價（元）', num: true, sortValue: row => row.price },
  { key: 'pe', label: '本益比（倍）', num: true, sortValue: row => row.peRatio },
  { key: 'pb', label: '股價淨值比（倍）', num: true, sortValue: row => row.pbRatio },
  { key: 'yield', label: '殖利率（%）', num: true, sortValue: row => row.dividendYield },
  { key: 'roe', label: 'ROE（近四季，%）', num: true, sortValue: row => row.roe },
  { key: 'debt', label: '負債比率（單季，%）', num: true, sortValue: row => row.debtRatio }
]
const unranked = computed(() => data.value?.unranked ?? [])
const catalogCount = computed(() => data.value?.sector.companyCount ?? 0)
const quoteDate = computed(() => data.value?.companies.quoteDate ?? null)
const fundamentalsDate = computed(() => data.value?.companies.fundamentalsDate ?? null)

const answer = computed(() => {
  const dates = [quoteDate.value && `股價與估值為 ${quoteDate.value} 的收盤資料`, fundamentalsDate.value && `財報數據至 ${fundamentalsDate.value}`].filter(Boolean).join('，')
  return `證交所歸在${sectorName}的上市櫃公司共 ${catalogCount.value} 家。有財報指標數值的 ${rows.value.length} 家列於下表，依代號排列（點表頭可以換排序）${dates ? `；${dates}` : ''}。點代號看該公司的個股頁。`
})

// 數字在前，90 字以內（clampDescription 在子句邊界截斷）
const description = computed(() => {
  if (!rows.value.length) return `${sectorName}（證交所類股 ${code}）上市櫃公司 ${catalogCount.value} 家；這些公司目前沒有財報指標數值，本頁列出全部名單，每家公司連到其個股頁面。`
  const dated = quoteDate.value ? `（${quoteDate.value}）` : ''
  return clampDescription(`${sectorName}上市櫃公司 ${catalogCount.value} 家，${rows.value.length} 家列出股價、本益比、股價淨值比、殖利率、ROE 與負債比率${dated}，點代號看各公司的個股頁。`)
})
</script>

<template>
  <IndustryPage
    :code="code"
    :sector-name="sectorName"
    facet="companies"
    :title="`${sectorName}上市櫃公司名單：本益比、殖利率與 ROE`"
    :description="description"
    :noindex="noindex"
  >
    <StockQuestionSection id="industry-companies" :question="`${sectorName}有哪些上市櫃公司？`" :answer="answer">
      <SharedSortableTable
        v-if="rows.length"
        :rows="rows"
        :columns="COLUMNS"
        :row-key="row => row.symbol"
        :label="`${sectorName}公司名單`"
        :caption="`${sectorName}上市櫃公司的股價、本益比、股價淨值比、殖利率、近四季 ROE 與單季負債比率`"
        caption-hidden
      >
        <template #row="{ row }">
          <th scope="row"><NuxtLink :to="`/stock/${row.symbol}`" class="seo-table__link">{{ row.symbol }}</NuxtLink></th>
          <td>{{ row.name }}</td>
          <td class="seo-table__num">{{ industryNum(row.price) }}</td>
          <td class="seo-table__num">{{ industryNum(row.peRatio) }}</td>
          <td class="seo-table__num">{{ industryNum(row.pbRatio) }}</td>
          <!-- 殖利率是自算的近 12 個月現金股利殖利率（2026-10-24）：0 只代表近 12 個月沒有除息（可能已宣告、還沒除息），不寫「不配息」；
               近 12 個月沒有配息紀錄的是空值「－」 -->
          <td class="seo-table__num">{{ industryNum(row.dividendYield) }}</td>
          <td class="seo-table__num">{{ industryNum(row.roe) }}</td>
          <td class="seo-table__num">{{ industryNum(row.debtRatio) }}</td>
        </template>
      </SharedSortableTable>
      <p v-else class="hub-answer">這個類股目前沒有任何一家公司有財報指標數值。</p>
      <template v-if="unranked.length">
        <h3 class="industry-companies__subtitle">本類股其他公司（沒有指標數值，{{ unranked.length }} 家）</h3>
        <ul class="hub-company-list">
          <li v-for="company in unranked" :key="company.symbol">
            <NuxtLink :to="`/stock/${company.symbol}`" class="hub-company-list__link">{{ company.symbol }} {{ company.name }}</NuxtLink>
          </li>
        </ul>
      </template>
      <p class="hub-answer">
        <NuxtLink :to="commonScreenerPath({ sector: code })" class="hub-inline-link">到普通股篩選，把類股限定為{{ sectorName }}</NuxtLink>，再加上 ROE、負債比率、殖利率等指標條件，結果可依任一欄位排序。
      </p>
      <p class="hub-answer">股價、本益比、股價淨值比是交易所每日公布的數字；殖利率是一年份的現金股利除以最新收盤價（{{ ANNUAL_CASH_DIVIDEND_BASIS }}），近 12 個月沒有配息紀錄的以「－」表示；ROE 與負債比率整理自公開資訊觀測站的財務報表。本益比在虧損時無值，以「－」表示。</p>
    </StockQuestionSection>
  </IndustryPage>
</template>

<style scoped>
.industry-companies__subtitle {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}
</style>
