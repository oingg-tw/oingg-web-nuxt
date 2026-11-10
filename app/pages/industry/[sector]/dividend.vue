<script setup lang="ts">
import type { SectorDividendSummaryPageData } from '#shared/types/hub'

// 類股面向：殖利率與股利成長（2026-10-01「每個產業的個別瀏覽頁 要做」；2026-10-21 起自成一頁）。每個點一家公司，軸跟 /industries/dividend
// 的類股版一樣，從總覽點進來看到的是同一張圖換一個層級。畫不出來的家數要講出來，否則讀者會以為圖上就是全部
const industry = await useIndustry('dividend')
const { code, sectorName, data, rows, noindex } = industry

const plotted = computed(() => (data.value ? industryScatterRows(data.value) : []))
// 不提「點」與「軸」：手機上那裡是四張表（IndustryFacetChart），電腦版的圖有軸名。卡片前只留結果（2026-11-06，使用者：「卡片之前的文字描述過多了，會失焦」），長的那句給搜尋結果
const answer = computed(() => (rows.value.length ? `${rows.value.length} 家裡有 ${plotted.value.length} 家同時有殖利率與持股股利 5 年成長率。` : null))
const description = computed(() => (rows.value.length
  ? `每家公司看兩個數字：殖利率與持股股利 5 年成長率。${rows.value.length} 家裡有 ${plotted.value.length} 家兩個數字都有；5 年前沒有配息紀錄的公司算不出成長率。沒有配息的公司殖利率計為 0%。`
  : null))

// 盈餘發放率（2026-11-10，使用者選的設計頁 claude.ai/artifact/9C1Go34LxegryCVFdiJaBo 類股頁那一張）：每家公司跟類股的中位數比。年度與中位數讀
// 類股分布（/industries/dividend 同一份），只比同一年度的數字；讀不到、或這個類股沒有數字就不畫這一段
const { data: summary } = await useFetch<SectorDividendSummaryPageData | null>('/api/hub/sector-dividend-summary', { key: 'hub-sector-dividend-summary', default: () => null })
const payoutYear = computed(() => summary.value?.dividendPayoutRatioFiscalYear ?? null)
const payoutMedian = computed(() => summary.value?.sectors.find(row => row.sectorCode === code)?.dividendPayoutRatio?.median ?? null)
const payout = computed(() => (data.value && payoutYear.value !== null && payoutMedian.value !== null ? industryPayoutRows(data.value, payoutYear.value) : null))
const payoutAnswer = computed(() => (payout.value?.shown.length
  ? `${payout.value.shown.length} 家有 ${payoutYear.value} 年度的發放率，中位數 ${industryPct(payoutMedian.value)}；配出的比賺的多（超過 100%）的有 ${payout.value.shown.filter(row => (row.dividendPayoutRatio as number) > 100).length} 家。`
  : null))
</script>

<template>
  <IndustryPage :code="code" :sector-name="sectorName" facet="dividend" :description="description" :noindex="noindex">
    <StockQuestionSection id="industry-dividend" :question="`${sectorName}公司的殖利率與股利成長長什麼樣？`" :answer="answer">
      <IndustryFacetChart v-if="data" :data="data" :sector-name="sectorName" facet="dividend" />
    </StockQuestionSection>
    <StockQuestionSection v-if="payout && payoutAnswer" id="industry-payout" :question="`${sectorName}的公司把多少盈餘配出去？`" :answer="payoutAnswer">
      <IndustryPayoutChart :shown="payout.shown" :missing="payout.missing" :median="payoutMedian!" :sector-name="sectorName" />
    </StockQuestionSection>
    <!-- 說明都在最後一張卡片之後（CLAUDE.md「卡片之前的文字」）：發放率那一段 2026-11-10 接在殖利率後面，殖利率那一段的說明跟著搬來這裡 -->
    <StockQuestionSection id="industry-dividend-notes" question="看這些數字要注意什麼？">
      <p class="hub-answer">5 年前沒有配息紀錄的公司算不出成長率，沒有配息的公司殖利率計為 0%。{{ HOLDER_DIVIDEND_NOTE }}</p>
      <template v-if="payout && payoutAnswer">
        <p class="hub-answer">盈餘發放率是 {{ payoutYear }} 年度的盈餘配出的現金股利，除以那一年的每股盈餘。虧損的公司沒有數值；有賺錢、過了隔年 6 月底還沒有分派公告的公司算 0%。<span class="app-wide-only">發放率的圖上，點的高低只是把靠在一起的公司錯開；超過 200% 的公司畫在最右邊的三角形。</span></p>
        <p v-if="payout.otherYear.length" class="hub-answer">另有 {{ payout.otherYear.length }} 家已經有更新一年的數字，類股的比較還在 {{ payoutYear }} 年度，這裡先不列。</p>
      </template>
      <p class="hub-answer">每家公司的數字在<NuxtLink :to="industryFacetPath(code, 'companies')" class="hub-inline-link">公司名單</NuxtLink>；同樣的兩個數字，34 個類股各自的中位數畫在一起是<NuxtLink to="/industries/dividend" class="hub-inline-link">類股殖利率分析</NuxtLink>。</p>
    </StockQuestionSection>
  </IndustryPage>
</template>
