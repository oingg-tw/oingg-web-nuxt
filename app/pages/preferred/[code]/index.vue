<script setup lang="ts">
import type { FactItem } from '~/components/shared/SharedFactList.vue'

// 特別股個別頁：股息與殖利率（2026-09-06 使用者要求「特別股清單以外，特別股個別瀏覽畫面」；2026-10-15 三組篩選重新設計時改寫）。
// 2026-10-18 從 /screener/preferred/{代號} 搬到 /preferred/{代號}（舊網址由 server/middleware/legacy-redirects.ts 301 過來），同一天拆成四個面向，
// 這一頁是第一個；骨架、側欄、SEO 在 PreferredStockPage。
// 拿掉永遠顯示「尚未提供」的部分：償債能力、清算優先倍數、清算優先順位、投資人賣回權，上游一直是 null
const preferred = await usePreferredStock()
const { code, entry, price, priceDate, shortName } = preferred

const answer = computed(() => {
  const stockEntry = entry.value
  if (!stockEntry) return null
  const parts = [`${shortName.value}（${code.value}）每年股息 ${preferredYuan(stockEntry.dividendRate)}`]
  if (stockEntry.issuePrice !== null && stockEntry.nominalDividendRatePct !== null) parts.push(`，以發行價 ${preferredYuan(stockEntry.issuePrice)}計算的票面利率 ${preferredPct(stockEntry.nominalDividendRatePct)}`)
  if (price.value !== null && stockEntry.currentYieldPct !== null) parts.push(`；以 ${priceDate.value ?? '最新'}收盤價 ${preferredYuan(price.value)}計算，殖利率 ${preferredPct(stockEntry.currentYieldPct)}`)
  if (stockEntry.ytwPct !== null) parts.push(`，最差情境殖利率（YTW）${preferredPct(stockEntry.ytwPct)}`)
  return `${parts.join('')}。`
})

const facts = computed<FactItem[]>(() => {
  const stockEntry = entry.value
  if (!stockEntry) return []
  return [
    { label: '每年股息', value: preferredYuan(stockEntry.dividendRate) },
    { label: '發行價', value: preferredYuan(stockEntry.issuePrice) },
    { label: '票面利率', value: preferredPct(stockEntry.nominalDividendRatePct), note: '股息 ÷ 發行價' },
    { label: '收盤價', value: preferredYuan(price.value), note: priceDate.value ?? undefined },
    { label: '殖利率', value: preferredPct(stockEntry.currentYieldPct), note: '股息 ÷ 收盤價' },
    { label: '最差殖利率 YTW', value: preferredPct(stockEntry.ytwPct), note: '持有到期與被收回兩種情況取較低者' }
  ]
})
</script>

<template>
  <PreferredStockPage :preferred="preferred" topic="股息與殖利率" :description="answer">
    <StockQuestionSection id="preferred-yield" :question="`${shortName}（${code}）的股息怎麼算？`" :answer="answer">
      <SharedFactList :items="facts" :label="`${shortName}的股息與殖利率`" />
    </StockQuestionSection>
  </PreferredStockPage>
</template>
