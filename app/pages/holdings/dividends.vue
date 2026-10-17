<script setup lang="ts">
import type { HoldingDividendEvent, HoldingDividendsResult } from '~/composables/holdings/holdings-model'

// 配息日程（2026-10-17，使用者：「持股管理那邊也要加上配息日程。放配息表格」，選了「持股管理新增一頁」＋「也列過去一年領過的」）。
// 資料是業務中台的 GET /holdings/dividends（97bd1e2）：股數用除息日前一天的持股回推，所以「過去一年領過的」是當時真的持有的股數，
// 不是拿現在的股數去乘。一頁一個問句、一張表：還沒發放的在前（日期近的先），已發放的在後（新的先）。
//
// 表格不用 HoldingsSymbolTable：那是「一檔一列、可展開交易明細」，這裡一個事件一列、同一檔會出現好幾次，也沒有明細可展開。
// 金額是應收（股數 × 每股），還沒扣匯費與二代健保補充保費，實際入帳可能略少——寫在表頭與頁尾，不寫成「實領」。
useSeoMeta({ title: '配息日程', robots: 'noindex, nofollow' })

const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const { fetchDividends } = useHoldings()
const { routeFor } = useStockSearch()

const result = ref<HoldingDividendsResult | null>(null)
const pending = ref(false)
const failed = ref(false)
// 讀不到時交給全站的讀取失敗彈窗（AppLoadFailureDialog），畫面上不再各自出訊息
watchLoadFailure('holdings-dividends', () => failed.value, () => load())

async function load() {
  pending.value = true
  failed.value = false
  result.value = await fetchDividends()
  failed.value = result.value === null
  pending.value = false
}

watch([authResolved, () => currentUser.value?.uid], ([resolved, uid]) => {
  if (!resolved) return
  if (uid) load()
  else result.value = null
}, { immediate: true })

const companyByCode = useCompanyLookup(() => result.value?.dividends.map(event => event.symbol) ?? [])

const STATUS_TEXT: Record<HoldingDividendEvent['status'], string> = { paid: '已發放', awaiting_payment: '待發放', announced: '已公告', ex_rights_done: '已除權' }
// 已經發生的：現金發放了，或只配股、已除權（股票在新股上市日入帳，日期上游沒有，見 holdings-model.ts）
const settled = (event: HoldingDividendEvent) => event.status === 'paid' || event.status === 'ex_rights_done'
const slashDate = (date: string) => date.replaceAll('-', '/')
const money = (amount: number) => `${groupThousands(String(Math.round(amount)))} 元`

// 還沒發放的（已公告、待發放）在前、依除息日由近到遠；已發放的在後、由新到舊
const events = computed(() => {
  const list = result.value?.dividends ?? []
  const upcoming = list.filter(event => !settled(event)).sort((a, b) => a.exDate.localeCompare(b.exDate))
  const paid = list.filter(settled).sort((a, b) => b.exDate.localeCompare(a.exDate))
  return [...upcoming, ...paid].map((event) => {
    const entry = companyByCode.value.get(event.symbol)
    const name = entry?.name ?? event.symbol
    return {
      ...event,
      key: `${event.symbol}-${event.exDate}-${event.exType}`,
      name,
      link: entry ? routeFor(entry) : `/stock/${event.symbol}`,
      exText: `${slashDate(event.exDate)} ${EX_TYPE_LABELS[event.exType] ?? event.exType}`,
      // 發放日只代表現金（2026-10-17「世紀 除權 未公布? 可是我都拿到了」→ 上游確認 mops 沒有配股入帳日）：只配股的寫入帳時點，
      // 權息的日期標明是現金那一部分
      payText: event.exType === '權'
        ? '新股上市日入帳'
        : event.paymentDate ? `${slashDate(event.paymentDate)}${event.exType === '權息' ? '（現金）' : ''}` : '未公布',
      // 每股：現金（元，最多四位小數——上游浮點數帶雜訊，2330 是 7.00000137）＋配股（每股配幾股）
      perShareText: [
        event.cashPerShare !== null ? `${Number(event.cashPerShare.toFixed(4))} 元` : event.exType === '權' ? null : '金額未公布',
        event.stockRatio !== null ? `配股 ${Number(event.stockRatio.toFixed(6))} 股` : null
      ].filter(Boolean).join('、'),
      sharesText: `${groupThousands(event.sharesHeld)} 股${event.sharesHeldIsEstimate ? '（目前持股）' : ''}`,
      amountText: [
        event.cashAmount !== null ? money(event.cashAmount) : null,
        event.stockShares !== null ? `${groupThousands(event.stockShares)} 股` : null
      ].filter(Boolean).join('、') || '—'
    }
  })
})

