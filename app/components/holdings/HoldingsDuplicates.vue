<script setup lang="ts">
import type { DuplicateGroup, Transaction } from '~/composables/holdings/holdings-model'

// 可能重複的交易（2026-11-24，使用者「交易明細我手動紀錄的與我剛才又自動匯入的有重複了，怎麼去重複?」；業務中台 b6a6990）：頁尾一行，
// 有才出現，按「檢查」打開清單。規則是使用者在業務中台定的：同帳戶、同代號、同成交日、同買賣別，兩邊加總的股數相等、均價差 1% 以內。
// 每組預設勾選，刪掉的是手動記的那幾筆、留下匯入的（使用者：要換成匯入的，就在重複清單把手動那筆刪掉），同單筆刪除 10 秒內可以復原。
// 讀的時候照上次那一行的長度畫骨架（useLineHint），資料晚到不會推動下面的按鈕
const props = defineProps<{ symbolLabel: (symbol: string) => string; loading: boolean }>()

const { fetchDuplicates, removeTransactions, ledgerVersion } = useHoldings()
const { portfolios, holdingsScope } = useHoldingsPortfolios()
const groups = ref<DuplicateGroup[]>([])
const loaded = ref(false)
async function refresh() {
  groups.value = (await fetchDuplicates()) ?? []
  loaded.value = true
}
onMounted(refresh)
watch([ledgerVersion, holdingsScope], refresh)

const text = computed(() => (groups.value.length ? `有 ${groups.value.length} 組交易可能重複：手動記的跟匯入的對得上。` : ''))
const { sample, remember } = useLineHint('holdings-duplicates')
watch([text, loaded, () => props.loading], ([current, ready, reading]) => {
  if (ready && !reading) remember(current)
})
const drawing = computed(() => !loaded.value || props.loading)

const keyOf = (group: DuplicateGroup) => `${group.portfolioId}:${group.symbol}:${group.tradeDate}:${group.action}`
const accountName = (id: string) => portfolios.value.find(portfolio => portfolio.id === id)?.name ?? ''
const titleOf = (group: DuplicateGroup) => [
  group.tradeDate,
  group.action.toUpperCase() === 'SELL' ? '賣出' : '買進',
  props.symbolLabel(group.symbol),
  portfolios.value.length > 1 ? `（${accountName(group.portfolioId)}）` : ''
].join(' ')
const rowsText = (rows: Transaction[], imported: boolean) => rows
  .map(row => `${groupThousands(row.quantity)} 股・${row.price} 元${imported ? `・手續費 ${groupThousands(row.fee)}・稅 ${groupThousands(row.tax)}` : ''}${row.note ? `（${row.note}）` : ''}`)
  .join('；')

const open = ref(false)
const picked = ref<Record<string, boolean>>({})
function show() {
  picked.value = Object.fromEntries(groups.value.map(group => [keyOf(group), true]))
  open.value = true
}
const pickedIds = computed(() => groups.value.filter(group => picked.value[keyOf(group)]).flatMap(group => group.manualTransactions.map(row => row.id)))
function removePicked() {
  const ids = pickedIds.value
  const keys = new Set(groups.value.filter(group => picked.value[keyOf(group)]).map(keyOf))
  open.value = false
  removeTransactions(ids, `${ids.length} 筆重複的手動交易`, () => {
    const before = groups.value
    groups.value = groups.value.filter(group => !keys.has(keyOf(group)))
    return () => {
      groups.value = before
    }
  })
}
</script>

<template>
  <p v-if="drawing ? sample : text" class="holdings-duplicates">
    <span v-if="drawing" class="app-skeleton app-skeleton--flow" aria-hidden="true">{{ sample }}</span>
    <template v-else>
      {{ text }}<el-button type="primary" link class="holdings-duplicates__open" @click="show">檢查</el-button>
    </template>
  </p>

  <el-dialog v-model="open" title="可能重複的交易" width="min(640px, 94vw)" append-to-body>
    <p class="holdings-duplicates__text">這幾組是同一天、同一檔、買賣相同，股數相等、價格差不到 1% 的交易，一邊是手動記的、一邊是匯入的。勾選的那幾組會刪掉手動記的交易，留下匯入的（有券商的手續費與稅）。刪除後 10 秒內可以復原。</p>
    <ul class="holdings-duplicates__list">
      <li v-for="group in groups" :key="keyOf(group)" class="holdings-duplicates__group">
        <el-checkbox v-model="picked[keyOf(group)]" class="holdings-duplicates__check">{{ titleOf(group) }}</el-checkbox>
        <dl class="holdings-duplicates__rows">
          <div><dt>手動</dt><dd>{{ rowsText(group.manualTransactions, false) }}</dd></div>
          <div><dt>匯入</dt><dd>{{ rowsText(group.importedTransactions, true) }}</dd></div>
        </dl>
      </li>
    </ul>
    <template #footer>
      <el-button size="large" @click="open = false">取消</el-button>
      <el-button type="primary" size="large" :disabled="!pickedIds.length" @click="removePicked">刪除勾選的手動交易（{{ pickedIds.length }} 筆）</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 頁尾、未計入那一行的下面：同樣的字色與上距 */
.holdings-duplicates {
  margin: 8px 0 0;
  color: var(--el-text-color-regular);
}

.holdings-duplicates__open {
  min-height: 44px;
  margin-left: 8px;
}

.holdings-duplicates__text {
  margin: 0 0 12px;
  line-height: 1.7;
}

.holdings-duplicates__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.holdings-duplicates__group {
  padding: 8px 0;
}

.holdings-duplicates__group + .holdings-duplicates__group {
  border-top: 1px solid var(--app-divider);
}

.holdings-duplicates__check {
  min-height: 44px;
  white-space: normal;
}

.holdings-duplicates__rows {
  margin: 0 0 0 24px;
  color: var(--el-text-color-regular);
}

.holdings-duplicates__rows > div {
  display: flex;
  gap: 8px;
}

.holdings-duplicates__rows dt {
  flex: none;
  color: var(--el-text-color-secondary);
}

.holdings-duplicates__rows dd {
  margin: 0;
}
</style>
