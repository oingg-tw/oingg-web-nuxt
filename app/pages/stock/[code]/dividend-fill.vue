<script setup lang="ts">
import type { DividendFillEvent } from '#shared/types/dividend-history'
// /stock/:code/dividend-fill — 填權填息（2026-09-24,「配股配息底下 新增一個填權填息，把現在現金殖
// 利率的部分資訊搬過去」）.
//
// Split out of /dividend, where it shipped a few hours earlier as one section. The reason it earns
// its own page rather than staying a section is the one that put it on this site at all: a
// dividend creates no wealth at the moment it is paid — the reference price drops by exactly the
// cash — so a yield only becomes a return once the price gets back. That is a question in its own
// right, and asking it inside a page whose subject is「殖利率是多少」made the yield page carry two
// subjects, which is the shape「不要有總覽概念」rules out.
//
// It reads page=dividend rather than getting a plan of its own: the fills are computed there
// already, the payload is the same Nitro cache entry, and a reader arriving from the 現金殖利率
// page in the same nav group has it warm. No new server code.
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '填權填息'

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)
const { digest, description: digestDescription, series } = await useStockPageDigest(code, 'dividend', { shortName: stockShortName })

const fills = computed<DividendFillEvent[]>(() => series.value?.dividendFills ?? [])
const computable = computed(() => fills.value.filter(fill => fill.unavailableReason === null))
const filled = computed(() => computable.value.filter(fill => fill.filledDate !== null))

const fillDayText = (fill: DividendFillEvent): string => {
  if (fill.unavailableReason === 'stock-dividend') return '同次配發股票股利，不適用'
  if (fill.unavailableReason === 'before-price-history') return '早於本站股價資料範圍'
  if (fill.filledDate === null) return '尚未回到除息前收盤價'
  return fill.tradingDays === 0 ? '除息當日' : `${fill.tradingDays} 個交易日`
}

// Facts only — every clause survives having its adjectives deleted, and no threshold is applied to
// the day counts（「30天/60天填息率」is an industry rule of thumb, i.e. a platform-authored cut
// point, and may not drive a pass/fail judgement）.
const fillAnswer = computed(() => {
  const rows = computable.value
  if (!rows.length) return fills.value.length ? '這些配息的除息日早於本站的股價資料範圍，無法比對。' : null
  const days = filled.value.map(fill => fill.tradingDays!).filter(day => day > 0)
  const parts = [`本站可比對的 ${rows.length} 次現金配息中，${filled.value.length} 次的收盤價回到除息前一個交易日的價位`]
  if (days.length) parts.push(`除去當日回到的次數，最少 ${Math.min(...days)} 個交易日、最多 ${Math.max(...days)} 個交易日`)
  if (filled.value.length < rows.length) parts.push(`其餘 ${rows.length - filled.value.length} 次到目前為止尚未回到`)
  return `${parts.join('，')}。`
})

const unavailable = computed(() => fills.value.filter(fill => fill.unavailableReason !== null))
const stockDividendCount = computed(() => unavailable.value.filter(fill => fill.unavailableReason === 'stock-dividend').length)
const beforeRangeCount = computed(() => unavailable.value.filter(fill => fill.unavailableReason === 'before-price-history').length)

