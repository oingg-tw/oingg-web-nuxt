<script setup lang="ts">
import { Delete, Plus } from '@element-plus/icons-vue'
import type { Holding, Transaction } from '~/composables/stock/useHoldings'

// 一檔持股展開後的內容：摘要列（這檔的總成本、已實現損益）＋動作＋精簡的交易紀錄。桌機的展開列與手機卡片
// 共用這一份，兩邊長得一樣。
//
// 使用者 2026-10-05：「對展開後的 UIUX 有意見，希望針對展開後的布局重新設計，也希望刪除按鈕用紅色」，在三個
// 方案裡選了「摘要＋精簡交易表」。刪除（這檔、單筆交易）都是紅色；兩者都是延後送出、可以復原，不跳確認。
const props = defineProps<{
  holding: Holding
  // 例如「台積電 2330」
  label: string
  entries: Transaction[] | 'failed' | undefined
  symbolLabel: (symbol: string) => string
}>()

const emit = defineEmits<{
  record: []
  removeHolding: []
  retry: []
  edit: [transaction: Transaction]
  removeTransaction: [transaction: Transaction, label: string]
}>()

const realized = computed(() => Number(props.holding.realizedProfitLoss))
const count = computed(() => (Array.isArray(props.entries) ? props.entries.length : null))
</script>

<template>
  <div class="detail">
    <div class="detail__summary">
      <dl class="detail__facts">
        <div><dt>總成本</dt><dd>{{ holding.averageCost === null ? '成本不明' : `${holdingsMoney(Number(holding.totalCost))} 元` }}</dd></div>
        <div>
          <dt>已實現損益</dt>
          <dd :class="priceDirectionClass(Math.round(realized))">{{ holdingsSignedMoney(realized) }}</dd>
        </div>
        <div v-if="holding.costUnknownQuantity > 0"><dt>成本不明</dt><dd>{{ groupThousands(holding.costUnknownQuantity) }} 股</dd></div>
      </dl>
      <div class="detail__actions">
        <el-button :icon="Plus" @click="emit('record')">記一筆</el-button>
        <el-button type="danger" plain :icon="Delete" :aria-label="`刪除 ${label}（含所有交易紀錄）`" @click="emit('removeHolding')">刪除這檔</el-button>
      </div>
    </div>

    <h3 class="detail__title">交易紀錄<template v-if="count !== null">（{{ count }} 筆）</template></h3>
    <HoldingsLedger
      :entries="entries"
      :symbol-label="symbolLabel"
      @retry="emit('retry')"
      @edit="transaction => emit('edit', transaction)"
      @remove="(transaction, text) => emit('removeTransaction', transaction, text)"
    />
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.detail__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}

.detail__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 24px;
  margin: 0;
}

.detail__facts div {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.detail__facts dt {
  color: var(--el-text-color-regular);
}

.detail__facts dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail__actions :deep(.el-button) {
  min-height: 44px;
  margin: 0;
}

.detail__title {
  font-size: 1rem;
  font-weight: 600;
  margin: 8px 0 0;
}
</style>
