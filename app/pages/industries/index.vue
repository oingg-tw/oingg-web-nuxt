<script setup lang="ts">
import type { SectorDividendSummaryPageData, SectorGrowthSummary } from '#shared/types/hub'
import type { SortableColumn } from '~/components/shared/SharedSortableTable.vue'

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
  description: '證交所 34 個類股的公司家數、殖利率中位數與股利 3 年成長率中位數逐項列表，點類股名稱看該類股公司的股價、本益比、殖利率與 ROE 一覽表。'
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}/industries` }] })

const { data: summary, error: summaryError } = await useFetch<SectorDividendSummaryPageData | null>('/api/hub/sector-dividend-summary', {
  key: 'hub-sector-dividend-summary',
  default: () => null
})
// 讀不到回 503（2026-10-11，照其他 hub 頁的規則）：搜尋引擎要拿到暫時錯誤，不是一頁空白的 200
if (summaryError.value) throw createError({ statusCode: 503, statusMessage: '類股股利統計資料暫時無法取得', fatal: true })
// 營收與淨利成長中位數兩欄（2026-10-09，跟 /industries/growth 同一份資料）
const { data: growth } = await useFetch<SectorGrowthSummary | null>('/api/hub/sector-growth-summary', {
  key: 'hub-sector-growth-summary',
  default: () => null
})
const growthByCode = computed(() => new Map((growth.value?.sectors ?? []).map(row => [row.code, row])))
const signedPct = (value: number | null | undefined): string => (value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`)

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
  return `證交所把上市櫃公司分成 ${rows.value.length} 個類股，共 ${covered.toLocaleString('en-US')} 家。下表每一列是一個類股：殖利率的中位數（${summary.value?.dividendYieldTradeDate ?? ''} 收盤價計算，沒有配息的公司以 0% 計入）、股利 3 年成長率的中位數，以及營收、淨利近四季年增率的中位數。`
})

const keyword = ref('')
const filteredRows = computed(() => {
  const trimmed = keyword.value.trim()
  if (!trimmed) return rows.value
  return rows.value.filter(row => row.sectorName.includes(trimmed))
})

const pathFor = (code: string) => sectorPath(code) ?? '/industries'

// 欄位可以點表頭排序（2026-10-21，SharedSortableTable）
type SectorRow = SectorDividendSummaryPageData['sectors'][number]
const COLUMNS: SortableColumn<SectorRow>[] = [
  { key: 'sector', label: '類股', sortValue: row => row.sectorCode },
  { key: 'count', label: '家數', num: true, sortValue: row => row.companyCount },
  { key: 'yield', label: '殖利率', num: true, sortValue: row => row.dividendYield.median },
  { key: 'dividendGrowth', label: '股利 3 年成長', num: true, sortValue: row => row.dividendGrowthRate3y.median },
  { key: 'revenueGrowth', label: '營收年增', num: true, sortValue: row => growthByCode.value.get(row.sectorCode)?.revenueGrowthRate.median },
  { key: 'netIncomeGrowth', label: '淨利年增', num: true, sortValue: row => growthByCode.value.get(row.sectorCode)?.netIncomeGrowthRate.median }
]
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
      <el-input v-model="keyword" class="industries-page__search" placeholder="搜尋類股名稱，例如 半導體" aria-label="搜尋類股名稱" clearable />
      <p v-if="keyword.trim()" class="visually-hidden" role="status">{{ filteredRows.length }} 個類股符合</p>
      <!-- 欄位簡化（2026-10-21，使用者：「industries 表格欄位請簡化」）：8 欄 → 6 欄。「有值家數」兩欄拿掉（是中位數的分母，不是讀者要比
           的數字；各類股頁與散佈圖的提示框仍有），「中位數」三個字從每個欄名收進表格說明——每一欄都是中位數，說一次就好 -->
      <p class="hub-answer">除了公司家數，每一欄都是該類股的中位數。</p>
      <SharedSortableTable
        :rows="filteredRows"
        :columns="COLUMNS"
        :row-key="row => row.sectorCode"
        label="各證交所類股的公司家數、殖利率與成長率中位數"
        :caption="`證交所類股的中位數（殖利率為 ${summary?.dividendYieldTradeDate ?? ''} 收盤價計算，未配息以 0% 計入）`"
      >
        <template #row="{ row }">
          <th scope="row"><NuxtLink :to="pathFor(row.sectorCode)">{{ row.sectorName }}</NuxtLink></th>
          <td class="seo-table__num">{{ row.companyCount }}</td>
          <td class="seo-table__num">{{ yieldText(row.dividendYield.median) }}</td>
          <td class="seo-table__num">{{ growthText(row.dividendGrowthRate3y.median) }}</td>
          <td class="seo-table__num">{{ signedPct(growthByCode.get(row.sectorCode)?.revenueGrowthRate.median) }}</td>
          <td class="seo-table__num">{{ signedPct(growthByCode.get(row.sectorCode)?.netIncomeGrowthRate.median) }}</td>
        </template>
      </SharedSortableTable>
      <SharedEmptyState v-if="!filteredRows.length" description="沒有符合的類股名稱" />
    </section>

    <section class="stock-page-section" aria-labelledby="industries-notes-heading">
      <h2 id="industries-notes-heading" class="stock-page-section__title">看這些數字要注意什麼？</h2>
      <ul class="industries-page__notes">
        <li>殖利率把沒有配息的公司以 0% 計入。證交所從 2026-08-28 起把沒配息的公司從 0.00 改成空白，這裡一律當 0，所以上市與上櫃的算法一致。中位數是 0 代表該類股過半公司沒有配息。</li>
        <li>中位數只算該欄有數值的公司，所以每一欄的分母不一定等於家數（股利 3 年成長率全市場約 57% 的公司有數值）；拿家數反推總額會算錯。各類股實際算進幾家，點類股名稱看。</li>
        <li>都用中位數，不用平均。成長率有極端值，34 個類股裡有 8 個的平均與中位數正負號相反，而正負號就是這個欄位在講的事。</li>
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
