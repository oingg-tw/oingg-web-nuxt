<script setup lang="ts">
import type { ImportOutcome, ImportResult, ImportShortfall, OpeningPosition } from '~/composables/stock/useHoldings'
import type { BrokerFormat, ImportedTrade, OpeningRow, SkippedRow } from '~/utils/broker-trade-csv'

// destroy-on-close（模板上）：檔案欄位要跟著清空，否則關掉再開、選同一個檔案時 change 事件不會觸發。
//
// 匯入券商成交明細：選檔 → 試算 → （賣超時）補期初部位 → 再試算 → 確認。
//
// 檔案只在瀏覽器裡讀（decodeBrokerCsv／parseBrokerTradeCsv），送出的只有解析後的交易。每一步的持股
// 預覽都是 bff-ts 的 dryRun 算的，這裡不推算均價。
//
// 期初部位為什麼是主要流程而不是例外：實測一份兩年的真實匯出，約 50 檔裡 11 檔「賣出比檔內買進多」
// （匯出期間以前就買的、配股、增資）。
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
// 對話框底部永遠有「下一步」那顆主按鈕；按不了的時候旁邊說為什麼。2026-10-05 使用者回報「沒有確認
// 可以給我按」：原本確認鈕只在預覽出來後才出現，而補期初那一步的「重新試算」藏在內容最下方、成本沒填齊
// 就是灰的——真實檔案 11 檔要補、其中 8 檔券商沒有成本，所以使用者看到的就是一個只有「取消」的對話框。
const needsOpenings = computed(() => openings.value.length > 0 && !preview.value)
const missingCostCount = computed(() => openings.value.filter(row => row.quantity == null || row.averageCost == null).length)
const footerHint = computed(() => {
  if (busy.value) return '試算中…'
  if (error.value) return '無法繼續：請看上方的說明'
  if (!parsed.value) return '請先選擇 CSV 檔案'
  if (needsOpenings.value) return missingCostCount.value ? `還有 ${missingCostCount.value} 檔的期初股數或平均成本沒填` : '填好了，按「重新試算」看匯入後的持股'
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

function mergeShortfalls(shortfalls: ImportShortfall[]) {
  openings.value = mergeOpeningShortfalls(openings.value, shortfalls, trades.value)
}

function openingPayload(): OpeningPosition[] {
  return openings.value.map(row => ({ symbol: row.symbol, quantity: row.quantity!, averageCost: row.averageCost! }))
}

async function dryRun() {
  busy.value = true
  error.value = ''
  preview.value = null
  const outcome = await props.importTrades(broker.value.source, trades.value, openingPayload(), true)
  busy.value = false
  if (outcome.kind === 'ok') preview.value = outcome.result
  else if (outcome.kind === 'shortfalls') mergeShortfalls(outcome.shortfalls)
  else error.value = outcome.message
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
  // 試算與確認之間資料變了（例如另一個分頁記了一筆）：回到補期初那一步
  if (outcome.kind === 'shortfalls') {
    preview.value = null
    mergeShortfalls(outcome.shortfalls)
  } else error.value = outcome.message
}

// 改了期初就要重新試算，舊的預覽不再代表要送出的東西
watch(openings, () => {
  preview.value = null
}, { deep: true })
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

        <section v-if="openings.length && !preview" aria-labelledby="import-openings-title">
          <h3 id="import-openings-title" class="import__title">補上期初部位</h3>
          <p class="import__text">下面幾檔在檔案裡賣出的股數比買進多（多半是匯出期間以前就持有，或來自配股、增資）。請填寫匯出期間開始前原本持有的股數與平均成本。</p>
          <div class="import__openings">
            <div v-for="row in openings" :key="row.symbol" class="import__opening">
              <p class="import__opening-name">{{ symbolLabel(row.symbol) }}</p>
              <label class="import__field">
                <span>期初股數</span>
                <el-input-number v-model="row.quantity" :min="1" :max="2147483647" :precision="0" :controls="false" :aria-label="`${symbolLabel(row.symbol)} 期初股數`" />
              </label>
              <label class="import__field">
                <span>平均成本（元／股）</span>
                <el-input-number v-model="row.averageCost" :min="0" :controls="false" :aria-label="`${symbolLabel(row.symbol)} 期初平均成本`" />
              </label>
              <p class="import__hint">{{ row.fromBroker ? '依券商的成交明細推算，請確認' : '券商沒有這批股票的成本資料，請自己填寫；配股或增資取得可填 0' }}</p>
            </div>
          </div>
        </section>

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
        </section>
      </template>
    </div>

    <template #footer>
      <div class="import__footer">
        <p v-if="footerHint" class="import__footer-hint" role="status">{{ footerHint }}</p>
        <el-button size="large" @click="visible = false">取消</el-button>
        <el-button v-if="needsOpenings" type="primary" size="large" :disabled="missingCostCount > 0 || busy" @click="dryRun">重新試算</el-button>
        <el-button v-else type="primary" size="large" :disabled="!preview || busy || preview.inserted === 0" @click="commit">
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

.import__openings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 12px 0;
}

.import__opening {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px 16px;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}

.import__opening-name,
.import__hint {
  grid-column: 1 / -1;
  margin: 0;
}

.import__opening-name {
  font-weight: 600;
}

.import__hint {
  color: var(--el-text-color-regular);
}

.import__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.import__field :deep(.el-input-number) {
  width: 100%;
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

@media (max-width: 767px) {
  .import__opening {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
