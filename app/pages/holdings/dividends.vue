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

// 誰＋哪個帳戶（2026-10-19）：換帳戶就跟換人一樣重新載入
const { holdingsScope } = useHoldingsPortfolios()
watch([authResolved, holdingsScope], ([resolved, uid]) => {
  if (!resolved) return
  if (uid) load()
  else result.value = null
}, { immediate: true })

const companyByCode = useCompanyLookup(() => result.value?.dividends.map(event => event.symbol) ?? [])

const STATUS_TEXT: Record<HoldingDividendEvent['status'], string> = { paid: '已發放', awaiting_payment: '待發放', announced: '已公告', ex_rights_done: '已除權' }
// 已經發生的：該發的都發了，或只配股、已除權而且沒有配股發放日（10/20 以前的配股，見 holdings-model.ts）
const settled = (event: HoldingDividendEvent) => event.status === 'paid' || event.status === 'ex_rights_done'
const slashDate = (date: string) => date.replaceAll('-', '/')
function payTextOf(event: HoldingDividendEvent): string {
  const stock = event.stockDividendDistributionDate
  if (event.exType === '權') return stock ? slashDate(stock) : '新股上市日入帳'
  if (event.exType === '息') return event.paymentDate ? slashDate(event.paymentDate) : '未公布'
  const parts = [event.paymentDate ? `${slashDate(event.paymentDate)}（現金）` : null, stock ? `${slashDate(stock)}（配股）` : null].filter(Boolean)
  return parts.length ? parts.join('、') : '未公布'
}
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
      // paymentDate 只代表現金（2026-10-17「世紀 除權 未公布? 可是我都拿到了」）。配股的發放日 2026-10-20 起才有
      //（stockDividendDistributionDate，之前的配股沒有）：有就寫日期，沒有的只配股照舊寫入帳時點；權息兩個日期各自標明
      payText: payTextOf(event),
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

// 骨架畫幾列＝上次看到的筆數（useLayoutHint）；0＝上次沒有任何配息，讀的時候就不畫月曆與表格
const eventCountHint = useLayoutHint('holdings-dividends-rows', 5)
watch(events, (list) => {
  if (result.value) eventCountHint.value = list.length
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
  // 有配股發放日的配股（2026-10-20 起）發了也算 paid，股數一起說
  const paidShares = paid.reduce((sum, event) => sum + (event.stockShares ?? 0), 0)
  const paidText = paid.length ? `過去一年發放 ${paid.length} 筆，現金合計應收 ${money(paidTotal)}${paidShares ? `、配股 ${groupThousands(paidShares)} 股` : ''}` : '過去一年沒有發放的配息'
  // 只配股、已除權的：股數另外說（沒有現金，入帳日上游沒有）
  const exRights = events.value.filter(event => event.status === 'ex_rights_done')
  const exRightsShares = exRights.reduce((sum, event) => sum + (event.stockShares ?? 0), 0)
  const exRightsText = exRights.length ? `；另有 ${exRights.length} 筆已除權配股，共 ${groupThousands(exRightsShares)} 股` : ''
  return `${nextText}；${paidText}${exRightsText}。`
})
</script>

<template>
  <HoldingsPageShell title="配息日程" subtitle="持股接下來要除權息、發放的，以及過去一年發放過的" guest-title="登入後查看你的配息日程" guest-text="持股與交易資料存在你的帳號裡，只有你看得到。" :pending="pending && !result">
    <template #default="{ loading }">
      <!-- 讀的時候問句、月曆（這個月、空的）、表頭、註腳照畫，答句與表格的列是骨架（2026-10-20）。月曆的格子有最小高度，
           事件標籤放進去不變高。上次沒有任何配息時（列數提示是 0）不畫月曆與表格，跟資料到了一樣 -->
      <section aria-labelledby="dividends-title" :aria-busy="loading">
        <h2 id="dividends-title" class="dividends-page__section-title">接下來與過去一年的配息有哪些？</h2>
        <!-- 讀不到：彈窗會說明並自動重讀 -->
        <template v-if="failed" />
        <template v-else-if="loading || result">
          <p class="dividends-page__answer">
            <!-- 範例字照上次有沒有配息挑一句：沒有配息的那句短很多，手機上少一行 -->
            <span v-if="loading" class="app-skeleton app-skeleton--flow" aria-hidden="true">{{ eventCountHint ? '接下來 2 筆，最近的是 11/05 除息的台積電，應收 5,000 元；過去一年發放 6 筆，現金合計應收 34,934 元。' : '目前沒有已公告、還沒發放的配息；過去一年沒有發放的配息。' }}</span>
            <template v-else>{{ answer }}</template>
          </p>
          <!-- 月曆在上、表格在下（2026-10-19 使用者：「要先呈現配息月曆，下半部才會是表格」） -->
          <HoldingsDividendCalendar v-if="loading ? eventCountHint > 0 : events.length" :events="loading ? [] : events" :as-of="result?.asOf ?? holdingsTaipeiDate()" class="dividends-page__calendar" />
          <SharedTableScroll v-if="loading ? eventCountHint > 0 : events.length" label="持股的配息日程">
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
              <tbody v-if="loading" aria-hidden="true">
                <tr v-for="index in eventCountHint" :key="index">
                  <th scope="row"><span class="app-skeleton app-skeleton--flow">台積電 2330</span></th>
                  <td><span class="app-skeleton app-skeleton--flow">2026/11/05 除息</span></td>
                  <td><span class="app-skeleton app-skeleton--flow">2026/12/02</span></td>
                  <td><span class="app-skeleton app-skeleton--flow">5 元</span></td>
                  <td class="seo-table__num"><span class="app-skeleton app-skeleton--flow">1,000 股</span></td>
                  <td class="seo-table__num"><span class="app-skeleton app-skeleton--flow">5,000 元</span></td>
                  <td><span class="app-skeleton app-skeleton--flow">待發放</span></td>
                </tr>
              </tbody>
              <tbody v-else>
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
            配股無條件捨去到整股，不足一股的部分通常依面額折發現金，這裡沒有算進去；配股在新股上市（上櫃）買賣日入帳：2026 年 10 月 20 日以後公告的配股有發放日，之前的沒有資料，只標「已除權」。
          </p>
        </template>
      </section>
    </template>
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

.dividends-page__calendar {
  margin-bottom: 24px;
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
