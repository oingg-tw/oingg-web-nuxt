<script setup lang="ts">
import type { SortableColumn } from '~/components/shared/SharedSortableTable.vue'

// REITs 總覽（2026-10-29，使用者：「screener 那邊要新增REITS篩選」→「把"篩選" 改成 選擇 或是總覽」「至少要可以排序」）。掛牌的只有
// 約 6 檔，條件篩不掉什麼，所以不是第四組篩選（沒有條件、欄位組合、我的篩選），是一張可排序的總覽表，放在篩選區的側欄。
// 資料：數據中台 GET /reits（mops 的 REITs 表＋證交所收盤，詞彙表二之五之一），業務中台 Rust 版原樣轉發（外層 entries，同它其他清單端點），
// 這裡經 /api/cached 一小時快取。
interface Reit {
  symbol: string
  companyName: string
  trusteeName: string | null
  listingDate: string | null
  close: number | null
  tradeDate: string | null
  nav: number | null
  navDate: string | null
  premiumDiscountPct: number | null
  trailing12MonthDistributionPerUnit: number | null
  trailing12MonthDistributionYieldPct: number | null
  trailing12MonthDistributionCount: number | null
  totalIssueAmountNtd: number | null
}

const requestUrl = useRequestURL()
useSeoMeta({
  title: 'REITs 總覽：淨值折溢價與近 12 個月分配率',
  description: '台灣掛牌中的不動產投資信託（REITs）逐檔列出收盤價、每單位淨值、折溢價、近 12 個月每單位分配與分配率、受託機構與發行總額，每一欄可排序。'
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}${SCREENER_PATHS.reits}` }] })

const { data, error } = await useFetch<{ entries: Reit[] }>('/api/cached/reits', { key: 'reits' })
// 讀不到回 503（照其他總覽頁）：搜尋引擎要拿到暫時錯誤，不是一頁空白的 200
if (error.value) throw createError({ statusCode: 503, statusMessage: 'REITs 資料暫時無法取得', fatal: true })
const rows = computed(() => data.value?.entries ?? [])

// 各檔的日期通常同一天；不同天時寫成區間，不挑其中一天冒充全部
function dateSpan(key: 'tradeDate' | 'navDate'): string {
  const dates = [...new Set(rows.value.map(row => row[key]).filter((date): date is string => !!date))].sort()
  return dates.length > 1 ? `${dates[0]}～${dates.at(-1)}` : (dates[0] ?? '')
}
const answer = computed(() => !rows.value.length ? '目前讀不到掛牌中的 REITs。' :
  `台灣目前掛牌的不動產投資信託（REITs）有 ${rows.value.length} 檔。收盤價是 ${dateSpan('tradeDate')} 的收盤；每單位淨值是 ${dateSpan('navDate')} 的淨值，` +
  '折溢價用淨值日當天的收盤價計算。近 12 個月分配是除息日在過去一年內的每單位現金分配合計，分配率是它除以收盤價。'
)

const COLUMNS: SortableColumn<Reit>[] = [
  { key: 'name', label: 'REITs', sortValue: row => row.symbol },
  { key: 'close', label: '收盤價（元）', num: true, sortValue: row => row.close },
  // 「每單位淨值」寫在上面那句；欄名照 ETF 篩選叫淨值（9 欄在 1440 寬剛好放得下）
  { key: 'nav', label: '淨值（元）', num: true, sortValue: row => row.nav },
  { key: 'premium', label: '折溢價', num: true, sortValue: row => row.premiumDiscountPct },
  { key: 'distribution', label: '近 12 個月分配（元）', num: true, sortValue: row => row.trailing12MonthDistributionPerUnit },
  { key: 'yield', label: '分配率', num: true, sortValue: row => row.trailing12MonthDistributionYieldPct },
  { key: 'count', label: '分配次數', num: true, sortValue: row => row.trailing12MonthDistributionCount },
  { key: 'trustee', label: '受託機構', sortValue: row => row.trusteeName },
  { key: 'issue', label: '發行總額', num: true, sortValue: row => row.totalIssueAmountNtd }
]
const num = (value: number | null, digits: number) => (value === null ? '—' : value.toFixed(digits))
</script>

<template>
  <div class="app-page app-page--compact">
    <h1 class="app-page__title app-page__title--app">REITs 總覽</h1>
    <ScreenerNav />

    <section class="stock-page-section" aria-labelledby="reits-overview-heading">
      <h2 id="reits-overview-heading" class="stock-page-section__title">台灣有哪些 REITs？</h2>
      <p class="hub-answer">{{ answer }}</p>
      <SharedSortableTable
        v-if="rows.length"
        :rows="rows"
        :columns="COLUMNS"
        :row-key="row => row.symbol"
        label="各檔 REITs 的收盤價、淨值、折溢價與近 12 個月分配"
        caption="台灣掛牌中的 REITs：收盤價、每單位淨值、折溢價、近 12 個月每單位分配、分配率、分配次數、受託機構與發行總額"
        caption-hidden
      >
        <template #row="{ row }">
          <th scope="row">{{ row.companyName }}（{{ row.symbol }}）</th>
          <td class="seo-table__num">{{ num(row.close, 2) }}</td>
          <td class="seo-table__num">{{ num(row.nav, 2) }}</td>
          <td class="seo-table__num">{{ row.premiumDiscountPct === null ? '—' : fixedSignedRateText(row.premiumDiscountPct) }}</td>
          <td class="seo-table__num">{{ num(row.trailing12MonthDistributionPerUnit, 4) }}</td>
          <td class="seo-table__num">{{ row.trailing12MonthDistributionYieldPct === null ? '—' : fixedRateText(row.trailing12MonthDistributionYieldPct) }}</td>
          <td class="seo-table__num">{{ row.trailing12MonthDistributionCount ?? '—' }}</td>
          <td>{{ row.trusteeName ?? '—' }}</td>
          <td class="seo-table__num">{{ row.totalIssueAmountNtd === null ? '—' : formatMoney(row.totalIssueAmountNtd) }}</td>
        </template>
      </SharedSortableTable>
    </section>

    <section class="stock-page-section" aria-labelledby="reits-notes-heading">
      <h2 id="reits-notes-heading" class="stock-page-section__title">看這些數字要注意什麼？</h2>
      <ul class="reits-page__notes">
        <li>折溢價是收盤價比每單位淨值高或低多少：負的是折價（市價低於淨值），正的是溢價。淨值比收盤晚一天公布，所以用同一天的收盤價配對。</li>
        <li>分配率用過去 12 個月實際發放的分配計算，以後的分配不一定一樣；已經公告、還沒除息的那一次不算進去。</li>
        <li>REITs 的收益分配來自租金等不動產收益，跟股票的股利不同；分配次數是過去一年實際分配了幾次，不是公告的配息頻率。</li>
      </ul>
      <p class="hub-answer hub-sources">資料來源：公開資訊觀測站（REITs 基本資料、每日淨值與收益分配公告）、臺灣證券交易所每日收盤行情。</p>
    </section>
  </div>
</template>

<style scoped>
.reits-page__notes {
  margin: 0;
  padding-left: 1.2em;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}
</style>
