<script setup lang="ts">
import type { HoldingsTraitsResult, Traits } from '~/utils/holdings-traits'

// 「這組持股有什麼特色？」（2026-10-19）：持股分析頁與分享頁共用，兩邊長一樣。
// 同日兩次重新設計。使用者先說：「九宮格要拆兩個，大盤跟自己兩個合在一起太混淆了」；第二版又說：「看起來還是醜醜的，而且資訊還重複了」
// （標籤後面寫的依據跟指標表同一批數字、涵蓋率寫兩次；格線像試算表；各區塊寬度不一）。現在：問句 → 一塊面板（同持股總覽的面板）：
// 標籤一排（只有名字，跟全站的 ETF 標籤同一種）→ 這組持股的九宮格在左、指標表在右（放不下時表格換到下面）→ 涵蓋率一行；
// 每個數字只出現一次。面板外是折疊的「指標的意思與計算方式」（使用者：「holdings 希望減少不必要的說明」）。
// 數字與大盤都來自 業務中台（見 utils/holdings-traits.ts），標籤規則也在那裡。大盤還沒上線（market 是 null）時不畫大盤那一欄與那一張，
// 只貼不必跟大盤比的標籤。只陳述數字與門檻，沒有排名、建議或「適合誰」；持股頁不放免責聲明（同其他持股頁）。
const props = defineProps<{
  traits: HoldingsTraitsResult
  // 同一頁可能有兩段問句，id 由呼叫端給
  headingId: string
}>()

const tags = computed(() => traitTags(props.traits))
const hasMarket = computed(() => !!props.traits.market)

// 九宮格（使用者：「要做 而且要九宮格」）：只畫這組持股一張，深淺分三階（主色 light-9／8／7）。大盤那張拿掉了（使用者：「左邊那兩個
// 九宮格看起來還是怪尷尬的，隱藏大盤九宮格是不是比較好」）——大盤的分布每組持股看到的都一樣（約一半在大型混合），只在計算方式提一句。
// 這組持股一格都分不出來時整個不畫，只留一句說明
const BOX_KEYS = STYLE_BOX_ROWS.flatMap(row => STYLE_BOX_COLUMNS.map(column => styleBoxKey(row.key, column.key)))
const hasBox = (values: Traits | null) => !!values && BOX_KEYS.some(key => values[key]?.value != null)
const ownBox = computed(() => {
  const own = props.traits.portfolio
  if (!hasBox(own)) return null
  return STYLE_BOX_ROWS.map(row => ({
    label: row.label,
    cells: STYLE_BOX_COLUMNS.map(column => ({ key: column.key, ...boxCell(own[styleBoxKey(row.key, column.key)]?.value) }))
  }))
})
const boxEmpty = computed(() => !ownBox.value && hasBox(props.traits.market))
// 大盤最多落在哪一格（給計算方式那一句）
const marketTopCell = computed(() => {
  const market = props.traits.market
  if (!market || !hasBox(market)) return ''
  const cells = STYLE_BOX_ROWS.flatMap(row => STYLE_BOX_COLUMNS.map(column => ({ label: `${row.label}${column.label}`, value: market[styleBoxKey(row.key, column.key)]?.value ?? null })))
  const top = cells.reduce((max, cell) => (Number(cell.value ?? 0) > Number(max.value ?? 0) ? cell : max))
  return `${top.label}（${boxCell(top.value).text}）`
})

// 指標表：組合與大盤都沒有值的那一列不畫（營收年增率波動在上游有資料之前不出現）
const rows = computed(() => TRAIT_ROWS
  .filter(row => props.traits.portfolio[row.key]?.value != null || props.traits.market?.[row.key]?.value != null)
  .map(row => ({ ...row, value: traitText(props.traits.portfolio[row.key]?.value, row.unit), market: traitText(props.traits.market?.[row.key]?.value, row.unit) })))

// 涵蓋率只寫一行：九宮格與各指標依涵蓋的百分比分組（通常 ETF、特別股一起被排除，全部同一個數），99.5% 以上不寫
const coverageNote = computed(() => {
  const coverageOf = (key: keyof Traits) => Number(props.traits.portfolio[key]?.coverage ?? 1)
  const entries = [...(ownBox.value ? [{ name: '九宮格', coverage: coverageOf(BOX_KEYS[0]!) }] : []), ...rows.value.map(row => ({ name: row.name, coverage: coverageOf(row.key) }))]
  const groups = new Map<number, string[]>()
  for (const { name, coverage } of entries) {
    if (!(coverage > 0 && coverage < 0.995)) continue
    const pct = Math.round(coverage * 100)
    groups.set(pct, [...(groups.get(pct) ?? []), name])
  }
  return [...groups].map(([pct, names]) => `${names.length === 1 ? names[0] : `${names[0]}與${names[1]}${names.length > 2 ? '等指標' : ''}`}只涵蓋這組持股 ${pct}% 的市值。`).join('')
})
</script>

