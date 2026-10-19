<script setup lang="ts">
import type { HoldingsTraitsResult } from '~/utils/holdings-traits'

// 「這組持股有什麼特色？」（2026-10-19）：持股分析頁與分享頁共用，兩邊長一樣。問句 → 標籤 → 規模與風格九宮格 → 「指標｜這組持股｜大盤」
// 表 → 計算方式。
// 數字與大盤都來自 業務中台（見 utils/holdings-traits.ts），標籤規則也在那裡。大盤還沒上線（market 是 null）時不畫大盤那一欄，
// 只貼不必跟大盤比的標籤（Beta）。只陳述數字與門檻，沒有排名、建議或「適合誰」；持股頁不放免責聲明（同其他持股頁）。
const props = defineProps<{
  traits: HoldingsTraitsResult
  // 同一頁可能有兩段問句，id 由呼叫端給
  headingId: string
}>()

const tags = computed(() => traitTags(props.traits))
const hasMarket = computed(() => !!props.traits.market)

// 九宮格（使用者：「要做 而且要九宮格」）：這組持股有分得出規模與風格的個股才畫。每格寫這組持股的占比、下面一行大盤；底色依占比
// 分三階（主色 light-9／8／7），只是幫忙看，數字都寫出來
const BOX_KEYS = STYLE_BOX_ROWS.flatMap(row => STYLE_BOX_COLUMNS.map(column => styleBoxKey(row.key, column.key)))
const boxCoverage = computed(() => Number(props.traits.portfolio[BOX_KEYS[0]!]?.coverage ?? 0))
const styleBox = computed(() => {
  const own = props.traits.portfolio
  if (BOX_KEYS.every(key => own[key]?.value == null)) return null
  return STYLE_BOX_ROWS.map(row => ({
    label: row.label,
    cells: STYLE_BOX_COLUMNS.map((column) => {
      const key = styleBoxKey(row.key, column.key)
      const share = Number(own[key]?.value ?? 0)
      return {
        key,
        value: traitText(own[key]?.value, 'pct'),
        market: hasMarket.value ? traitText(props.traits.market?.[key]?.value, 'pct') : null,
        level: share >= 25 ? 3 : share >= 10 ? 2 : share > 0 ? 1 : 0
      }
    })
  }))
})
// 大盤有九宮格、這組持股卻一格都沒有：全是 ETF、特別股或資料不夠分類的股票
const styleBoxEmpty = computed(() => !styleBox.value && BOX_KEYS.some(key => props.traits.market?.[key]?.value != null))

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
    <template v-if="styleBox">
      <table class="holdings-traits__box">
        <caption class="holdings-traits__box-caption">規模與風格九宮格（占市值）</caption>
        <thead>
          <tr>
            <td />
            <th v-for="column in STYLE_BOX_COLUMNS" :key="column.key" scope="col">{{ column.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in styleBox" :key="row.label">
            <th scope="row">{{ row.label }}</th>
            <td v-for="cell in row.cells" :key="cell.key" :class="cell.level ? `holdings-traits__cell--${cell.level}` : undefined">
              <span class="holdings-traits__cell-value">{{ cell.value }}</span>
              <span v-if="cell.market" class="holdings-traits__cell-market">大盤 {{ cell.market }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="boxCoverage > 0 && boxCoverage < 0.995" class="holdings-traits__note">九宮格涵蓋 {{ Math.round(boxCoverage * 100) }}% 的市值（ETF、特別股與資料不夠分類的股票不算）。</p>
    </template>
    <p v-else-if="styleBoxEmpty" class="holdings-traits__note">九宮格只放分得出規模與風格的個股；這組持股全是 ETF、特別股或資料不夠分類的股票。</p>
    <HoldingsMetricTable caption="這組持股的量化特色" :rows="rows" value-label="這組持股" :market-label="hasMarket ? '大盤' : undefined" />
    <p v-if="!hasMarket" class="holdings-traits__note holdings-traits__note--after">大盤對照還在準備中；跟大盤比的標籤（高殖利率、低本益比等）會在大盤資料到了之後一起出現。</p>
    <details class="holdings-details">
      <summary>計算方式</summary>
      <ul class="holdings-traits__notes">
        <li>依每一檔的市值占比加權<template v-if="traits.asOf">，以 {{ traits.asOf }} 的收盤價為準</template>。本益比、股價淨值比用調和平均（只算大於 0 的），其餘用加權平均，只算有數字的持股。</li>
        <li>ETF 與特別股沒有財報，本益比、股價淨值比、ROE、營收與九宮格不算入它們；Beta 用股價回推，ETF 也算在內，跟風險頁「近一年」的 Beta（回推）是同一個數字。</li>
        <li>九宮格參考 Morningstar Style Box：全市場普通股依市值由大到小累加，前 70% 算大型、70%～90% 算中型、其餘算小型；風格看成長分數減價值分數——價值比的是盈餘、淨值、營收、營業現金流相對股價的高低與殖利率，成長比的是每股盈餘、淨值、營收、營業現金流近 1～4 年的成長——在同一規模裡照檔數三等分成價值、混合、成長。</li>
        <li>跟 Morningstar 不同的兩處：只用實際數字、不用分析師預估；三等分照檔數、不照市值（台積電一家就占大型股市值一半以上，照市值切不出三等分）。資料不夠分類的股票（多半是近兩年才上市）不算入九宮格。</li>
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

/* 九宮格：原生表格（列＝規模、欄＝風格），375px 也放得下三欄 */
.holdings-traits__box {
  width: 100%;
  max-width: 32rem;
  margin: 0 0 12px;
  border-collapse: collapse;
  table-layout: fixed;
}

.holdings-traits__box-caption {
  margin-bottom: 8px;
  text-align: left;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.holdings-traits__box th,
.holdings-traits__box td {
  padding: 8px 4px;
  border: 1px solid var(--el-border-color-lighter);
  text-align: center;
  color: var(--el-text-color-primary);
}

/* 左上角空格 */
.holdings-traits__box thead td {
  width: 3.5em;
  border: 0;
}

.holdings-traits__cell-value,
.holdings-traits__cell-market {
  display: block;
  font-variant-numeric: tabular-nums;
}

.holdings-traits__cell-value {
  font-size: 1.125rem;
  font-weight: 600;
}

/* 底色三階：0 不上色、未滿 10% light-9、未滿 25% light-8、25% 以上 light-7。文字一律主要文字色——次要文字色壓在淺色模式的
   light-7 上只剩約 3.4:1；主要文字色在 7 個主色 × 深淺模式都過 4.5:1（check-share-links 逐一量） */
.holdings-traits__cell--1 {
  background: var(--el-color-primary-light-9);
}

.holdings-traits__cell--2 {
  background: var(--el-color-primary-light-8);
}

.holdings-traits__cell--3 {
  background: var(--el-color-primary-light-7);
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
