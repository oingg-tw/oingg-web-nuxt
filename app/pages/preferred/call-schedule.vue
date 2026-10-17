<script setup lang="ts">
// /preferred/call-schedule — 收回時程與溢價（2026-10-18）：最早可收回日（不是已收回）、收回條件原文、現價比發行價高多少。
// 溢價的門檻沿用 hasNegativeConvexityWarning（2%），跟個別頁同一條；只陳述「高出多少」，不說貴或危險
const { entries, today } = await usePreferredZoneList()

const answer = computed(() => {
  if (!entries.value.length) return null
  const passed = entries.value.filter(entry => redemptionStatus(entry, today) === 'passed').length
  const upcoming = entries.value.filter(entry => redemptionStatus(entry, today) === 'upcoming').length
  const premium = entries.value.filter(hasNegativeConvexityWarning).length
  return `${entries.value.length} 檔中，${passed} 檔已過最早可收回日、發行公司還沒有收回（之後隨時可能收回），${upcoming} 檔還沒到；現價比發行價高出 2% 以上的有 ${premium} 檔。`
})
const statusText = (entry: Parameters<typeof redemptionStatus>[0]) => {
  if (entry.redeemable === false) return '不可收回'
  const status = redemptionStatus(entry, today)
  if (status === 'passed') return `${entry.redemptionDate}（已過）`
  if (status === 'upcoming') return entry.redemptionDate
  // 可以收回、但條款沒寫日期（1312A「公司得自行訂定收回日」、2002A 章程只寫得收回）；上游 null 才是真的不知道
  return entry.redeemable ? '條款未寫日期' : '未知'
}
</script>

<template>
  <PreferredZonePage
    title="特別股收回時程與溢價"
    topic="收回時程與溢價"
    path="/preferred/call-schedule"
    seo-title="特別股收回時程與溢價：最早可收回日、收回條件與溢價率"
    description="台灣上市櫃特別股收回時程：每一檔發行公司最早可以收回的日子、收回條件原文、發行價與現價、現價比發行價高出多少的溢價率，以及假設被收回時的收回殖利率。"
  >
    <section class="stock-page-section" aria-labelledby="preferred-call-heading">
      <h2 id="preferred-call-heading" class="stock-page-section__title">什麼時候可能被收回？用高於發行價的價格買會怎樣？</h2>
      <p class="hub-answer">
        多數特別股的發行條件寫明：滿一定年限後，發行公司可以依發行價收回。最早可收回日只是「可以」收回的日子，不代表一定會收回。
        被收回時拿回的是發行價：例如發行價 50 元、用 60 元買進，被收回就少拿回 10 元。溢價率就是現價比發行價高出的比例。
      </p>
      <p v-if="answer" class="hub-answer">{{ answer }}</p>
      <SharedTableScroll v-if="entries.length" label="特別股收回時程與溢價">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">各檔特別股的最早可收回日、收回條件、發行價、現價、溢價率與收回殖利率</caption>
          <thead>
            <tr>
              <th scope="col">特別股</th>
              <th scope="col">最早可收回日</th>
              <th scope="col">發行價</th>
              <th scope="col">現價</th>
              <th scope="col">溢價率</th>
              <th scope="col">收回殖利率</th>
              <th scope="col">收回條件</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in entries" :key="entry.symbol">
              <th scope="row"><NuxtLink :to="preferredStockPath(entry.symbol)">{{ entry.name }}</NuxtLink> {{ entry.symbol }}</th>
              <td>{{ statusText(entry) }}</td>
              <td class="seo-table__num">{{ preferredYuan(entry.issuePrice) }}</td>
              <td class="seo-table__num">{{ preferredYuan(entry.latestClosePrice) }}</td>
              <td class="seo-table__num">{{ preferredPct(entry.premiumRatePct) }}</td>
              <td class="seo-table__num">{{ preferredPct(entry.ytcPct) }}</td>
              <td class="preferred-call__conditions">{{ entry.redemptionConditions ?? '－' }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p class="hub-answer">收回殖利率假設在下一個可收回的時點以發行價收回；溢價很高的特別股，這個數字可能是負的。</p>
    </section>
  </PreferredZonePage>
</template>

<style scoped>
/* 收回條件是原文，可能很長：限寬讓它折行，不把表格撐到很寬 */
.preferred-call__conditions {
  min-width: 16rem;
  max-width: 28rem;
}
</style>
