<script setup lang="ts">
import type { ImportOutcome, ImportResult, OpeningPosition } from '~/composables/stock/useHoldings'
import type { BrokerFormat, ImportedTrade, OpeningRow, SkippedRow } from '~/utils/broker-trade-csv'

// 匯入券商成交明細：選檔 → 試算 →（賣超時）自動補期初部位再試算 → 確認。
//
// 檔案只在瀏覽器裡讀（decodeBrokerCsv／parseBrokerTradeCsv），送出的只有解析後的交易。持股預覽是
// bff-ts 的 dryRun 算的，這裡不推算均價。
//
// **期初部位不問使用者**（使用者 2026-10-05：「既然都已經賣出了，就不要管有沒有初始價金了，畢竟不影響
// 庫存」）。這不只是「通常不影響」：期初股數取最少需要量（mergeOpeningShortfalls 的加總）時，持股在
// 最後一筆賣超那一刻剛好歸零，而 bff-ts 在歸零時把剩餘成本整個扣掉——所以期初成本**永遠**到不了
// 目前的庫存，只影響那幾筆賣出的已實現損益。起初的版本只問「匯入後仍持有」的代號，用真實檔案一模擬
// 就露餡：3611 仍持有 2,000 股，但期初那 99 股早在一年前賣掉了，問了也不影響任何東西。
//
// 成本帶入券商的成本；券商沒有就帶那幾筆賣出的均價（已實現損益約為 0），不帶 0（會灌成獲利）。
//
// destroy-on-close（模板上）：檔案欄位要跟著清空，否則關掉再開、選同一個檔案時 change 事件不會觸發。
const props = defineProps<{
  importTrades: (source: string, trades: ImportedTrade[], openings: OpeningPosition[], dryRun: boolean) => Promise<ImportOutcome>
  symbolLabel: (symbol: string) => string
}>()
const visible = defineModel<boolean>({ required: true })

// bff-ts 每批上限
const IMPORT_MAX_ROWS = 2000

const brokerId = ref<BrokerFormat['id']>(BROKER_FORMATS[0].id)
const broker = computed(() => BROKER_FORMATS.find(item => item.id === brokerId.value)!)
const busy = ref(false)
const fileName = ref('')
const error = ref('')
const trades = ref<ImportedTrade[]>([])
const skipped = ref<SkippedRow[]>([])
const openings = ref<OpeningRow[]>([])
const preview = ref<ImportResult | null>(null)

const parsed = computed(() => trades.value.length > 0)
const dateRange = computed(() => {
  const dates = trades.value.map(trade => trade.tradeDate).sort()
  return dates.length ? `${dates[0]}～${dates.at(-1)}` : ''
})
const skippedReasons = computed(() => {
  const counts = new Map<string, number>()
  for (const row of skipped.value) counts.set(row.reason, (counts.get(row.reason) ?? 0) + 1)
  return [...counts]
})
// 對話框底部永遠有「下一步」那顆主按鈕；按不了的時候旁邊說為什麼（2026-10-05 使用者回報「沒有確認
// 可以給我按」）。
const footerHint = computed(() => {
  if (busy.value) return '試算中…'
  if (error.value) return '無法繼續：請看上方的說明'
  if (!parsed.value) return '請先選擇 CSV 檔案'
  if (preview.value?.inserted === 0) return '這份檔案的交易都已經匯入過了'
  return ''
})
const skippedOpenings = computed(() => preview.value?.openingPositions.filter(item => item.status === 'skipped') ?? [])

function reset() {
  busy.value = false
  fileName.value = ''
  error.value = ''
  trades.value = []
  skipped.value = []
  openings.value = []
  preview.value = null
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  reset()
  fileName.value = file.name
  const result = parseBrokerTradeCsv(decodeBrokerCsv(await file.arrayBuffer()))
  if (!result.ok) {
    error.value = result.error
    return
  }
  if (result.trades.length === 0) {
    error.value = '檔案裡沒有可以匯入的現股交易'
    skipped.value = result.skipped
    return
  }
  if (result.trades.length > IMPORT_MAX_ROWS) {
    error.value = `一次最多匯入 ${groupThousands(IMPORT_MAX_ROWS)} 筆，這份有 ${groupThousands(result.trades.length)} 筆，請分段匯出`
    return
  }
  trades.value = result.trades
  skipped.value = result.skipped
  await dryRun()
}

