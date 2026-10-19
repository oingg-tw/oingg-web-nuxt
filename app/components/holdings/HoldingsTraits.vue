<script setup lang="ts">
import type { HoldingsTraitsResult, Traits } from '~/utils/holdings-traits'

// 「這組持股有什麼特色？」（2026-10-19）：持股分析頁與分享頁共用，兩邊長一樣。
// 同日重新設計（使用者：「九宮格要拆兩個，大盤跟自己兩個合在一起太混淆了；這邊請好好設計讓 UIUX 是好的」）：文件式、沒有小標——
// 問句 → 答句（標籤＋依據，兩欄對齊）→ 九宮格兩張（這組持股｜大盤，寬時並排、窄時上下疊）→ 指標表（指標｜這組持股｜大盤）
// → 折疊的「指標的意思與計算方式」。說明都收進折疊區（使用者：「holdings 希望減少不必要的說明」）。
// 數字與大盤都來自 業務中台（見 utils/holdings-traits.ts），標籤規則也在那裡。大盤還沒上線（market 是 null）時不畫大盤那一欄與那一張，
// 只貼不必跟大盤比的標籤。只陳述數字與門檻，沒有排名、建議或「適合誰」；持股頁不放免責聲明（同其他持股頁）。
const props = defineProps<{
  traits: HoldingsTraitsResult
  // 同一頁可能有兩段問句，id 由呼叫端給
  headingId: string
}>()

const tags = computed(() => traitTags(props.traits))
const hasMarket = computed(() => !!props.traits.market)

// 九宮格（使用者：「要做 而且要九宮格」）：這組持股一張、大盤一張，同一套深淺底色（主色 light-9／8／7），比位置就好。
// 這組持股一格都分不出來時整個不畫，只留一句說明；大盤沒有資料時只畫這組持股
const BOX_KEYS = STYLE_BOX_ROWS.flatMap(row => STYLE_BOX_COLUMNS.map(column => styleBoxKey(row.key, column.key)))
const hasBox = (values: Traits | null) => !!values && BOX_KEYS.some(key => values[key]?.value != null)
const boxRows = (values: Traits) => STYLE_BOX_ROWS.map(row => ({
  label: row.label,
  cells: STYLE_BOX_COLUMNS.map(column => ({ key: column.key, ...boxCell(values[styleBoxKey(row.key, column.key)]?.value) }))
}))
const boxes = computed(() => {
  const { portfolio, market } = props.traits
  if (!hasBox(portfolio)) return []
  return [{ caption: '這組持股', rows: boxRows(portfolio) }, ...(market && hasBox(market) ? [{ caption: '大盤', rows: boxRows(market) }] : [])]
})
const boxCoverage = computed(() => Number(props.traits.portfolio[BOX_KEYS[0]!]?.coverage ?? 0))
const boxEmpty = computed(() => !boxes.value.length && hasBox(props.traits.market))

// 指標表：組合與大盤都沒有值的那一列不畫（營收年增率波動在上游有資料之前不出現）
const rows = computed(() => TRAIT_ROWS
  .filter(row => props.traits.portfolio[row.key]?.value != null || props.traits.market?.[row.key]?.value != null)
  .map(row => ({ ...row, value: traitText(props.traits.portfolio[row.key]?.value, row.unit), market: traitText(props.traits.market?.[row.key]?.value, row.unit) })))

// 涵蓋率在表格下面寫一次：同一個百分比的指標寫在一起（本益比、ROE… 通常一樣），99.5% 以上不寫
const coverageNote = computed(() => {
  const groups = new Map<number, string[]>()
  for (const row of rows.value) {
    const coverage = Number(props.traits.portfolio[row.key]?.coverage ?? 1)
    if (!(coverage > 0 && coverage < 0.995)) continue
    const pct = Math.round(coverage * 100)
    groups.set(pct, [...(groups.get(pct) ?? []), row.name])
  }
  return [...groups].map(([pct, names]) => `${names.join('、')}只算有數字的持股，占這組持股 ${pct}% 的市值。`).join('')
})
</script>

