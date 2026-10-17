<script setup lang="ts">
// /preferred — 特別股專區總覽（2026-10-18）：現在有哪幾檔，一張表。每一檔連到個別頁；其他主題頁在側欄
const { entries, today } = await usePreferredZoneList()

const listed = computed(() => entries.value.filter(entry => entry.marketType === '上市').length)
const answer = computed(() => {
  const total = entries.value.length
  if (!total) return null
  const passed = entries.value.filter(entry => redemptionStatus(entry, today) === 'passed').length
  return `目前有 ${total} 檔特別股，${listed.value} 檔上市、${total - listed.value} 檔上櫃。其中 ${passed} 檔已經過了最早可收回日、發行公司還沒有收回。特別股每年的股息大多事先寫在發行條件裡，但不保本：發行公司可以依條款收回，股價也會漲跌。`
})
</script>

<template>
  <PreferredZonePage
    title="台灣特別股專區"
    :path="PREFERRED_ZONE_PATH"
    seo-title="台灣特別股專區：全部特別股的殖利率、收回時程與條款"
    description="上市櫃特別股一覽：每一檔的現價、殖利率、最差殖利率與最早可收回日，並依殖利率、收回時程、實際配息、權利條款與成交量分頁比較。"
  >
    <section class="stock-page-section" aria-labelledby="preferred-index-heading">
      <h2 id="preferred-index-heading" class="stock-page-section__title">現在有哪些特別股？</h2>
      <p v-if="answer" class="hub-answer">{{ answer }}</p>
      <SharedTableScroll v-if="entries.length" label="特別股一覽">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">上市櫃特別股一覽：現價、殖利率、最差殖利率與最早可收回日</caption>
          <thead>
            <tr>
              <th scope="col">特別股</th>
              <th scope="col">市場</th>
              <th scope="col">現價</th>
              <th scope="col">殖利率</th>
              <th scope="col">最差殖利率</th>
              <th scope="col">最早可收回日</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in entries" :key="entry.symbol">
              <th scope="row"><NuxtLink :to="preferredStockPath(entry.symbol)">{{ entry.name }}</NuxtLink> {{ entry.symbol }}</th>
              <td>{{ entry.marketType }}</td>
              <td class="seo-table__num">{{ preferredYuan(entry.latestClosePrice) }}</td>
              <td class="seo-table__num">{{ preferredPct(entry.currentYieldPct) }}</td>
              <td class="seo-table__num">{{ preferredPct(entry.ytwPct) }}</td>
              <td>{{ entry.redeemable === false ? '不可收回' : entry.redemptionDate ?? '－' }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </section>

    <section class="stock-page-section" aria-labelledby="preferred-guide-heading">
      <h2 id="preferred-guide-heading" class="stock-page-section__title">特別股是什麼？</h2>
      <p class="hub-answer">
        特別股是公司發行的另一種股票：股息通常事先約定（例如每股每年 2.75 元），配息順序排在普通股前面，但大多沒有表決權。
        很多特別股可以由發行公司在一定年限後依發行價收回，所以用高於發行價的價格買進，被收回時會少拿回價差。
        想先弄懂幾種殖利率的差別，可以看<NuxtLink to="/blog/preferred-stock-yield-types-explained">特別股的三種殖利率</NuxtLink>；
        入門說明在<NuxtLink to="/blog/what-is-preferred-stock">特別股是什麼</NuxtLink>。
      </p>
    </section>
  </PreferredZonePage>
</template>
