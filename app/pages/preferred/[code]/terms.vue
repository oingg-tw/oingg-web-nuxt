<script setup lang="ts">
import type { FactItem } from '~/components/shared/SharedFactList.vue'

// 特別股個別頁：權利條款（2026-10-18 從個別頁的第二段拆成自己一個面向）。上游 null 是「未知」不是「沒有」
const preferred = await usePreferredStock()
const { code, entry, shortName } = preferred

const answer = computed(() => {
  const stockEntry = entry.value
  if (!stockEntry) return null
  const terms = [
    stockEntry.cumulativeDividend === null ? null : stockEntry.cumulativeDividend ? '累積型（當年沒發的股息之後補發）' : '非累積型（當年沒發的股息不補發）',
    stockEntry.participatingExcessDividend === null ? null : stockEntry.participatingExcessDividend ? '參加型' : '非參加型',
    stockEntry.convertible ? '可以轉換成普通股' : null,
    stockEntry.redeemable ? '發行公司可以依條款收回' : null
  ].filter((term): term is string => term !== null)
  return terms.length ? `${shortName.value}（${code.value}）是${terms.join('、')}。` : null
})

const facts = computed<FactItem[]>(() => {
  const stockEntry = entry.value
  if (!stockEntry) return []
  return [
    { label: '股息累積性', value: preferredYesNo(stockEntry.cumulativeDividend, '累積型', '非累積型') },
    { label: '股息參與權', value: preferredYesNo(stockEntry.participatingExcessDividend, '參加型', '非參加型'), note: stockEntry.participatingExcessDividend ? '可以再參加普通股的盈餘分配' : undefined },
    { label: '清算優先權', value: preferredYesNo(stockEntry.liquidationPreference, '優先於普通股', '無') },
    { label: '表決權', value: preferredYesNo(stockEntry.votingRights, '有', '無') },
    { label: '可轉換普通股', value: preferredYesNo(stockEntry.convertible, '可以', '不可以'), note: stockEntry.convertible && stockEntry.conversionStartDate ? `${stockEntry.conversionStartDate} 起` : undefined },
    { label: '公司可收回', value: preferredYesNo(stockEntry.redeemable, '可以', '不可以') },
    { label: '發行日', value: stockEntry.issueDate ?? '－' },
    { label: '上市日', value: stockEntry.listingDate ?? '－' },
    { label: '市場', value: stockEntry.marketType },
    // 發行公司的信用評等（2026-10-31）：每家機構一列，MOPS 原文。有的最新一筆已經好幾年（國泰金 2015），所以寫公布日
    ...(stockEntry.issuerCreditRatings.length
      ? stockEntry.issuerCreditRatings.map(rating => ({
        label: `發行公司信用評等（${ratingAgencyShort(rating.ratingAgency)}）`,
        value: [ratingValue(rating.longTermRating) && `長期 ${rating.longTermRating}`, ratingValue(rating.shortTermRating) && `短期 ${rating.shortTermRating}`].filter(Boolean).join('、') || '－',
        note: [ratingValue(rating.outlook) && `展望 ${rating.outlook}`, `${rating.announcementDate} 公布`, rating.ratingAgency].filter(Boolean).join('，')
      }))
      : [{ label: '發行公司信用評等', value: '公開資訊觀測站沒有申報紀錄' }])
  ]
})
</script>

<template>
  <PreferredStockPage :preferred="preferred" topic="權利條款" :description="answer">
    <StockQuestionSection id="preferred-terms" :question="`${shortName}（${code}）有哪些權利與條款？`" :answer="answer">
      <SharedFactList :items="facts" :label="`${shortName}的權利與條款`" />
      <p v-if="entry?.issuerCreditRatings.length" class="hub-answer">信用評等是發行公司向公開資訊觀測站申報的各家機構評等原文，是發行公司的，不是這檔特別股本身的評等，也不是本站的評等。</p>
    </StockQuestionSection>
  </PreferredStockPage>
</template>