<template>
  <section class="holdings-traits" :aria-labelledby="headingId">
    <h2 :id="headingId" class="holdings-traits__title">這組持股有什麼特色？</h2>

    <!-- 答句：標籤（dt）＋依據（dd）兩欄對齊。門檻寫在折疊區 -->
    <dl v-if="tags.length" class="holdings-traits__tags">
      <template v-for="tag in tags" :key="tag.label">
        <dt class="holdings-traits__tag">{{ tag.label }}</dt>
        <dd><template v-for="(part, index) in tag.evidence" :key="part">{{ index ? '，' : '' }}<span class="holdings-traits__clause">{{ part }}</span></template></dd>
      </template>
    </dl>
    <p v-else class="holdings-traits__note">沒有達到任何標籤的門檻（門檻寫在下面的「指標的意思與計算方式」）。</p>

    <figure v-if="boxes.length" class="holdings-traits__boxes">
      <figcaption>規模與風格九宮格（占市值）</figcaption>
      <table v-for="box in boxes" :key="box.caption" class="holdings-traits__box">
        <caption>{{ box.caption }}<span class="visually-hidden">的規模與風格</span></caption>
        <thead>
          <tr>
            <td />
            <th v-for="column in STYLE_BOX_COLUMNS" :key="column.key" scope="col">{{ column.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in box.rows" :key="row.label">
            <th scope="row">{{ row.label }}</th>
            <td v-for="cell in row.cells" :key="cell.key" :class="cell.level ? `holdings-traits__cell--${cell.level}` : undefined">{{ cell.text }}</td>
          </tr>
        </tbody>
      </table>
    </figure>
    <p v-if="boxes.length && boxCoverage > 0 && boxCoverage < 0.995" class="holdings-traits__note holdings-traits__box-note">九宮格只算分得出規模與風格的個股，占這組持股 {{ Math.round(boxCoverage * 100) }}% 的市值。</p>
    <p v-else-if="boxEmpty" class="holdings-traits__note">九宮格只放分得出規模與風格的個股；這組持股全是 ETF、特別股或資料不夠分類的股票。</p>

    <!-- 原生三欄表（不用 HoldingsMetricTable：它在 640px 以下會把每一列變成有框的卡片）；寬度依內容，數字靠近名稱 -->
    <table class="seo-table holdings-traits__metrics">
      <caption class="visually-hidden">這組持股的量化特色</caption>
      <thead>
        <tr>
          <th scope="col">指標</th>
          <th scope="col" class="seo-table__num">這組持股</th>
          <th v-if="hasMarket" scope="col" class="seo-table__num">大盤</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <th scope="row">{{ row.name }}</th>
          <td class="seo-table__num holdings-traits__own">{{ row.value }}</td>
          <td v-if="hasMarket" class="seo-table__num">{{ row.market }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="coverageNote" class="holdings-traits__note holdings-traits__footnote">{{ coverageNote }}</p>
    <p v-if="!hasMarket" class="holdings-traits__note">大盤對照還在準備中；跟大盤比的標籤（高殖利率、低本益比等）會在大盤資料到了之後一起出現。</p>

    <!-- 裡面不放小標也不放表格：表格會讓「tbody tr」選到兩份同名的列 -->
    <details class="holdings-details">
      <summary>指標的意思與計算方式</summary>
      <dl class="holdings-traits__defs">
        <template v-for="row in rows" :key="row.key">
          <dt>{{ row.name }}</dt>
          <dd>{{ row.meaning }}</dd>
        </template>
      </dl>
      <ul class="holdings-traits__notes">
        <li>依每一檔的市值占比計算<template v-if="traits.asOf">，以 {{ traits.asOf }} 的收盤價為準</template>，只算有數字的持股。ETF 與特別股沒有財報，本益比、股價淨值比、ROE、營收與九宮格不算入它們。</li>
        <li>九宮格參考 Morningstar Style Box：全市場普通股依市值由大到小累加，前 70% 算大型、70%～90% 算中型、其餘算小型；風格看成長分數減價值分數——價值比的是盈餘、淨值、營收、營業現金流相對股價的高低與殖利率，成長比的是每股盈餘、淨值、營收、營業現金流近 1～4 年的成長——在同一規模裡照檔數三等分成價值、混合、成長。</li>
        <li>跟 Morningstar 不同的兩處：只用實際數字、不用分析師預估；三等分照檔數、不照市值（台積電一家就占大型股市值一半以上，照市值切不出三等分）。資料不夠分類的股票（多半是近兩年才上市）不算入九宮格，但「中小型為主」照樣算入它們的規模。</li>
        <li>大盤：全市場普通股（上市＋上櫃）依市值、用同一套算法，等於把全市場當成一組持股；大盤的 Beta 是 1。</li>
      </ul>
      <p class="holdings-traits__rules-title">標籤的門檻（涵蓋不到一半市值的不貼）：</p>
      <dl class="holdings-traits__defs">
        <template v-for="rule in TAG_RULES" :key="rule.label">
          <dt>{{ rule.label }}</dt>
          <dd>{{ rule.rule }}</dd>
        </template>
      </dl>
    </details>
  </section>
</template>

<style scoped>
.holdings-traits__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

/* 答句：標籤欄寬度一致，依據對齊成一欄 */
.holdings-traits__tags {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 12px;
  align-items: baseline;
  margin: 0 0 20px;
}

.holdings-traits__tags dd {
  margin: 0;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}

/* 標籤：中性色的小框（不用漲跌色，不暗示好壞） */
.holdings-traits__tag {
  justify-self: start;
  padding: 4px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  font-weight: 600;
}

/* 依據的每一段不斷行：手機上「大盤 3.0%」不會被拆成兩行 */
.holdings-traits__clause {
  white-space: nowrap;
}

.holdings-traits__note {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
}

/* 九宮格：這組持股｜大盤兩張，寬時並排、窄時上下疊（約 544px 以上並排，不設斷點） */
.holdings-traits__boxes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 20rem));
  gap: 12px 32px;
  margin: 0 0 8px;
}

