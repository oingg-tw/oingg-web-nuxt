<script setup lang="ts">
import type { Transaction } from '~/composables/holdings/holdings-model'

// 一檔持股的交易紀錄，就地展開在那一列下面（桌機在 el-table 的展開列裡、手機在卡片裡）。
//
// 2026-10-05 使用者：「交易紀錄不可以用這種跳到最底下的方式呈現，建議伸縮或是彈窗」。選伸縮不選彈窗：
// 每一筆都有「編輯」，而編輯本身是對話框——紀錄做成彈窗的話，按編輯就是彈窗疊彈窗（不疊對話框是
// 這個 app 的既定規則）。
const props = defineProps<{
  // undefined ＝ 載入中；'failed' ＝ 讀不到
  entries: Transaction[] | 'failed' | undefined
  // 重讀這一檔的紀錄。是函式不是事件：全站讀取失敗的重試要等它讀完才判斷成敗
  reload: () => Promise<unknown>
  symbolLabel: (symbol: string) => string
  // 績效頁用（2026-10-05「performance 希望可以伸縮 賣出價格 與 持倉明細」）：唯讀、只列到期間結束日，
  // 期間內的賣出加註「（期間內）」——用文字標，不只靠顏色。
  readonly?: boolean
  range?: [string, string]
}>()

const emit = defineEmits<{
  edit: [transaction: Transaction]
  remove: [transaction: Transaction, label: string]
}>()

// 讀不到時交給全站的讀取失敗提示（AppLoadFailureDialog，2026-10-08），重讀交給父層
const ledgerKey = `holdings-ledger:${useId()}`
watchLoadFailure(ledgerKey, () => props.entries === 'failed', () => props.reload(), { scope: 'section' })

const sorted = computed(() => (Array.isArray(props.entries) ? [...props.entries] : [])
  .filter(entry => !props.range || entry.tradeDate <= props.range[1])
  .sort((a, b) => b.tradeDate.localeCompare(a.tradeDate)))

// 匯入時補的期初部位（source "opening"）是一筆買進，但對使用者來說它是「原本就持有的」，不是一次買進。
//
// 自動入帳的除權配股（source "stock-dividend"）是 業務中台 依除權息行事曆即時算的虛擬列：不能改也不能刪，
// note 寫著配發比例與除權前持股。成本不明的取得（costUnknown）也標出來，不讓它看起來像一筆價格 0 的買進。
// 減資（action REDUCE，2026-10-23，使用者：減資「要」列在交易紀錄）同樣是虛擬列：股數寫「減資前 → 減資後」、沒有成交價，
// 退還股款在 note（業務中台寫好的一句，例如「…1000 股 → 400 股，退還股款 6,000 元」）
const isVirtual = (transaction: Transaction) => transaction.source === 'stock-dividend' || transaction.action === 'REDUCE'
function actionWord(transaction: Transaction): string {
  if (transaction.action === 'REDUCE') return '減資（自動）'
  if (transaction.source === 'stock-dividend') return '配股（自動）'
  // 匯入時補的期初部位：source "opening"（舊流程），或 externalRef 以 |pre 結尾的買進（見 broker-trade-csv.ts 的
  // preWindowLots——一檔可能有好幾批不同成本，所以改用一般買進列）。只用來決定顯示文字，不影響計算。
  if (transaction.source === 'opening' || transaction.externalRef?.endsWith('|pre')) return '期初部位'
  if (transaction.costUnknown) return '取得（成本不明）'
  return transaction.action === 'BUY' ? '買進' : '賣出'
}

// 全部帳戶模式、而且不只一個帳戶時，每一筆標出是哪個帳戶的（2026-10-19）
const { portfolios, selected } = useHoldingsPortfolios()
function accountOf(transaction: Transaction): string | null {
  if (selected.value || portfolios.value.length < 2) return null
  return portfolios.value.find(portfolio => portfolio.id === transaction.portfolioId)?.name ?? null
}

function actionCell(transaction: Transaction): string {
  const word = actionWord(transaction)
  const inRange = props.range && transaction.action === 'SELL' && transaction.tradeDate >= props.range[0] && transaction.tradeDate <= props.range[1]
  const account = accountOf(transaction)
  return `${inRange ? `${word}（期間內）` : word}${account ? `・${account}` : ''}`
}

function label(transaction: Transaction): string {
  return `${transaction.tradeDate} ${actionWord(transaction)} ${props.symbolLabel(transaction.symbol)} ${groupThousands(transaction.quantity)} 股`
}

function plainNumber(value: string | number): string {
  return groupThousands(String(Number(value)))
}

function quantityText(transaction: Transaction): string {
  const reduction = transaction.capitalReduction
  return reduction ? `${groupThousands(reduction.heldBefore)} → ${groupThousands(reduction.heldAfter)}` : groupThousands(transaction.quantity)
}

function priceText(transaction: Transaction): string {
  if (transaction.action === 'REDUCE') return '－'
  return transaction.costUnknown ? '不明' : plainNumber(transaction.price)
}
</script>