function openingPayload(): OpeningPosition[] {
  return openings.value.map(row => ({ symbol: row.symbol, quantity: row.quantity!, averageCost: row.averageCost ?? row.soldPrice }))
}

async function dryRun(autoRetry = true) {
  busy.value = true
  error.value = ''
  preview.value = null
  const outcome = await props.importTrades(broker.value.source, trades.value, openingPayload(), true)
  busy.value = false
  if (outcome.kind === 'ok') preview.value = outcome.result
  else if (outcome.kind === 'shortfalls') {
    openings.value = mergeOpeningShortfalls(openings.value, outcome.shortfalls, trades.value)
    // 加總後的期初股數就是最少需要量，再試一次就會過（真實檔案模擬 11 檔零賣超）。只自動重試一次，
    // 萬一還不夠就停下來報錯，不無限迴圈。
    if (autoRetry) await dryRun(false)
    else error.value = '補上期初部位後仍有賣出超過持有股數，請檢查檔案是否完整'
  } else error.value = outcome.message
}

async function commit() {
  busy.value = true
  error.value = ''
  const outcome = await props.importTrades(broker.value.source, trades.value, openingPayload(), false)
  busy.value = false
  if (outcome.kind === 'ok') {
    visible.value = false
    if (outcome.result.importId === null) ElMessage.info('這份檔案的交易都已經匯入過了，沒有新增任何紀錄')
    return
  }
  // 試算與確認之間資料變了（例如另一個分頁記了一筆）：重新試算
  if (outcome.kind === 'shortfalls') {
    openings.value = mergeOpeningShortfalls(openings.value, outcome.shortfalls, trades.value)
    await dryRun(false)
  } else error.value = outcome.message
}
</script>