.holdings-traits__boxes > figcaption {
  grid-column: 1 / -1;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.holdings-traits__box {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-variant-numeric: tabular-nums;
}

.holdings-traits__box caption {
  margin-bottom: 4px;
  text-align: left;
  color: var(--el-text-color-regular);
}

/* 格子的底跟指標表一樣是卡片色：淺色模式的 light-9 跟頁面底色幾乎一樣，壓在頁面上看不出最淺那一階 */
.holdings-traits__box th,
.holdings-traits__box td {
  padding: 8px 4px;
  border: 1px solid var(--el-border-color-lighter);
  text-align: center;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);
}

.holdings-traits__box td {
  font-size: 1.125rem;
  font-weight: 600;
}

/* 左上角空格 */
.holdings-traits__box thead td {
  width: 3.5em;
  border: 0;
  background: none;
}

/* 底色三階（依格子上寫的整數）：0 不上色、未滿 10% light-9、未滿 25% light-8、25% 以上 light-7。文字一律主要文字色——次要文字色
   壓在淺色模式的 light-7 上只剩約 3.4:1；主要文字色在 7 個主色 × 深淺模式都過 4.5:1（check-share-links 逐一量） */
.holdings-traits__box .holdings-traits__cell--1 {
  background: var(--el-color-primary-light-9);
}

.holdings-traits__box .holdings-traits__cell--2 {
  background: var(--el-color-primary-light-8);
}

.holdings-traits__box .holdings-traits__cell--3 {
  background: var(--el-color-primary-light-7);
}

/* 指標表：寬度依內容；名稱可以換行（seo-table 預設不換行），手機上三欄放得下 */
.holdings-traits__metrics {
  width: auto;
  margin: 20px 0 8px;
}

.holdings-traits__metrics tbody th {
  white-space: normal;
}

.holdings-traits__own {
  font-weight: 600;
}

/* 折疊區：名稱在上、意思在下（窄的時候兩欄會擠） */
.holdings-traits__defs {
  margin: 12px 0 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.holdings-traits__defs dt {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.holdings-traits__defs dd {
  margin: 0 0 8px;
}

.holdings-traits__notes {
  margin: 12px 0 0;
  padding-left: 20px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.holdings-traits__rules-title {
  margin: 12px 0 0;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
</style>