// 答句：接下來幾筆、最近的是哪一筆；過去一年發放了幾筆、合計多少。只陳述數字
const answer = computed(() => {
  if (!result.value) return null
  const upcoming = events.value.filter(event => !settled(event))
  const paid = events.value.filter(event => event.status === 'paid')
  const next = upcoming[0]
  const nextText = next
    ? `接下來 ${upcoming.length} 筆，最近的是 ${next.exText.slice(5)}的${next.name}${next.cashAmount !== null ? `，應收 ${money(next.cashAmount)}` : ''}`
    : '目前沒有已公告、還沒發放的配息'
  const paidTotal = paid.reduce((sum, event) => sum + (event.cashAmount ?? 0), 0)
  const paidText = paid.length ? `過去一年發放 ${paid.length} 筆，現金合計應收 ${money(paidTotal)}` : '過去一年沒有發放的配息'
  // 只配股、已除權的：股數另外說（沒有現金，入帳日上游沒有）
  const exRights = events.value.filter(event => event.status === 'ex_rights_done')
  const exRightsShares = exRights.reduce((sum, event) => sum + (event.stockShares ?? 0), 0)
  const exRightsText = exRights.length ? `；另有 ${exRights.length} 筆已除權配股，共 ${groupThousands(exRightsShares)} 股` : ''
  return `${nextText}；${paidText}${exRightsText}。`
})
</script>

<template>
  <HoldingsPageShell title="配息日程" subtitle="持股接下來要除權息、發放的，以及過去一年發放過的" guest-title="登入後查看你的配息日程" guest-text="持股與交易資料存在你的帳號裡，只有你看得到。">
    <section v-loading="pending && !result" aria-labelledby="dividends-title">
      <h2 id="dividends-title" class="dividends-page__section-title">接下來與過去一年的配息有哪些？</h2>
      <!-- 讀不到：彈窗會說明並自動重讀 -->
      <template v-if="failed" />
      <template v-else-if="result">
        <p class="dividends-page__answer">{{ answer }}</p>
        <SharedTableScroll v-if="events.length" label="持股的配息日程">
          <table class="seo-table dividends-page__table">
            <caption class="visually-hidden">持股的配息日程：還沒發放的在前、已發放的在後</caption>
            <thead>
              <tr>
                <th scope="col">股票</th>
                <th scope="col">除權息日</th>
                <th scope="col">發放日</th>
                <th scope="col">每股</th>
                <th scope="col">股數</th>
                <th scope="col">應收</th>
                <th scope="col">狀態</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="event in events" :key="event.key">
                <th scope="row">
                  <NuxtLink :to="event.link">{{ event.name }}</NuxtLink>
                  <span class="dividends-page__code">{{ event.symbol }}</span>
                </th>
                <td>{{ event.exText }}</td>
                <td>{{ event.payText }}</td>
                <td>{{ event.perShareText }}</td>
                <td class="seo-table__num">{{ event.sharesText }}</td>
                <td class="seo-table__num">{{ event.amountText }}</td>
                <td>{{ STATUS_TEXT[event.status] }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
        <p class="dividends-page__footnote">
          股數是除息日前一天收盤時的持股；還沒除息的用目前持股估算。應收是股數乘以每股金額，還沒扣匯費與二代健保補充保費，實際入帳可能略少。
          配股無條件捨去到整股，不足一股的部分通常依面額折發現金，這裡沒有算進去；配股在新股上市（上櫃）買賣日入帳，那個日期目前沒有資料，所以只標「已除權」。
        </p>
      </template>
    </section>
  </HoldingsPageShell>
</template>

<style scoped>
.dividends-page__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

.dividends-page__answer {
  margin: 0 0 16px;
}

.dividends-page__code {
  margin-left: 6px;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.dividends-page__table th[scope='row'] {
  white-space: nowrap;
}

.dividends-page__footnote {
  margin: 16px 0 0;
  color: var(--el-text-color-regular);
}
</style>