<template>
  <el-dialog v-model="visible" title="匯入券商成交明細" width="min(760px, 94vw)" destroy-on-close @closed="reset">
    <div v-loading="busy" class="import">
      <p class="import__text">選擇券商匯出的「成交明細」CSV。檔案只在你的瀏覽器裡讀取，不會上傳；送出的只有解析後的交易。匯過的交易會自動略過，重複匯入同一份檔案不會重複記錄。</p>

      <div class="import__file">
        <span id="import-broker-label" class="import__file-label">券商</span>
        <!-- ponytail: 選項目前只有已支援的格式（BROKER_FORMATS）。全市場券商名單請 analysis-ts 存 DB（2026-10-05
             已開規格），到了改成讀那份名單，尚未支援的券商列出來但不能選。 -->
        <el-select v-model="brokerId" size="large" filterable class="import__broker" aria-labelledby="import-broker-label" :disabled="busy || parsed">
          <el-option v-for="item in BROKER_FORMATS" :key="item.id" :value="item.id" :label="item.label" />
        </el-select>
        <p class="import__hint">目前只支援{{ BROKER_FORMATS.map(item => item.label).join('、') }}的「成交明細」匯出檔。</p>
      </div>

      <label class="import__file">
        <span class="import__file-label">CSV 檔案</span>
        <input type="file" accept=".csv,text/csv" :disabled="busy" @change="onFile">
      </label>

      <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" />

      <template v-if="parsed">
        <dl class="import__facts">
          <div><dt>檔案</dt><dd>{{ fileName }}</dd></div>
          <div><dt>成交筆數</dt><dd>{{ groupThousands(trades.length) }} 筆（{{ dateRange }}）</dd></div>
          <div v-if="preview"><dt>會新增</dt><dd>{{ groupThousands(preview.inserted) }} 筆<template v-if="preview.duplicates">，{{ groupThousands(preview.duplicates) }} 筆匯過了會略過</template></dd></div>
        </dl>
        <ul v-if="skippedReasons.length" class="import__notes">
          <li v-for="[reason, count] in skippedReasons" :key="reason">{{ count }} 列不匯入：{{ reason }}</li>
        </ul>

        <section v-if="preview" aria-labelledby="import-preview-title">
          <h3 id="import-preview-title" class="import__title">匯入後的持股</h3>
          <ul v-if="skippedOpenings.length" class="import__notes">
            <li v-for="item in skippedOpenings" :key="item.symbol">{{ symbolLabel(item.symbol) }} 已有期初部位，沿用原值；要改請直接編輯那筆交易</li>
          </ul>
          <el-table :data="preview.holdings" row-key="symbol" max-height="360">
            <template #empty>匯入後沒有持股（全部都已賣出）</template>
            <el-table-column label="股票" min-width="160">
              <template #default="{ row }">{{ symbolLabel(row.symbol) }}</template>
            </el-table-column>
            <el-table-column label="股數" align="right" min-width="90">
              <template #default="{ row }">{{ groupThousands(row.quantity) }}</template>
            </el-table-column>
            <el-table-column label="平均成本" align="right" min-width="100">
              <template #default="{ row }">{{ groupThousands(String(Number(row.averageCost))) }}</template>
            </el-table-column>
          </el-table>
          <p class="import__hint">在匯出期間以前買進、期間內一直沒有交易的股票，不會出現在明細裡，請用「記一筆交易」補上。</p>
        </section>

        <details v-if="openings.length" class="import__details">
          <summary>自動補上的期初部位（{{ openings.length }} 檔）</summary>
          <p class="import__text">這幾檔在明細裡賣出的股數比買進多（匯出期間以前就持有，或來自配股、增資、轉入）。期初股數取最少需要的量，這批股票在期間內都已賣完，所以期初成本不影響目前持股，只影響當時那幾筆賣出的已實現損益。</p>
          <el-table :data="openings" row-key="symbol">
            <el-table-column label="股票" min-width="150">
              <template #default="{ row }">{{ symbolLabel(row.symbol) }}</template>
            </el-table-column>
            <el-table-column label="期初股數" align="right" min-width="90">
              <template #default="{ row }">{{ groupThousands(row.quantity) }}</template>
            </el-table-column>
            <el-table-column label="帶入成本" align="right" min-width="90">
              <template #default="{ row }">{{ row.averageCost ?? row.soldPrice }}</template>
            </el-table-column>
            <el-table-column label="依據" min-width="150">
              <template #default="{ row }">{{ row.fromBroker ? '券商記錄的成本' : '券商沒有成本，用賣出均價' }}</template>
            </el-table-column>
          </el-table>
        </details>
      </template>
    </div>

    <template #footer>
      <div class="import__footer">
        <p v-if="footerHint" class="import__footer-hint" role="status">{{ footerHint }}</p>
        <el-button size="large" @click="visible = false">取消</el-button>
        <el-button type="primary" size="large" :disabled="!preview || busy || preview.inserted === 0" @click="commit">
          {{ preview ? `確認匯入 ${groupThousands(preview.inserted)} 筆` : '確認匯入' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.import {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.import__text {
  margin: 0;
  line-height: 1.6;
}

.import__file {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.import__file-label {
  font-weight: 600;
}

.import__broker {
  width: min(320px, 100%);
}

.import__file input {
  min-height: 44px;
  font-size: 1rem;
}

.import__facts {
  display: grid;
  gap: 4px;
  margin: 0;
}

.import__facts div {
  display: flex;
  gap: 8px;
}

.import__facts dt {
  min-width: 5em;
  color: var(--el-text-color-regular);
}

.import__facts dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.import__notes {
  margin: 0;
  padding-left: 20px;
  color: var(--el-text-color-regular);
}

.import__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 8px;
}



.import__hint {
  margin: 0;
}


.import__hint {
  color: var(--el-text-color-regular);
}



.import__details summary {
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
  font-weight: 600;
}

.import__details > * + * {
  margin-top: 8px;
}

.import__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.import__footer-hint {
  margin: 0 auto 0 0;
  color: var(--el-text-color-regular);
  text-align: left;
}

.import__footer :deep(.el-button) {
  margin: 0;
}

</style>
