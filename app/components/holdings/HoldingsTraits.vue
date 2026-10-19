<script setup lang="ts">
import type { HoldingsTraitsResult, Traits } from '~/utils/holdings-traits'

// 「這組持股有什麼特色？」（2026-10-19）：持股分析頁與分享頁共用，兩邊長一樣。
// 同日兩次重新設計。使用者先說：「九宮格要拆兩個，大盤跟自己兩個合在一起太混淆了」；第二版又說：「看起來還是醜醜的，而且資訊還重複了」
// （標籤後面寫的依據跟指標表同一批數字、涵蓋率寫兩次；格線像試算表；各區塊寬度不一）。現在：問句 → 標籤一排（只有名字，跟全站的
// ETF 標籤同一種）→ 一塊面板（同持股總覽的面板）：上層九宮格「這組持股 vs 大盤」→ 下層指標表全寬 → 涵蓋率一行；每個數字只出現
// 一次。面板外是折疊的「指標的意思與計算方式」（使用者：「holdings 希望減少不必要的說明」）。
// 數字與大盤都來自 業務中台（見 utils/holdings-traits.ts），標籤規則也在那裡。大盤還沒上線（market 是 null）時不畫大盤那一欄與那一張，
// 只貼不必跟大盤比的標籤。只陳述數字與門檻，沒有排名、建議或「適合誰」；持股頁不放免責聲明（同其他持股頁）。
const props = defineProps<{
  traits: HoldingsTraitsResult
  // 同一頁可能有兩段問句，id 由呼叫端給
  headingId: string
}>()

const tags = computed(() => traitTags(props.traits))
const hasMarket = computed(() => !!props.traits.market)

// 九宮格（使用者：「要做 而且要九宮格」）：這組持股一張、大盤一張，深淺分三階（主色 light-9／8／7），比位置就好。排法試過三種：
// 並排在表格左邊（「怪尷尬的」）、只留一張（「畫面不平衡」），使用者最後選上下兩層——兩張並排、各占一半寬、在自己那一半置中，
// 指標表全寬放在下面。這組持股一格都分不出來時整個不畫，只留一句說明；大盤沒有資料時只畫這組持股
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
const boxEmpty = computed(() => !boxes.value.length && hasBox(props.traits.market))

// 指標表：組合與大盤都沒有值的那一列不畫（營收年增率波動在上游有資料之前不出現）
const rows = computed(() => TRAIT_ROWS
  .filter(row => props.traits.portfolio[row.key]?.value != null || props.traits.market?.[row.key]?.value != null)
  .map(row => ({ ...row, value: traitText(props.traits.portfolio[row.key]?.value, row.unit), market: traitText(props.traits.market?.[row.key]?.value, row.unit) })))

// 指標的意思與計算方式（使用者：「打開怎麼看都像散亂的文字，這邊也請設計下」）：照頁面上的順序分四組——標籤、九宮格、指標、大盤，
// 每組一個小標＋「名稱｜說明」兩欄（窄的時候上下），說明一兩句。九宮格不算哪些股票也寫在這裡，不放在面板上（使用者：「這句話為什麼
// 不放在指標的意思與計算方式當中？」）——它原本是「九宮格只涵蓋這組持股 83% 的市值」，使用者看不懂，收成現在這句
const methodGroups = computed(() => [
  { title: '標籤的門檻', note: '每一組持股都用同一套門檻；涵蓋不到一半市值的不貼。', items: TAG_RULES.map(rule => ({ term: rule.label, text: rule.rule })) },
  {
    title: '九宮格',
    note: '',
    items: [
      { term: '規模', text: '全市場普通股依市值由大到小累加，前 70% 是大型、接下來 20% 是中型、其餘是小型。' },
      { term: '風格', text: '成長分數減價值分數，在同一規模裡照檔數三等分成價值、混合、成長。' },
      { term: '價值分數', text: '盈餘、淨值、營收、營業現金流相對股價的高低，加上殖利率。' },
      { term: '成長分數', text: '每股盈餘、淨值、營收、營業現金流近 1～4 年的成長。' },
      { term: '不計算的股票', text: 'ETF、特別股，或上市不久、股價或財報還不夠長的股票，不計算在九宮格中。' },
      { term: '參考來源', text: 'Morningstar Style Box，有兩處不同：只用實際數字、不用分析師預估；三等分照檔數、不照市值，因為台積電一家就占大型股市值一半以上。' }
    ]
  },
  {
    title: '指標',
    note: `依每一檔的市值占比計算${props.traits.asOf ? `，以 ${props.traits.asOf} 的收盤價為準` : ''}，只算有數字的持股；ETF 與特別股沒有財報，本益比、股價淨值比、ROE、營收不算入它們。`,
    items: rows.value.map(row => ({ term: row.name, text: row.meaning }))
  },
  { title: '大盤', note: '全市場普通股（上市＋上櫃）依市值、用同一套算法，等於把全市場當成一組持股；大盤的 Beta 是 1。', items: [] }
])
</script>