<template>
  <div class="ledger">
    <div v-if="entries === undefined" v-loading="true" class="ledger__loading" />
    <!-- 讀不到：彈窗會說明並自動重讀；留空佔住這一支 -->
    <template v-else-if="entries === 'failed'" />
    <el-table v-else :data="sorted" row-key="id" class="ledger__table">
      <template #empty>{{ range ? '期間結束前沒有交易紀錄' : '這一檔沒有交易紀錄' }}</template>
      <el-table-column label="日期" min-width="110" prop="tradeDate" />
      <el-table-column label="買賣" min-width="150">
        <template #default="{ row }">{{ actionCell(tableRow<Transaction>(row)) }}</template>
      </el-table-column>
      <el-table-column label="股數" align="right" min-width="80">
        <template #default="{ row }">{{ quantityText(tableRow<Transaction>(row)) }}</template>
      </el-table-column>
      <el-table-column label="成交價" align="right" min-width="80">
        <template #default="{ row }">{{ priceText(tableRow<Transaction>(row)) }}</template>
      </el-table-column>
      <!-- 手續費與交易稅合成一欄（2026-10-05 展開版面改版：精簡交易表）。分開的數字在編輯對話框裡看得到。 -->
      <el-table-column label="費稅" align="right" min-width="80">
        <template #default="{ row }">{{ plainNumber(Number(tableRow<Transaction>(row).fee) + Number(tableRow<Transaction>(row).tax)) }}</template>
      </el-table-column>
      <el-table-column label="備註" min-width="120">
        <template #default="{ row }">{{ tableRow<Transaction>(row).note ?? '' }}</template>
      </el-table-column>
      <!-- 編輯／刪除縮成文字按鈕，不再每列兩顆框線按鈕；刪除是紅色（使用者 2026-10-05）。
           觸控目標仍是 44px 高（.ledger__actions 的 min-height）。 -->
      <el-table-column v-if="!readonly" label="操作" min-width="120">
        <template #default="{ row }">
          <div v-if="!isVirtual(tableRow<Transaction>(row))" class="ledger__actions">
            <el-button link type="primary" :aria-label="`編輯 ${label(tableRow<Transaction>(row))}`" @click="emit('edit', tableRow<Transaction>(row))">編輯</el-button>
            <el-button link type="danger" :aria-label="`刪除 ${label(tableRow<Transaction>(row))}`" @click="emit('remove', tableRow<Transaction>(row), label(tableRow<Transaction>(row)))">刪除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <!-- 窄螢幕的清單版：同一份資料的第二份 DOM，CSS 決定顯示哪一份（站上的既有做法，見 SectionNav.vue）。7 欄的交易
         表在 375px 會溢出 446px（2026-10-05 量到），清單每筆兩行就放得下。兩行各分左右（2026-10-20 手機卡片改版）：
         「日期 買賣」｜「股數 @ 價格」、「費稅・備註」｜「編輯 刪除」，右邊切齊 -->
    <ul v-if="Array.isArray(entries)" class="ledger__list">
      <li v-if="!sorted.length" class="ledger__empty">{{ range ? '期間結束前沒有交易紀錄' : '這一檔沒有交易紀錄' }}</li>
      <li v-for="transaction in sorted" :key="transaction.id" class="ledger__item">
        <span>{{ transaction.tradeDate }} <span class="ledger__action">{{ actionCell(transaction) }}</span></span>
        <span class="ledger__end">{{ quantityText(transaction) }} 股<template v-if="transaction.action !== 'REDUCE'"> @ {{ priceText(transaction) }}</template></span>
        <span class="ledger__sub">費稅 {{ plainNumber(Number(transaction.fee) + Number(transaction.tax)) }}<template v-if="transaction.note">・{{ transaction.note }}</template></span>
        <span v-if="!readonly && !isVirtual(transaction)" class="ledger__actions ledger__end">
          <el-button link type="primary" :aria-label="`編輯 ${label(transaction)}`" @click="emit('edit', transaction)">編輯</el-button>
          <el-button link type="danger" :aria-label="`刪除 ${label(transaction)}`" @click="emit('remove', transaction, label(transaction))">刪除</el-button>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ledger {
  padding: 0;
}

.ledger :deep(td) {
  font-variant-numeric: tabular-nums;
}

.ledger__loading {
  min-height: 96px;
}


.ledger__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.ledger__actions :deep(.el-button) {
  min-height: 44px;
  margin: 0;
}
.ledger__list {
  display: none;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ledger__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-variant-numeric: tabular-nums;
}

/* 最後一筆不畫線：下面接的是動作列或卡片頁尾的線，兩條線疊在一起 */
.ledger__item:last-child {
  border-bottom: 0;
}

.ledger__end {
  justify-self: end;
  white-space: nowrap;
}

.ledger__sub {
  color: var(--el-text-color-regular);
  overflow-wrap: anywhere;
}

/* inline-block：放不下時整段換到下一行，不會切成「賣出（期間」「內）」 */
.ledger__action {
  display: inline-block;
  font-weight: 600;
}

.ledger__empty {
  padding: 8px 0;
  color: var(--el-text-color-regular);
}

/* 跟持股表同一個切換點（holdings/index.vue 的 1279px）：卡片模式裡就用清單 */
@media (max-width: 1279px) {
  .ledger__table {
    display: none;
  }

  .ledger__list {
    display: block;
  }
}
</style>
