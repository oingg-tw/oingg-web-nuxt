<script setup lang="ts">
// 投資組合指標表（2026-10-07，交易績效與風險頁共用五張）：指標｜你的持股｜（同期加權指數）｜意思。
// 原生 <table> 而不是 el-table：mobile first——窄的時候每一列是一張小卡片（名稱與數值一行、大盤一行、意思一行），
// 表格區塊夠寬才是四欄表格。只改 CSS 不出第二份 DOM，作法同指標速覽的表格。
// 數值一律中性色（不用漲跌色暗示好壞，投信投顧法）。
const props = withDefaults(defineProps<{
  caption: string
  // skeleton：骨架列（列數不定的表在資料到之前用），整列都畫成骨架
  rows: { name: string; value: string; market?: string; meaning?: string; skeleton?: boolean }[]
  valueLabel?: string
  // 有給才多一欄（例如「同期加權指數」）
  marketLabel?: string
  // 第一欄與最後一欄的欄名（逐年報酬是「年度」與「交易日數」）
  nameLabel?: string
  meaningLabel?: string
  // 資料還沒到（2026-10-20，使用者：「載入之前，可以讓用戶看的出來畫面結構」「然後不要閃動」）：數值欄畫成骨架。骨架是透明的範例字
  //（.app-skeleton--flow），所以呼叫端在數值欄放一個典型的值（例如 '49.6%'）：欄寬照內容算，跟資料到了一樣，表頭不會左右跳。
  // 列固定的表傳真的名稱與意思，字先出現、列高也一樣；列數不定的表傳 useLayoutHint 記住的列數個 skeleton 列（整列都是範例字）
  loading?: boolean
  // 寬的時候的欄寬（依欄位順序：名稱、數值、大盤、意思）。不給就照有哪些欄用預設比例，見 columnWidths
  widths?: string[]
}>(), { valueLabel: '你的持股', marketLabel: undefined, nameLabel: '指標', meaningLabel: '意思', loading: false, widths: undefined })

// 第一欄可以換成自己的內容（例如連到個股頁的名稱）：<template #name="{ row }">…</template>
defineSlots<{ name?: (props: { row: { name: string; value: string; market?: string; meaning?: string; skeleton?: boolean } }) => unknown }>()

const hasMeaning = computed(() => props.rows.some(row => row.meaning != null))
// 寬的時候欄寬一律固定、不照內容算（2026-10-20，使用者：「然後不要閃動」）：骨架的範例字跟真的數值長短不同（例如沒有交易時是
//「期間內沒有持股」），照內容算的話資料到的那一刻整欄左右移（已實現損益量到 0.013）。名稱與意思是同樣的字，換行也一樣；意思欄最寬
const columnWidths = computed(() => props.widths ?? (props.marketLabel
  ? (hasMeaning.value ? ['22%', '16%', '16%', '46%'] : ['46%', '27%', '27%'])
  : (hasMeaning.value ? ['24%', '22%', '54%'] : ['60%', '40%'])))
// 數值欄沒給範例字時的骨架寬度：持股頁的數值多半是這個長度
const VALUE_SAMPLE = '12.3%'
</script>