<template>
  <section class="holdings-traits" :aria-labelledby="headingId">
    <h2 :id="headingId" class="holdings-traits__title">這組持股有什麼特色？</h2>

    <!-- 答句：標籤一排，接在問句下面、面板前面（使用者：「試試看把 tags 放在卡片前面」）；只有名字，數字在面板裡，門檻在折疊區 -->
    <ul v-if="tags.length" class="holdings-traits__tags" role="list" aria-label="特色標籤">
      <li v-for="tag in tags" :key="tag"><el-tag effect="plain" size="large" class="holdings-traits__tag">{{ tag }}</el-tag></li>
    </ul>
    <p v-else class="holdings-traits__tags holdings-traits__none">沒有達到任何標籤的門檻（門檻寫在下面的「指標的意思與計算方式」）。</p>

    <div class="holdings-traits__panel">
      <!-- 上層：九宮格「這組持股 vs 大盤」，各占一半寬、在自己那一半置中；放不下時上下疊，vs 夾在中間 -->
      <figure v-if="boxes.length" class="holdings-traits__boxes">
        <figcaption>規模與風格九宮格（占市值）</figcaption>
        <!-- vs（使用者：「中間希望加上 vs，也就是對比的意思」）只是裝飾，報讀器靠兩張表的標題分辨 -->
        <div class="holdings-traits__box-row" :class="{ 'holdings-traits__box-row--pair': boxes.length > 1 }">
          <template v-for="(box, index) in boxes" :key="box.caption">
            <span v-if="index" class="holdings-traits__vs" aria-hidden="true">vs</span>
            <table class="holdings-traits__box">
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
                  <td v-for="cell in row.cells" :key="cell.key" :class="`holdings-traits__cell--${cell.level}`">{{ cell.text }}</td>
                </tr>
              </tbody>
            </table>
          </template>
        </div>
      </figure>
      <p v-else-if="boxEmpty" class="holdings-traits__note holdings-traits__box-empty">這組持股都是 ETF、特別股或上市不久的股票，沒有九宮格。</p>

      <!-- 下層：指標表全寬（先圖後表）。有大盤時排成「這組持股｜指標｜大盤」對打（使用者：「希望底下表格的數字可以對應到上面九宮格的
           位置」）：數字在自己那張九宮格正下方，指標名在中間、對著 vs 那條線。DOM 順序照舊是 名稱、這組持股、大盤（報讀器念「本益比
           14.20 21.50」），位置用 grid 擺；列改 grid 會讓 Safari 丟掉表格語意，所以 role 明寫（同 HoldingsMetricTable） -->
      <table class="holdings-traits__metrics" :class="{ 'holdings-traits__metrics--duel': hasMarket }" role="table">
        <caption class="visually-hidden">這組持股的量化特色</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" scope="col" class="holdings-traits__name">指標</th>
            <th role="columnheader" scope="col" class="holdings-traits__own">這組持股</th>
            <th v-if="hasMarket" role="columnheader" scope="col" class="holdings-traits__market">大盤</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          <tr v-for="row in rows" :key="row.key" role="row">
            <th role="rowheader" scope="row" class="holdings-traits__name">{{ row.name }}</th>
            <td role="cell" class="holdings-traits__own">{{ row.value }}</td>
            <td v-if="hasMarket" role="cell" class="holdings-traits__market">{{ row.market }}</td>
          </tr>
        </tbody>
      </table>

      <p v-if="!hasMarket" class="holdings-traits__note">大盤對照還在準備中；跟大盤比的標籤（高殖利率、低本益比等）會在大盤資料到了之後一起出現。</p>
    </div>

    <!-- 照頁面上的順序分組：小標＋「名稱｜說明」。不放表格：表格會讓「tbody tr」選到兩份同名的列 -->
    <details class="holdings-details holdings-traits__method">
      <summary>指標的意思與計算方式</summary>
      <section v-for="group in methodGroups" :key="group.title" class="holdings-traits__method-group">
        <h3 class="holdings-traits__method-title">{{ group.title }}</h3>
        <p v-if="group.note" class="holdings-traits__method-note">{{ group.note }}</p>
        <dl v-if="group.items.length" class="holdings-traits__method-list">
          <div v-for="item in group.items" :key="item.term" class="holdings-traits__method-item">
            <dt>{{ item.term }}</dt>
            <dd>{{ item.text }}</dd>
          </div>
        </dl>
      </section>
    </details>
  </section>
