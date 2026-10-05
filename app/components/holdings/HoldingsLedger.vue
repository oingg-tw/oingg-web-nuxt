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
}>()

const emit = defineEmits<{
  retry: []
  edit: [transaction: Transaction]
  remove: [transaction: Transaction, label: string]
}>()

const sorted = computed(() => (Array.isArray(props.entries) ? [...props.entries].sort((a, b) => b.tradeDate.localeCompare(a.tradeDate)) : []))

// 匯入時補的期初部位（source "opening"）是一筆買進，但對使用者來說它是「原本就持有的」，不是一次買進。
function actionWord(transaction: Transaction): string {
  if (transaction.source === 'opening') return '期初部位'
  return transaction.action === 'BUY' ? '買進' : '賣出'
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
      <template #empty>這一檔沒有交易紀錄</template>
      <el-table-column label="日期" min-width="110" prop="tradeDate" />
      <el-table-column label="買賣" min-width="90">
        <template #default="{ row }">{{ actionWord(tableRow<Transaction>(row)) }}</template>
      </el-table-column>
      <el-table-column label="股數" align="right" min-width="80">
        <template #default="{ row }">{{ groupThousands(tableRow<Transaction>(row).quantity) }}</template>
      </el-table-column>
      <el-table-column label="成交價" align="right" min-width="80">
        <template #default="{ row }">{{ plainNumber(tableRow<Transaction>(row).price) }}</template>
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
      <el-table-column label="操作" min-width="190">
        <template #default="{ row }">
          <div class="ledger__actions">
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
