<script setup lang="ts">
import type { HoldingsTraitsResult } from '~/utils/holdings-traits'

// 「這組持股有什麼特色？」（2026-10-19）：持股分析頁與分享頁共用，兩邊長一樣。問句 → 標籤 → 「指標｜這組持股｜大盤」表 → 計算方式。
// 數字與大盤都來自 業務中台（見 utils/holdings-traits.ts），標籤規則也在那裡。大盤還沒上線（market 是 null）時不畫大盤那一欄，
// 只貼不必跟大盤比的標籤（Beta）。只陳述數字與門檻，沒有排名、建議或「適合誰」；持股頁不放免責聲明（同其他持股頁）。
const props = defineProps<{
  traits: HoldingsTraitsResult
  // 同一頁可能有兩段問句，id 由呼叫端給
  headingId: string
}>()

const tags = computed(() => traitTags(props.traits))
const hasMarket = computed(() => !!props.traits.market)

// 組合與大盤都沒有值的那一列不畫（營收年增率波動在上游有資料之前不出現）；涵蓋不到全部市值時，意思後面寫涵蓋多少
const rows = computed(() => TRAIT_ROWS
  .filter(row => props.traits.portfolio[row.key]?.value != null || props.traits.market?.[row.key]?.value != null)
  .map((row) => {
    const own = props.traits.portfolio[row.key]
    const coverage = own?.coverage == null ? null : Number(own.coverage)
    return {
      name: row.name,
      value: traitText(own?.value, row.unit),
      market: row.key === 'beta' ? '1.00' : traitText(props.traits.market?.[row.key]?.value, row.unit),
      meaning: coverage !== null && coverage > 0 && coverage < 0.995 ? `${row.meaning}；涵蓋 ${Math.round(coverage * 100)}% 的市值` : row.meaning
    }
  }))
</script>

<template>
  <section class="holdings-traits" :aria-labelledby="headingId">
    <h2 :id="headingId" class="holdings-traits__title">這組持股有什麼特色？</h2>
    <ul v-if="tags.length" class="holdings-traits__tags" aria-label="特色標籤">
      <li v-for="tag in tags" :key="tag.label" class="holdings-traits__tag" :title="tag.rule">{{ tag.label }}</li>
    </ul>
    <p v-else class="holdings-traits__note">沒有達到任何標籤的門檻（門檻寫在下面的計算方式）。</p>
    <HoldingsMetricTable caption="這組持股的量化特色" :rows="rows" value-label="這組持股" :market-label="hasMarket ? '大盤' : undefined" />
    <p v-if="!hasMarket" class="holdings-traits__note holdings-traits__note--after">大盤對照還在準備中；跟大盤比的標籤（高殖利率、低本益比等）會在大盤資料到了之後一起出現。</p>
    <details class="holdings-details">
      <summary>計算方式</summary>
      <ul class="holdings-traits__notes">
        <li>依每一檔的市值占比加權<template v-if="traits.asOf">，以 {{ traits.asOf }} 的收盤價為準</template>。本益比、股價淨值比用調和平均（只算大於 0 的），其餘用加權平均，只算有數字的持股。</li>
        <li>ETF 與特別股沒有財報、也不分大中小型，本益比、股價淨值比、ROE、營收與規模不算入它們；Beta 用股價回推，ETF 也算在內，跟風險頁「近一年」的 Beta（回推）是同一個數字。</li>
        <li>規模：全市場普通股依市值由大到小累加，前 70% 算大型、70%～90% 算中型、其餘算小型（Morningstar 的分法）。</li>
        <li>前三大持股：市值最大的三檔占整組持股的比例，分母包含 ETF。ETF 拆不到成分股，不算進前三（0050 裡的台積電看不到）；特別股算一檔。</li>
        <li>大盤：全市場普通股（上市＋上櫃）依市值、用同一套算法，等於把全市場當成一組持股；大盤的 Beta 是 1。</li>
        <li>標籤的門檻（涵蓋不到一半市值的不貼）：<template v-for="(rule, index) in TAG_RULES" :key="rule.label">{{ index ? '；' : '' }}{{ rule.label }}：{{ rule.rule }}</template>。</li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.holdings-traits__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

/* 標籤：中性色的小框（不用漲跌色，不暗示好壞） */
.holdings-traits__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
}

.holdings-traits__tag {
  padding: 4px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.holdings-traits__note {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
}

.holdings-traits__note--after {
  margin: 12px 0 0;
}

.holdings-traits__notes {
  margin: 12px 0 0;
  padding-left: 20px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}
</style>