</template>

<style scoped>
.holdings-traits__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

/* 一塊面板（框線、圓角、底色同持股總覽），九宮格的色塊壓在卡片色上才分得出最淺那一階。面板是整段寬的區塊，拿來當 container：
   九宮格與表格依它的寬度一起決定並排還是上下疊 */
.holdings-traits__panel {
  container-type: inline-size;
  padding: 16px 20px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

/* 答句：標籤一排，在面板上面 */
.holdings-traits__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
}

.holdings-traits__tag {
  font-weight: 600;
}

.holdings-traits__none {
  display: block;
  color: var(--el-text-color-regular);
}

.holdings-traits__boxes {
  margin: 0;
}

.holdings-traits__boxes > figcaption {
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* 上層：一欄、各張置中；兩張時中間夾一個 vs（窄的上下疊）。夠寬時排成「這組持股 vs 大盤」三欄，兩張各占一半、在自己那一半置中 */
.holdings-traits__box-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 8px 24px;
}

/* vs 是一條分隔線、字在線的正中間（使用者在三種畫法裡選的；圓框那版「看起來醜醜的」）。上下疊時是橫線「─── vs ───」，
   跟九宮格一樣寬；並排時是兩張中間的直線 */
.holdings-traits__vs {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-self: center;
  width: 100%;
  max-width: 20rem;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.holdings-traits__vs::before,
.holdings-traits__vs::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--el-border-color-lighter);
}

/* 每一格是一塊色塊、不畫格線（不像試算表）：0 是淺灰、字淡；有占比的依格子上寫的整數分三階主色 */
.holdings-traits__box {
  justify-self: center;
  width: 100%;
  max-width: 20rem;
  border-collapse: separate;
  border-spacing: 4px;
  table-layout: fixed;
  font-variant-numeric: tabular-nums;
}

