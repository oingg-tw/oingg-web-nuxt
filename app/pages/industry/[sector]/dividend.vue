<script setup lang="ts">
// 類股面向：殖利率與股利成長（2026-10-01「每個產業的個別瀏覽頁 要做」；2026-10-21 起自成一頁）。每個點一家公司，軸跟 /industries/dividend
// 的類股版一樣，從總覽點進來看到的是同一張圖換一個層級。畫不出來的家數要講出來，否則讀者會以為圖上就是全部
const industry = await useIndustry('dividend')
const { code, sectorName, data, rows, noindex } = industry

const plotted = computed(() => (data.value ? industryScatterRows(data.value) : []))
const answer = computed(() => (rows.value.length
  // 不提「點」與「軸」：手機上那裡是四張表（IndustryFacetChart），電腦版的圖有軸名
  ? `每家公司看兩個數字：殖利率與持股股利 5 年成長率。${rows.value.length} 家裡有 ${plotted.value.length} 家兩個數字都有；5 年前沒有配息紀錄的公司算不出成長率。沒有配息的公司殖利率計為 0%。`
  : null))
</script>

<template>
  <IndustryPage :code="code" :sector-name="sectorName" facet="dividend" :description="answer" :noindex="noindex">
    <StockQuestionSection id="industry-dividend" :question="`${sectorName}公司的殖利率與股利成長長什麼樣？`" :answer="answer">
      <IndustryFacetChart v-if="data" :data="data" :sector-name="sectorName" facet="dividend" />
      <p class="hub-answer">{{ HOLDER_DIVIDEND_NOTE }}</p>
      <p class="hub-answer">每家公司的數字在<NuxtLink :to="industryFacetPath(code, 'companies')" class="hub-inline-link">公司名單</NuxtLink>；同樣的兩個數字，34 個類股各自的中位數畫在一起是<NuxtLink to="/industries/dividend" class="hub-inline-link">類股殖利率分析</NuxtLink>。</p>
    </StockQuestionSection>
  </IndustryPage>
</template>
