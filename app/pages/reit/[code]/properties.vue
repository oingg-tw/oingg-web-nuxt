<script setup lang="ts">
// REITs 面向：標的不動產（2026-10-30，數據中台 3a8fd18 的 properties）。一筆一列，值照公開資訊觀測站原文（面積帶單位、估價金額含估價機構），
// 不換算、不加總：原文的單位與估價基準日各筆不一定相同
const reitData = await useReit()
const { code, reit, shortName } = reitData

const properties = computed(() => reit.value?.properties ?? [])
const hasNote = computed(() => properties.value.some(property => property.note))

const answer = computed(() => {
  if (!reit.value) return null
  if (!properties.value.length) return `目前沒有${shortName.value}（${code.value}）的標的不動產資料。`
  const types = [...new Set(properties.value.map(property => property.propertyType).filter(Boolean))]
  return `${shortName.value}（${code.value}）公告的標的不動產共 ${properties.value.length} 筆${types.length ? `，類型有${types.join('、')}` : ''}。`
})
</script>

<template>
  <ReitPage :reit-data="reitData" facet="properties" :description="answer">
    <StockQuestionSection id="reit-properties" :question="`${shortName}（${code}）持有哪些不動產？`" :answer="answer">
      <SharedTable v-if="properties.length" :label="`${shortName}的標的不動產`" :caption="`${shortName} ${code} 的標的不動產：名稱、類型、地址、樓層、面積與估價金額`">
        <thead>
          <tr>
            <th scope="col">名稱</th>
            <th scope="col">類型</th>
            <th scope="col">地址</th>
            <th scope="col">樓層</th>
            <th scope="col">面積</th>
            <th scope="col">估價金額</th>
            <th v-if="hasNote" scope="col">備註</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(property, index) in properties" :key="index" class="reit-properties__row">
            <th scope="row">{{ property.name ?? '－' }}</th>
            <td>{{ property.propertyType ?? '－' }}</td>
            <td>{{ property.address ?? '－' }}</td>
            <td>{{ property.floors ?? '－' }}</td>
            <td>{{ property.area ?? '－' }}</td>
            <td>{{ property.appraisalValue ?? '－' }}</td>
            <td v-if="hasNote">{{ property.note || '－' }}</td>
          </tr>
        </tbody>
      </SharedTable>
      <p class="hub-answer">以上是公開資訊觀測站的公告原文，面積、估價金額與估價機構以受託機構的正式公告為準。</p>
    </StockQuestionSection>
  </ReitPage>
</template>

<style scoped>
/* 全站表格不換行；這裡每一格都是公告原文、可能很長（01001T 的樓層寫到三段地址、估價金額含估價機構），桌機上換行，不必左右捲才看得到 */
.reit-properties__row > * {
  white-space: normal;
  min-width: 6em;
}
</style>