.holdings-traits__box caption {
  padding-left: 2.5em;
  color: var(--el-text-color-regular);
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

/* 下層：指標表全寬，每一列是一個 grid（欄寬每列一樣，所以上下對齊）。沒有大盤時是「名稱｜這組持股」 */
.holdings-traits__metrics {
  display: block;
  width: 100%;
  margin-top: 24px;
  font-variant-numeric: tabular-nums;
}

.holdings-traits__metrics thead,
.holdings-traits__metrics tbody {
  display: block;
}

.holdings-traits__metrics tr {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  column-gap: 16px;
  align-items: baseline;
  /* 左右不留內距：欄位才跟上面九宮格那一層的欄位切在同一個位置 */
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.holdings-traits__metrics thead tr {
  border-bottom: 2px solid var(--el-border-color);
}

.holdings-traits__metrics th,
.holdings-traits__metrics td {
  padding: 0;
  text-align: left;
  color: var(--el-text-color-primary);
}

.holdings-traits__metrics thead th {
  font-weight: 600;
}

.holdings-traits__metrics tbody th {
  font-weight: 400;
}

.holdings-traits__metrics .holdings-traits__own,
.holdings-traits__metrics .holdings-traits__market {
  text-align: right;
}

.holdings-traits__metrics tbody .holdings-traits__own {
  font-weight: 600;
}

/* 有大盤：「這組持股｜指標｜大盤」對打，數字與名稱都置中。手機上欄名照常顯示（九宮格上下疊，對不到位置） */
.holdings-traits__metrics--duel tr {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 1fr);
}

.holdings-traits__metrics--duel .holdings-traits__own {
  grid-area: 1 / 1;
}

.holdings-traits__metrics--duel .holdings-traits__name {
  grid-area: 1 / 2;
}

.holdings-traits__metrics--duel .holdings-traits__market {
  grid-area: 1 / 3;
}

.holdings-traits__metrics--duel th,
.holdings-traits__metrics--duel td,
.holdings-traits__metrics--duel .holdings-traits__own,
.holdings-traits__metrics--duel .holdings-traits__market {
  text-align: center;
}

.holdings-traits__note {
  margin: 16px 0 0;
  color: var(--el-text-color-regular);
}

/* 指標的意思與計算方式：四組，組與組之間一條細線；每組小標、一句總說明，再來「名稱｜說明」兩欄（窄的時候名稱在上） */
.holdings-traits__method-group {
  padding: 16px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.holdings-traits__method-group:first-of-type {
  padding-top: 8px;
  border-top: 0;
}

.holdings-traits__method-title {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.holdings-traits__method-note {
  margin: 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.holdings-traits__method-list {
  margin: 8px 0 0;
}

.holdings-traits__method-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0 16px;
  padding: 4px 0;
  line-height: 1.7;
}

.holdings-traits__method-item dt {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.holdings-traits__method-item dd {
  margin: 0;
  color: var(--el-text-color-regular);
}

@media (min-width: 640px) {
  .holdings-traits__method-item {
    grid-template-columns: 12rem minmax(0, 1fr);
  }
}

/* 夠寬時（兩張九宮格各至少 16rem，加中間 15rem）：九宮格與下面表格用同一套三欄「1fr｜15rem｜1fr」，數字就落在自己那張九宮格
   正下方、指標名在中間對著 vs。放在最後：跟上面同特異性的規則，後寫的才贏 */
@container (min-width: 50rem) {
  .holdings-traits__box-row--pair,
  .holdings-traits__metrics--duel tr {
    grid-template-columns: minmax(0, 1fr) 15rem minmax(0, 1fr);
    column-gap: 24px;
  }

  .holdings-traits__box-row--pair .holdings-traits__vs {
    flex-direction: column;
    align-self: stretch;
    width: auto;
  }

  .holdings-traits__box-row--pair .holdings-traits__vs::before,
  .holdings-traits__box-row--pair .holdings-traits__vs::after {
    border-top: 0;
    border-left: 1px solid var(--el-border-color-lighter);
  }

  /* 數字對準九宮格的格子：九宮格左邊多一欄「大型／中型／小型」（2.5em 加兩道 4px 間距），格子的中心往右偏 22px */
  .holdings-traits__metrics--duel .holdings-traits__own,
  .holdings-traits__metrics--duel .holdings-traits__market {
    padding-left: 44px;
  }

  /* 欄名就是上面兩張九宮格的標題，不再寫一次（報讀器照樣念得到） */
  .holdings-traits__metrics--duel thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
}
</style>
