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
// already, the payload is the same Nitro cache entry, and a reader arriving from the 殖利率
// page in the same nav group has it warm. No new server code.
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '填權填息'

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)
const { digest, description: digestDescription, series } = await useStockPageDigest(code, 'dividend', { shortName: stockShortName })

const fills = computed<DividendFillEvent[]>(() => series.value?.dividendFills ?? [])

// Facts only — every clause survives having its adjectives deleted, and no threshold is applied to
// the day counts（「30天/60天填息率」is an industry rule of thumb, i.e. a platform-authored cut
// point, and may not drive a pass/fail judgement）.
// 文字在 app/utils/dividend-fill.ts（2026-10-18 抽出，ETF 填息頁共用）
const fillAnswer = computed(() => fillSummary(fills.value) ?? (fills.value.length ? '這些配息都沒有逐日股價可以比對。' : null))
const unavailable = computed(() => fills.value.filter(fill => fill.unavailableReason !== null))

// 頁尾的相關頁面（2026-10-12）：歷年配了多少、配息從哪來
// 頁尾第一個連結是新手專區的完整說明（2026-10-12「把教學、說明與指標頁面分開」）：這一頁只留一句定義
const TOPIC_GUIDE = findLearnTopic('dividend-fill')!
const footerLinks = computed(() => [
  { to: learnTopicPath(TOPIC_GUIDE.slug), label: `${TOPIC_GUIDE.topic}怎麼看（新手專區）` },
  { to: `/stock/${code.value}/dividend`, label: '配股配息' },
  { to: `/learn/dividend-source/${code.value}`, label: '配息從哪來' }
])

const limitAnswer = computed(() => {
  if (!unavailable.value.length) return `${stockShortName.value}每一次現金配息都算得出來。`
  return `${stockShortName.value}有 ${unavailable.value.length} 次配息沒有填息天數：${fillUnavailableParts(fills.value).join('、')}。`
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
        // 接上答句（2026-10-12）：名稱短、次數少的公司（7711 永擎，2 次）只有 49.5 字，低於 50 字的描述下限
        ? `${stockShortName.value}（${code.value}）每一次現金配息的除息日、除息前收盤價，以及股價回到該價位所經過的交易日數，共 ${fills.value.length} 次紀錄。${fillAnswer.value ?? ''}`
        : `${stockShortName.value}（${code.value}）目前沒有可比對的現金配息紀錄。`
    )
  ),
  sectorCode: computed(() => profile.value?.sectorCode ?? null)
})
</script>

<template>
  <StockPageShell
    class="stock-dividend-fill-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :is-emerging="profile?.isEmerging ?? null"
    :is-favorite="isFavorite"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="{ sources: digest?.sources ?? [], freshness: digest && buildDigestFreshnessText(digest), links: footerLinks }"
    @toggle-favorite="toggleFavorite"
  >
    <StockQuestionSection
      v-if="fills.length"
      id="stock-dividend-fill-table"
      :question="`${stockShortName}（${code}）配息之後，股價填回來了嗎？`"
      :answer="fillAnswer"
    >
      <SharedTableScroll :label="`${stockShortName} ${code} 的除息與填息紀錄`">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">{{ stockShortName }} {{ code }} 的除息與填息紀錄</caption>
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

    <StockQuestionSection id="stock-dividend-fill-limits" question="什麼情況下算不出填息？" :answer="limitAnswer" />

    <!-- 一句定義（2026-10-12 起「為什麼填息重要」與算不出來的情況在新手專區 /learn/dividend-fill，頁尾第一個連結）。 -->
    <template #guide>
      <StockMetricGuide id-prefix="stock-dividend-fill" :topic="TOPIC_GUIDE.topic" :definition="[TOPIC_GUIDE.summary]" />
    </template>
  </StockPageShell>
</template>
