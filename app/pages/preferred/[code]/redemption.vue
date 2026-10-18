<script setup lang="ts">
import type { FactItem } from '~/components/shared/SharedFactList.vue'

// 特別股個別頁：收回條款與溢價（2026-10-18）。最早可收回日只是「可以」收回的日子（不是已收回）；被收回時拿回發行價，所以用高於發行價的
// 價格買進，高出的部分就是損失。溢價的門檻沿用 hasNegativeConvexityWarning（2%）。只陳述「高出多少」，不說貴或危險
const preferred = await usePreferredStock()
const { code, entry, price, priceDate, shortName } = preferred
// 「今天」用台北日期（判斷最早可收回日過了沒）
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())

const dateText = computed(() => {
  const stockEntry = entry.value
  if (!stockEntry) return '－'
  if (stockEntry.redeemable === false) return '不可收回'
  const status = redemptionStatus(stockEntry, today)
  if (status === 'passed') return `${stockEntry.redemptionDate}（已過，發行公司還沒有收回）`
  if (status === 'upcoming') return `${stockEntry.redemptionDate}（還沒到）`
  // 可以收回、但條款沒寫日期（1312A「公司得自行訂定收回日」、2002A 章程只寫得收回）；上游 null 才是真的不知道
  return stockEntry.redeemable ? '條款未寫日期' : '未知'
})

const answer = computed(() => {
  const stockEntry = entry.value
  if (!stockEntry) return null
  if (stockEntry.redeemable === false) return `${shortName.value}（${code.value}）的發行條件沒有讓發行公司收回的條款。`
  const parts = [`${shortName.value}（${code.value}）最早可收回日：${dateText.value}`]
  if (stockEntry.issuePrice !== null && price.value !== null && stockEntry.premiumRatePct !== null) {
    parts.push(`；${priceDate.value ?? '最新'}收盤價 ${preferredYuan(price.value)}，比發行價 ${preferredYuan(stockEntry.issuePrice)}${stockEntry.premiumRatePct >= 0 ? '高' : '低'} ${preferredPct(Math.abs(stockEntry.premiumRatePct))}`)
  }
  if (stockEntry.ytcPct !== null) parts.push(`，假設被收回的收回殖利率 ${preferredPct(stockEntry.ytcPct)}`)
  return `${parts.join('')}。`
})

const facts = computed<FactItem[]>(() => {
  const stockEntry = entry.value
  if (!stockEntry) return []
  const premium = hasNegativeConvexityWarning(stockEntry)
  return [
    { label: '最早可收回日', value: dateText.value },
    { label: '收回條件', value: stockEntry.redemptionConditions ?? '－', note: '發行條件原文' },
    { label: '發行價', value: preferredYuan(stockEntry.issuePrice), note: '被收回時拿回的金額' },
    { label: '現價', value: preferredYuan(price.value), note: priceDate.value ?? undefined },
    {
      label: '溢價率',
      value: preferredPct(stockEntry.premiumRatePct),
      note: premium ? '現價高於發行價：公司依條款收回時，以發行價收回，高出的部分是損失' : '（現價 − 發行價）÷ 發行價',
      warning: premium
    },
    { label: '收回殖利率 YTC', value: preferredPct(stockEntry.ytcPct), note: (stockEntry.ytcAssumption && YTC_ASSUMPTION_TEXT[stockEntry.ytcAssumption]) || undefined },
    { label: '最差殖利率 YTW', value: preferredPct(stockEntry.ytwPct), note: '持有到期與被收回兩種情況取較低者' }
  ]
})
</script>

<template>
  <PreferredStockPage :preferred="preferred" topic="收回條款與溢價" :description="answer">
    <StockQuestionSection id="preferred-redemption" :question="`${shortName}（${code}）什麼時候可能被收回？用高於發行價的價格買會怎樣？`" :answer="answer">
      <SharedFactList :items="facts" :label="`${shortName}的收回條款與溢價`" />
      <p class="hub-answer">
        最早可收回日只是發行公司「可以」收回的日子，不代表一定會收回。被收回時拿回的是發行價：例如發行價 50 元、用 60 元買進，被收回就少拿回 10 元。
        溢價很高時，收回殖利率可能是負的。
      </p>
    </StockQuestionSection>
  </PreferredStockPage>
</template>