const limitAnswer = computed(() => {
  if (!unavailable.value.length) return `${stockShortName.value}每一次現金配息都算得出來。`
  const parts: string[] = []
  if (stockDividendCount.value) parts.push(`${stockDividendCount.value} 次同時配發股票股利`)
  if (beforeRangeCount.value) parts.push(`${beforeRangeCount.value} 次的除息日早於本站股價資料範圍`)
  return `${stockShortName.value}有 ${unavailable.value.length} 次配息沒有填息天數：${parts.join('、')}。`
})

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '除息後多久填息與逐次紀錄',
  pathSuffix: '/dividend-fill',
  stock,
  summary: computed(() => null),
  description: computed(() =>
    clampDescription(
      fills.value.length
        ? `${stockShortName.value}（${code.value}）每一次現金配息的除息日、除息前收盤價，以及股價回到該價位所經過的交易日數，共 ${fills.value.length} 次紀錄。`
        : `${stockShortName.value}（${code.value}）目前沒有可比對的現金配息紀錄。`
    )
  ),
  sectorCode: computed(() => profile.value?.industry ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="stock-dividend-fill-page">
    <template v-if="stock">
      <StockSummaryCard :stock="stock" :is-emerging="profile?.isEmerging ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection
        v-if="fills.length"
        id="stock-dividend-fill-table"
        :question="`${stockShortName}（${code}）配息之後，股價填回來了嗎？`"
        :answer="fillAnswer"
      >
        <SharedTableScroll :label="`${stockShortName} ${code} 的除息與填息紀錄`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ stockShortName }} {{ code }} 每次現金配息的除息與填息（由新到舊）</caption>
            <thead>
              <tr>
                <th scope="col">除息日</th>
                <th scope="col">現金股利（元）</th>
                <th scope="col">除息前一交易日收盤價（元）</th>
                <th scope="col">回到該價位的日期</th>
                <th scope="col">經過交易日數</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fill in fills" :key="fill.exDividendDate">
                <th scope="row">{{ fill.exDividendDate }}</th>
                <td>{{ fill.cashDividend.toFixed(2) }}</td>
                <td>{{ fill.preExClose === null ? '－' : fill.preExClose.toFixed(2) }}</td>
                <td>{{ fill.filledDate ?? '－' }}</td>
                <td>{{ fillDayText(fill) }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
      </StockQuestionSection>

      <!-- The mechanism, which is why this page exists（「我也需要有個地方解釋為什麼填權填息很重要」）.
           Every sentence is about the arithmetic of an ex-dividend date, not about this company or
           any other: the reference price drop is a definition, not a prediction, and nothing here
           says what a given company's price will do next. -->
      <StockQuestionSection id="stock-dividend-fill-why" question="為什麼填息重要？" answer="除息當天，股價會扣掉當次配發的現金——這是除權息參考價的算法，不是市場反應。">
        <el-card shadow="never" class="stock-dividend-fill-page__card">
          <div class="stock-dividend-fill-page__prose">
            <p>
              配息本身不會讓持有人的資產變多：除息當天股價按配發金額調整，帳面上左手換右手。配到的現金要成為真正的報酬，必須靠股價回到除息前的水準，這件事就叫<strong>填息</strong>（配發股票股利時對應的是填權）。
            </p>
            <p>
              這也是「高殖利率不等於高報酬」的算術基礎：殖利率是配發金額除以股價，分母變小同樣會把這個比率推高，而一家股價已經下跌的公司，可能同時有很高的殖利率與很長的貼息期間。
            </p>
            <p>
              上表記錄的是這家公司過去每一次配息之後，收盤價實際花了多少個交易日回到除息前一個交易日的價位。本站不由此推論之後的配息會如何。
            </p>
          </div>
        </el-card>
      </StockQuestionSection>

      <StockQuestionSection id="stock-dividend-fill-limits" question="什麼情況下算不出填息？" :answer="limitAnswer">
        <el-card shadow="never" class="stock-dividend-fill-page__card">
          <div class="stock-dividend-fill-page__prose">
            <p>
              <strong>同次配發股票股利</strong>：除權參考價還要按配股比例調整股數，拿除息前的收盤價直接比對會算出一個持有人實際上沒有拿到的結果，所以這幾次標為不適用，而不是硬算一個數字。
            </p>
            <p>
              <strong>除息日早於本站股價資料範圍</strong>：填息要逐日比對收盤價，本站的日線資料回溯約六年，更早的除息事件沒有可比對的價格。這幾列留空並標明原因，不做推估。
            </p>
            <p>
              天數一律以<strong>交易日</strong>計算，除息日當天為第 0 天。用日曆天會因為年節落點不同而代表不一樣的交易次數。
            </p>
          </div>
        </el-card>
      </StockQuestionSection>

      <StockPageDigest :digest="digest" />
    </template>

    <SharedStockNotFound v-else-if="!stockPending" />
  </div>
</template>

<style scoped>
.stock-dividend-fill-page__card {
  margin-bottom: 16px;
}

.stock-dividend-fill-page__prose {
  font-size: 1rem;
  line-height: 1.8;
}

.stock-dividend-fill-page__prose p {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
}

.stock-dividend-fill-page__prose p:last-child {
  margin-bottom: 0;
}
</style>
