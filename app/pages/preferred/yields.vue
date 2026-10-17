<script setup lang="ts">
// /preferred/yields — 殖利率比較（2026-10-18）：票面利率、殖利率、最差殖利率三種算法並排。排序依代號，不依殖利率高低（不排名）
const { entries } = await usePreferredZoneList()

const answer = computed(() => {
  const withBoth = entries.value.filter(entry => entry.currentYieldPct !== null && entry.ytwPct !== null)
  if (!withBoth.length) return null
  const lower = withBoth.filter(entry => entry.ytwPct! < entry.currentYieldPct! - 0.005).length
  return `${withBoth.length} 檔兩種都算得出來，其中 ${lower} 檔的最差殖利率比殖利率低——把可能被收回算進去，報酬會比只看殖利率少。`
})
</script>

<template>
  <PreferredZonePage
    title="特別股殖利率比較"
    topic="殖利率比較"
    path="/preferred/yields"
    seo-title="特別股殖利率比較：票面利率、殖利率與最差殖利率"
    description="台灣上市櫃特別股殖利率比較：每一檔的每年股息、發行價、票面利率、用現價算的殖利率與最差殖利率（YTW），以及最差殖利率假設在什麼時點被收回，三種算法並排對照。"
  >
    <section class="stock-page-section" aria-labelledby="preferred-yields-heading">
      <h2 id="preferred-yields-heading" class="stock-page-section__title">票面利率、殖利率、最差殖利率差在哪？</h2>
      <p class="hub-answer">
        票面利率是每年股息除以發行價，發行時就定了；殖利率是每年股息除以現在的價格，用現價買進每年領回幾 %；
        最差殖利率是在「持有到底」與「被發行公司收回」兩種情況裡取比較低的那個，把收回時少拿的價差也算進去。
      </p>
      <p v-if="answer" class="hub-answer">{{ answer }}</p>
      <SharedTableScroll v-if="entries.length" label="特別股殖利率比較">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">各檔特別股的每年股息、發行價、票面利率、現價、殖利率與最差殖利率</caption>
          <thead>
            <tr>
              <th scope="col">特別股</th>
              <th scope="col">每年股息</th>
              <th scope="col">發行價</th>
              <th scope="col">票面利率</th>
              <th scope="col">現價</th>
              <th scope="col">殖利率</th>
              <th scope="col">最差殖利率</th>
              <th scope="col">最差殖利率的假設</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in entries" :key="entry.symbol">
              <th scope="row"><NuxtLink :to="preferredStockPath(entry.symbol)">{{ entry.name }}</NuxtLink> {{ entry.symbol }}</th>
              <td class="seo-table__num">{{ preferredYuan(entry.dividendRate) }}</td>
              <td class="seo-table__num">{{ preferredYuan(entry.issuePrice) }}</td>
              <td class="seo-table__num">{{ preferredPct(entry.nominalDividendRatePct) }}</td>
              <td class="seo-table__num">{{ preferredYuan(entry.latestClosePrice) }}</td>
              <td class="seo-table__num">{{ preferredPct(entry.currentYieldPct) }}</td>
              <td class="seo-table__num">{{ preferredPct(entry.ytwPct) }}</td>
              <td>{{ entry.redeemable === false ? '不可收回，同殖利率' : YTC_ASSUMPTION_TEXT[entry.ytcAssumption ?? ''] ?? '－' }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <p class="hub-answer">每年股息是目前公告的金額；股息會重設的特別股，過去實際配發的金額可能不同，見<NuxtLink to="/preferred/dividends">實際配息紀錄</NuxtLink>。</p>
    </section>
  </PreferredZonePage>
</template>
