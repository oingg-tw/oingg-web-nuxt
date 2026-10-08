<script setup lang="ts">
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

const requestUrl = useRequestURL()
useSeoMeta({
  title: '台股產業索引：34 個證交所類股一覽',
  description: '證交所 34 個類股的公司家數、現金殖利率中位數與股利 3 年成長率中位數逐項列表，點類股名稱看該類股公司的股價、本益比、殖利率與 ROE 一覽表。'
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}/industries` }] })

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
const yieldText = (value: number | null): string => (value === null ? '—' : `${value.toFixed(2)}%`)
const growthText = (value: number | null): string => (value === null ? '—' : `${value.toFixed(1)}%`)
const rows = computed(() => summary.value?.sectors ?? [])

const latestAnswer = computed(() => {
  if (!rows.value.length) return null
  const covered = rows.value.reduce((total, row) => total + row.companyCount, 0)
  return `證交所把上市櫃公司分成 ${rows.value.length} 個類股，共 ${covered.toLocaleString('en-US')} 家。下圖每一個點是一個類股：縱軸是該類股現金殖利率的中位數（${summary.value?.dividendYieldTradeDate ?? ''} 收盤價計算，沒有配息的公司以 0% 計入），橫軸是股利 3 年成長率的中位數。`
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
  <div class="app-page app-page--compact industries-page">
    <h1 class="app-page__title industries-page__title">台股產業索引</h1>
    <IndustryNav />

    <section class="stock-page-section" aria-labelledby="industries-overview-heading">
      <h2 id="industries-overview-heading" class="stock-page-section__title">證交所把上市櫃公司分成哪些類股？</h2>
      <p v-if="latestAnswer" class="hub-answer">{{ latestAnswer }}</p>
      <p class="hub-answer">把這些類股的殖利率與股利成長畫在同一張圖上，看<NuxtLink to="/industries/dividend" class="hub-inline-link">殖利率分析</NuxtLink>。</p>
    </section>

    <section class="stock-page-section" aria-labelledby="industries-table-heading">
      <h2 id="industries-table-heading" class="stock-page-section__title">每個類股的數字是多少？</h2>
      <el-input v-model="keyword" class="industries-page__search" placeholder="搜尋類股名稱，例如 半導體" clearable />
      <SharedTableScroll label="各證交所類股的公司家數、殖利率中位數與股利成長率">
        <table class="seo-table" data-ssr-table>
          <caption>證交所類股的股利統計（殖利率為 {{ summary?.dividendYieldTradeDate ?? '' }} 收盤價計算，未配息以 0% 計入）</caption>
          <thead>
            <tr>
              <th scope="col">類股</th>
              <th scope="col">公司家數</th>
              <th scope="col">殖利率中位數</th>
              <th scope="col">殖利率有值家數</th>
              <th scope="col">股利 3 年成長率中位數</th>
              <th scope="col">成長率有值家數</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRows" :key="row.sectorCode">
              <th scope="row"><NuxtLink :to="pathFor(row.sectorCode)">{{ row.sectorName }}</NuxtLink></th>
              <td>{{ row.companyCount }}</td>
              <td>{{ yieldText(row.dividendYield.median) }}</td>
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

</style>