<template>
  <section class="holdings-traits" :aria-labelledby="headingId">
    <h2 :id="headingId" class="holdings-traits__title">這組持股有什麼特色？</h2>

    <div class="holdings-traits__panel">
      <!-- 答句：標籤一排，只有名字；數字在下面，門檻在折疊區 -->
      <ul v-if="tags.length" class="holdings-traits__tags" role="list" aria-label="特色標籤">
        <li v-for="tag in tags" :key="tag"><el-tag effect="plain" size="large" class="holdings-traits__tag">{{ tag }}</el-tag></li>
      </ul>
      <p v-else class="holdings-traits__tags holdings-traits__none">沒有達到任何標籤的門檻（門檻寫在下面的「指標的意思與計算方式」）。</p>

      <!-- 九宮格在左、指標表在右；放不下時表格換到下面 -->
      <div class="holdings-traits__body">
        <figure v-if="ownBox" class="holdings-traits__boxes">
          <figcaption>規模與風格九宮格（占市值）</figcaption>
          <table class="holdings-traits__box">
            <caption class="visually-hidden">這組持股的規模與風格</caption>
            <thead>
              <tr>
                <td />
                <th v-for="column in STYLE_BOX_COLUMNS" :key="column.key" scope="col">{{ column.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in ownBox" :key="row.label">
                <th scope="row">{{ row.label }}</th>
                <td v-for="cell in row.cells" :key="cell.key" :class="`holdings-traits__cell--${cell.level}`">{{ cell.text }}</td>
              </tr>
            </tbody>
          </table>
        </figure>
        <!-- 原生表格（不用 HoldingsMetricTable：它在 640px 以下會把每一列變成有框的卡片） -->
        <div class="holdings-traits__metrics">
          <table class="seo-table">
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
        </div>
      </div>

      <p v-if="boxEmpty" class="holdings-traits__note">九宮格只放分得出規模與風格的個股；這組持股全是 ETF、特別股或資料不夠分類的股票。</p>
      <p v-if="coverageNote" class="holdings-traits__note holdings-traits__coverage">{{ coverageNote }}</p>
      <p v-if="!hasMarket" class="holdings-traits__note">大盤對照還在準備中；跟大盤比的標籤（高殖利率、低本益比等）會在大盤資料到了之後一起出現。</p>
    </div>

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
        <li>大盤：全市場普通股（上市＋上櫃）依市值、用同一套算法，等於把全市場當成一組持股；大盤的 Beta 是 1<template v-if="marketTopCell">；九宮格裡大盤最多落在{{ marketTopCell }}</template>。</li>
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

/* 一塊面板（框線、圓角、底色同持股總覽），九宮格的色塊壓在卡片色上才分得出最淺那一階 */
.holdings-traits__panel {
  padding: 16px 20px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

/* 答句：標籤一排，下面一條分隔線 */
.holdings-traits__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 16px;
  padding: 0 0 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  list-style: none;
}

.holdings-traits__tag {
  font-weight: 600;
}

.holdings-traits__none {
  display: block;
  color: var(--el-text-color-regular);
}

.holdings-traits__body {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 20px 40px;
}

.holdings-traits__boxes {
  margin: 0;
}

.holdings-traits__boxes > figcaption {
  margin-bottom: 4px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* 每一格是一塊色塊、不畫格線（不像試算表）：0 是淺灰、字淡；有占比的依格子上寫的整數分三階主色。
   只有一張，格子放大一點，跟右邊的表格比較平衡；375px 的面板裡也放得下 */
.holdings-traits__box {
  width: 18rem;
  max-width: 100%;
  border-collapse: separate;
  border-spacing: 4px;
  table-layout: fixed;
  font-variant-numeric: tabular-nums;
}

.holdings-traits__box th {
  padding: 0;
  font-weight: 400;
  color: var(--el-text-color-regular);
}

/* 左上角空格決定列名那一欄的寬度 */
.holdings-traits__box thead td {
  width: 2.5em;
}

.holdings-traits__box tbody td {
  height: 3.5rem;
  font-size: 1.125rem;
  border-radius: 4px;
  text-align: center;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* 文字一律主要文字色（0 用次要文字色）——次要文字色壓在淺色模式的 light-7 上只剩約 3.4:1；各組合都由 check-share-links 逐一量 */
.holdings-traits__box .holdings-traits__cell--0 {
  background: var(--el-fill-color-light);
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.holdings-traits__box .holdings-traits__cell--1 {
  background: var(--el-color-primary-light-9);
}

.holdings-traits__box .holdings-traits__cell--2 {
  background: var(--el-color-primary-light-8);
}

.holdings-traits__box .holdings-traits__cell--3 {
  background: var(--el-color-primary-light-7);
}

/* 指標表：佔剩下的寬度（最多約 34rem）；名稱可以換行（seo-table 預設不換行），手機上三欄放得下 */
.holdings-traits__metrics {
  flex: 1 1 20rem;
  max-width: 34rem;
}

.holdings-traits__metrics tbody th {
  white-space: normal;
}

.holdings-traits__own {
  font-weight: 600;
}

.holdings-traits__note {
  margin: 16px 0 0;
  color: var(--el-text-color-regular);
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
