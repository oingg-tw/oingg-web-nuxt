<script setup lang="ts">
import type { FactItem } from '~/components/shared/SharedFactList.vue'

// REITs 面向：基本資料（2026-10-30）。圖表看不出來的：全名、受託機構、上市與到期、發行總額、信用評等、收益分配政策的原文（公開資訊觀測站）。
// 持有的不動產在「標的不動產」那一頁
const reitData = await useReit()
const { code, reit, shortName } = reitData

const answer = computed(() => {
  const item = reit.value
  if (!item) return null
  const parts = [`${shortName.value}（${code.value}）${item.fundName ? `全名「${item.fundName}」` : '是不動產投資信託（REITs）'}`]
  if (item.trusteeName) parts.push(`受託機構是${item.trusteeName}`)
  if (item.listingDate) parts.push(`${item.listingDate} 上市`)
  if (item.maturityDate) parts.push(`到期日 ${item.maturityDate}`)
  return `${parts.join('，')}。`
})

const facts = computed<FactItem[]>(() => {
  const item = reit.value
  if (!item) return []
  return [
    { label: '基金全名', value: item.fundName ?? '－' },
    { label: '受託機構', value: item.trusteeName ?? '－' },
    { label: '上市日', value: item.listingDate ?? '－' },
    { label: '到期日', value: item.maturityDate ?? '－' },
    { label: '發行總額', value: item.totalIssueAmountNtd === null ? '－' : formatMoney(item.totalIssueAmountNtd) },
    { label: '信用評等', value: item.creditRating ?? '－' },
    { label: '收益分配', value: item.distributionPolicy ?? '－', note: '公開資訊觀測站原文' },
    ...(item.distributionNote ? [{ label: '收益分配說明', value: item.distributionNote, note: '公開資訊觀測站原文' }] : [])
  ]
})
</script>

<template>
  <ReitPage :reit-data="reitData" facet="profile" :description="answer">
    <StockQuestionSection id="reit-profile" :question="`${shortName}（${code}）是什麼？誰管理、收益怎麼分配？`" :answer="answer">
      <SharedFactList v-if="facts.length" :items="facts" :label="`${shortName}的基本資料`" />
    </StockQuestionSection>
  </ReitPage>
</template>
