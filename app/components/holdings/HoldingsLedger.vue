<script setup lang="ts">
import { Delete, Edit } from '@element-plus/icons-vue'
import type { Transaction } from '~/composables/stock/useHoldings'

// 一檔持股的交易紀錄，就地展開在那一列下面（桌機在 el-table 的展開列裡、手機在卡片裡）。
//
// 2026-10-05 使用者：「交易紀錄不可以用這種跳到最底下的方式呈現，建議伸縮或是彈窗」。選伸縮不選彈窗：
// 每一筆都有「編輯」，而編輯本身是對話框——紀錄做成彈窗的話，按編輯就是彈窗疊彈窗（不疊對話框是
// 這個 app 的既定規則）。
const props = defineProps<{
  // undefined ＝ 載入中；'failed' ＝ 讀不到
  entries: Transaction[] | 'failed' | undefined
  symbolLabel: (symbol: string) => string
  // 績效頁用（2026-10-05「performance 希望可以伸縮 賣出價格 與 持倉明細」）：唯讀、只列到期間結束日，
  // 期間內的賣出加註「（期間內）」——用文字標，不只靠顏色。
  readonly?: boolean
  range?: [string, string]
}>()

const emit = defineEmits<{
  retry: []
  edit: [transaction: Transaction]
  remove: [transaction: Transaction, label: string]
}>()

const sorted = computed(() => (Array.isArray(props.entries) ? [...props.entries] : [])
  .filter(entry => !props.range || entry.tradeDate <= props.range[1])
  .sort((a, b) => b.tradeDate.localeCompare(a.tradeDate)))

// 匯入時補的期初部位（source "opening"）是一筆買進，但對使用者來說它是「原本就持有的」，不是一次買進。
//
// 自動入帳的除權配股（source "stock-dividend"）是 bff-ts 依除權息行事曆即時算的虛擬列：不能改也不能刪，
// note 寫著配發比例與除權前持股。成本不明的取得（costUnknown）也標出來，不讓它看起來像一筆價格 0 的買進。
function actionWord(transaction: Transaction): string {
  if (transaction.source === 'stock-dividend') return '配股（自動）'
  // 匯入時補的期初部位：source "opening"（舊流程），或 externalRef 以 |pre 結尾的買進（見 broker-trade-csv.ts 的
  // preWindowLots——一檔可能有好幾批不同成本，所以改用一般買進列）。只用來決定顯示文字，不影響計算。
  if (transaction.source === 'opening' || transaction.externalRef?.endsWith('|pre')) return '期初部位'
  if (transaction.costUnknown) return '取得（成本不明）'
  return transaction.action === 'BUY' ? '買進' : '賣出'
}

function actionCell(transaction: Transaction): string {
  const word = actionWord(transaction)
  const inRange = props.range && transaction.action === 'SELL' && transaction.tradeDate >= props.range[0] && transaction.tradeDate <= props.range[1]
  return inRange ? `${word}（期間內）` : word
}

function label(transaction: Transaction): string {
  return `${transaction.tradeDate} ${actionWord(transaction)} ${props.symbolLabel(transaction.symbol)} ${groupThousands(transaction.quantity)} 股`
}

function plainNumber(value: string | number): string {
  return groupThousands(String(Number(value)))
}
</script>

<template>
  <div class="ledger">
    <div v-if="entries === undefined" v-loading="true" class="ledger__loading" />
    <el-alert v-else-if="entries === 'failed'" type="error" :closable="false" show-icon title="交易紀錄暫時無法載入">
      <el-button class="ledger__retry" @click="emit('retry')">重新載入</el-button>
    </el-alert>
    <el-table v-else :data="sorted" row-key="id">
      <template #empty>{{ range ? '期間結束前沒有交易紀錄' : '這一檔沒有交易紀錄' }}</template>
      <el-table-column label="日期" min-width="110" prop="tradeDate" />
      <el-table-column label="買賣" min-width="150">
        <template #default="{ row }">{{ actionCell(tableRow<Transaction>(row)) }}</template>
      </el-table-column>
      <el-table-column label="股數" align="right" min-width="80">
        <template #default="{ row }">{{ groupThousands(tableRow<Transaction>(row).quantity) }}</template>
      </el-table-column>
      <el-table-column label="成交價" align="right" min-width="80">
        <template #default="{ row }">{{ tableRow<Transaction>(row).costUnknown ? '不明' : plainNumber(tableRow<Transaction>(row).price) }}</template>
      </el-table-column>
      <el-table-column label="手續費" align="right" min-width="70">
        <template #default="{ row }">{{ plainNumber(tableRow<Transaction>(row).fee) }}</template>
      </el-table-column>
      <el-table-column label="交易稅" align="right" min-width="70">
        <template #default="{ row }">{{ plainNumber(tableRow<Transaction>(row).tax) }}</template>
      </el-table-column>
      <el-table-column label="備註" min-width="120">
        <template #default="{ row }">{{ tableRow<Transaction>(row).note ?? '' }}</template>
      </el-table-column>
      <el-table-column v-if="!readonly" label="操作" min-width="190">
        <template #default="{ row }">
          <div v-if="tableRow<Transaction>(row).source !== 'stock-dividend'" class="ledger__actions">
            <el-button :icon="Edit" :aria-label="`編輯 ${label(tableRow<Transaction>(row))}`" @click="emit('edit', tableRow<Transaction>(row))">編輯</el-button>
            <el-button :icon="Delete" :aria-label="`刪除 ${label(tableRow<Transaction>(row))}`" @click="emit('remove', tableRow<Transaction>(row), label(tableRow<Transaction>(row)))">刪除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.ledger {
  padding: 8px 0;
}

.ledger__loading {
  min-height: 96px;
}

.ledger__retry {
  margin-top: 8px;
}

.ledger__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ledger__actions :deep(.el-button) {
  min-height: 44px;
  margin: 0;
}
</style>