<template>
  <!-- role 寫明（2026-10-07 a11y 盤點）：窄的時候 table/tr 改成 block/grid，Safari＋VoiceOver 會因此把表格語意
       丟掉，明寫 role 才保得住（<table> 的 role 在 SharedTable）。 -->
  <div class="holdings-metric-table">
    <SharedTable :label="caption" :ssr="false" :scrollable="false" table-class="holdings-metric-table__table" class="holdings-metric-table__card">
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col" role="columnheader" :style="{ width: columnWidths[0] }">{{ nameLabel }}</th>
          <th scope="col" role="columnheader" class="seo-table__num" :style="{ width: columnWidths[1] }">{{ valueLabel }}</th>
          <th v-if="marketLabel" scope="col" role="columnheader" class="seo-table__num" :style="{ width: columnWidths[2] }">{{ marketLabel }}</th>
          <th v-if="hasMeaning" scope="col" role="columnheader" :style="{ width: columnWidths[marketLabel ? 3 : 2] }">{{ meaningLabel }}</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        <!-- key 帶序號：同一檔可能有好幾列（例如匯入時的多批期初部位） -->
        <tr v-for="(row, index) in rows" :key="`${index}-${row.name}`" role="row" class="holdings-card">
          <th scope="row" role="rowheader">
            <span v-if="loading && row.skeleton" class="app-skeleton app-skeleton--flow" aria-hidden="true">{{ row.name }}</span>
            <slot v-else name="name" :row="row">{{ row.name }}</slot>
          </th>
          <!-- 有兩個數值欄時，窄卡片上兩個都標欄名（例如「權重：53.3%」「風險貢獻：54.0%」），否則分不出哪個是哪個 -->
          <td role="cell" class="seo-table__num holdings-metric-table__value holdings-card__value" :data-value-label="marketLabel ? valueLabel : undefined">
            <span v-if="loading" class="app-skeleton app-skeleton--flow" aria-hidden="true">{{ row.value || VALUE_SAMPLE }}</span>
            <template v-else>{{ row.value }}</template>
          </td>
          <td v-if="marketLabel" role="cell" class="seo-table__num" :data-label="marketLabel">
            <span v-if="loading" class="app-skeleton app-skeleton--flow" aria-hidden="true">{{ row.market || VALUE_SAMPLE }}</span>
            <template v-else>{{ row.market ?? '－' }}</template>
          </td>
          <td v-if="hasMeaning" role="cell" class="holdings-metric-table__meaning">
            <span v-if="loading && row.skeleton" class="app-skeleton app-skeleton--flow" aria-hidden="true">{{ row.meaning }}</span>
            <template v-else>{{ row.meaning }}</template>
          </td>
        </tr>
      </tbody>
    </SharedTable>
  </div>
</template>

<style scoped>
.holdings-metric-table {
  container-type: inline-size;
}

.holdings-metric-table__value {
  color: var(--el-text-color-primary);
}

/* 窄：每一列一張小卡片（tr 上的 .holdings-card），外面那張表格卡片不畫——同篩選結果在手機上 */
@container (max-width: 639px) {
  .holdings-metric-table__card {
    border: 0;
    border-radius: 0;
    background: none;
  }

  /* <table> 是 SharedTable 畫的，對表格本身要用 :deep；thead／tbody／tr 是這裡的插槽內容，直接寫就好 */
  :deep(.holdings-metric-table__table) {
    display: block;
    background: none;
  }

  .holdings-metric-table__table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .holdings-metric-table__table tbody {
    display: grid;
    gap: 8px;
  }

  .holdings-metric-table__table tbody tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 12px;
    align-items: baseline;
  }

  .holdings-metric-table__table tbody th,
  .holdings-metric-table__table tbody td {
    position: static;
    padding: 0;
    border: 0;
    white-space: normal;
    background: none;
  }

  .holdings-metric-table__table tbody th {
    font-weight: 600;
  }

  .holdings-metric-table__table td[data-label],
  .holdings-metric-table__meaning {
    grid-column: 1 / -1;
    text-align: left;
    color: var(--el-text-color-secondary);
  }

  .holdings-metric-table__table td[data-label]::before {
    content: attr(data-label) '：';
  }

  .holdings-metric-table__value[data-value-label]::before {
    content: attr(data-value-label) '：';
    font-size: 1rem;
    font-weight: 400;
    color: var(--el-text-color-secondary);
  }
}

/* 寬：全站表格（線、內距、表頭都照 main.css 的「全站表格」），這裡只放這張表自己的 */
@container (min-width: 640px) {
  /* 欄寬照表頭的 width，不照內容（columnWidths） */
  :deep(.holdings-metric-table__table) {
    table-layout: fixed;
  }

  /* tr 上的 .holdings-card 是窄的時候的卡片 */
  .holdings-metric-table__table tbody tr {
    padding: 0;
    border: 0;
    border-radius: 0;
  }

  /* 數值欄（數值、大盤）與它們的表頭一律靠右：欄寬固定之後，原本靠左的數值欄跟靠右的大盤欄一左一右很明顯。全站的 .seo-table 不換行，
     欄寬固定時長的原因（「樣本不足（30 天，需 120 天）」）會蓋到隔壁欄，這裡讓它換行 */
  .holdings-metric-table__table thead th.seo-table__num,
  .holdings-metric-table__table .holdings-metric-table__value,
  .holdings-metric-table__table td[data-label] {
    text-align: right;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  /* 欄寬固定，長名稱與意思換行（骨架與資料是同樣的字，換行也一樣） */
  .holdings-metric-table__table tbody th,
  .holdings-metric-table__meaning {
    white-space: normal;
  }

  .holdings-metric-table__value {
    font-size: 1rem;
    font-weight: 600;
  }

  .holdings-metric-table__table td[data-label] {
    color: var(--el-text-color-primary);
  }
}
</style>
