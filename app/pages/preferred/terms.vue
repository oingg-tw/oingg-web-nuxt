<script setup lang="ts">
// /preferred/terms — 權利條款比較（2026-10-18）：六項條款並排。上游 null ＝ 未知（條款表 2026-09-08 起是快照），寫「未知」不寫「沒有」
const { entries } = await usePreferredZoneList()

const count = (pick: (entry: (typeof entries.value)[number]) => boolean | null) => entries.value.filter(entry => pick(entry) === true).length
const answer = computed(() => {
  const total = entries.value.length
  if (!total) return null
  return `${total} 檔中，累積型 ${count(entry => entry.cumulativeDividend)} 檔、參加型 ${count(entry => entry.participatingExcessDividend)} 檔、可轉換成普通股 ${count(entry => entry.convertible)} 檔、有表決權 ${count(entry => entry.votingRights)} 檔、發行公司可以收回的 ${count(entry => entry.redeemable)} 檔。`
})
</script>

<template>
  <PreferredZonePage
    title="特別股權利條款比較"
    topic="權利條款比較"
    path="/preferred/terms"
    seo-title="特別股權利條款比較：累積、參加、可轉換與可收回"
    description="台灣上市櫃特別股權利條款比較：每一檔的股息累積性、是否參加普通股盈餘分配、清算優先、表決權、能否轉換成普通股，以及發行公司能否依條款收回，並排對照。"
  >
    <section class="stock-page-section" aria-labelledby="preferred-terms-heading">
      <h2 id="preferred-terms-heading" class="stock-page-section__title">累積、參加、可轉換、表決權各是什麼？</h2>
      <p class="hub-answer">
        累積型：某一年沒配的股息之後要補發；非累積型沒配就沒了。參加型：除了約定的股息，還可以再參加普通股的盈餘分配。
        清算優先：公司清算時比普通股先拿回錢。可轉換：可以換成普通股。可收回：發行公司可以依條款用發行價收回。
      </p>
      <p v-if="answer" class="hub-answer">{{ answer }}</p>
      <SharedTableScroll v-if="entries.length" label="特別股權利條款比較">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">各檔特別股的股息累積性、參加權、清算優先、表決權、可轉換與可收回</caption>
          <thead>
            <tr>
              <th scope="col">特別股</th>
              <th scope="col">股息</th>
              <th scope="col">參加權</th>
              <th scope="col">清算優先</th>
              <th scope="col">表決權</th>
              <th scope="col">可轉換</th>
              <th scope="col">公司可收回</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in entries" :key="entry.symbol">
              <th scope="row"><NuxtLink :to="preferredStockPath(entry.symbol)">{{ entry.name }}</NuxtLink> {{ entry.symbol }}</th>
              <td>{{ preferredYesNo(entry.cumulativeDividend, '累積型', '非累積型') }}</td>
              <td>{{ preferredYesNo(entry.participatingExcessDividend, '參加型', '非參加型') }}</td>
              <td>{{ preferredYesNo(entry.liquidationPreference, '優先於普通股', '無') }}</td>
              <td>{{ preferredYesNo(entry.votingRights, '有', '無') }}</td>
              <td>{{ entry.convertible && entry.conversionStartDate ? `可以（${entry.conversionStartDate} 起）` : preferredYesNo(entry.convertible, '可以', '不可以') }}</td>
              <td>{{ preferredYesNo(entry.redeemable, '可以', '不可以') }}</td>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
    </section>
  </PreferredZonePage>
</template>
