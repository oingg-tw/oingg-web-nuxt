<script setup lang="ts">
import type { ImportOutcome, ImportResult, ImportShortfall, OpeningPosition } from '~/composables/stock/useHoldings'
import type { Acquisition, BrokerFormat, ImportedTrade, PreWindowLot, SkippedRow } from '~/utils/broker-trade-csv'

// 匯入券商成交明細：選檔 → 試算 →（賣超時）自動補期初部位再試算 → 確認。
//
// 成本法是**先進先出**（使用者 2026-10-05「比照券商就好」）。除權配股由 bff-ts 在除權日自動入帳，不會出現
// 在賣超裡。剩下的賣超分兩種（splitShortfalls）：
//   - 券商有成本 → 匯出期間以前的部位，自動補期初買進，成本由券商成本以先進先出倒推（preWindowLots），已實現
//     損益每天、每檔都對上券商。不問使用者（「既然都已經賣出了，就不要管有沒有初始價金了，畢竟不影響庫存」）。
//   - 券商沒成本 → 補一筆「成本不明」的取得，日期在該檔最早交易日的前一天（先進先出先賣它）：庫存照算、
//     已實現損益不計入、報酬率當成以市值轉入。使用者可以改填實際成本。不擋匯入。
//
// 檔案只在瀏覽器裡讀（decodeBrokerCsv／parseBrokerTradeCsv），送出的只有解析後的交易。持股預覽是 bff-ts 的
// dryRun 算的，這裡不推算成本。
//
// destroy-on-close（模板上）：檔案欄位要跟著清空，否則關掉再開、選同一個檔案時 change 事件不會觸發。
const props = defineProps<{
  importTrades: (source: string, trades: ImportedTrade[], openings: OpeningPosition[], dryRun: boolean) => Promise<ImportOutcome>
  symbolLabel: (symbol: string) => string
}>()
const visible = defineModel<boolean>({ required: true })

// bff-ts 每批上限
const IMPORT_MAX_ROWS = 2000

// 下拉選單列全市場的證券商（GET /brokers，60 家，公開資料），但只有有解析器的才能選：bff-ts 的匯入 source
// 有白名單，選了別家送出會被 400 擋下。名單讀不到時退回只列支援的那幾家。
interface BrokerOption { code: string; label: string; format: BrokerFormat | null }
const { data: brokerList } = useAsyncData('broker-list', () =>
  $fetch<{ brokers: { brokerCode: string; shortName: string }[] }>('/brokers', { baseURL: BFF_BASE, timeout: BFF_REQUEST_TIMEOUT_MS })
    .then(response => response.brokers)
    .catch((error) => {
      devWarn('holdings', 'GET /brokers unavailable', error)
      return null
    }), { lazy: true, server: false })
const brokerOptions = computed<BrokerOption[]>(() => {
  const supported = (code: string) => BROKER_FORMATS.find(format => format.brokerCode === code) ?? null
  if (!brokerList.value?.length) return BROKER_FORMATS.map(format => ({ code: format.brokerCode, label: format.label, format }))
  // 有解析器的排最前面，其餘照代號
  return brokerList.value
    .map(item => ({ code: item.brokerCode, label: item.shortName, format: supported(item.brokerCode) }))
    .sort((a, b) => Number(!a.format) - Number(!b.format) || a.code.localeCompare(b.code))
})
const brokerCode = ref<string>(BROKER_FORMATS[0].brokerCode)
const broker = computed(() => BROKER_FORMATS.find(format => format.brokerCode === brokerCode.value) ?? BROKER_FORMATS[0])
const busy = ref(false)
const fileName = ref('')
const error = ref('')
const trades = ref<ImportedTrade[]>([])
const skipped = ref<SkippedRow[]>([])
// bff-ts 回報賣超後自動補的期初買進（匯出期間以前的部位，成本由券商成本以先進先出倒推，見 preWindowLots）
const openings = ref<PreWindowLot[]>([])
// 券商沒成本的賣超補的取得，與使用者填的成本（依代號；沒填＝成本不明）
const acquisitions = ref<Acquisition[]>([])
const unknownCosts = ref<Record<string, number | null | undefined>>({})
const preview = ref<ImportResult | null>(null)

const parsed = computed(() => trades.value.length > 0)
const unknownLots = computed(() => {
  const lots = new Map<string, { symbol: string; quantity: number; firstDate: string; count: number }>()
  for (const item of acquisitions.value) {
    const lot = lots.get(item.symbol)
    if (lot) {
      lot.quantity += item.quantity
      lot.count += 1
      if (item.tradeDate < lot.firstDate) lot.firstDate = item.tradeDate
    } else lots.set(item.symbol, { symbol: item.symbol, quantity: item.quantity, firstDate: item.tradeDate, count: 1 })
  }
  return [...lots.values()]
})
const payloadTrades = computed(() => [...trades.value, ...preWindowRows(openings.value), ...acquisitionRows(acquisitions.value, unknownCosts.value)])
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
  if (!preview.value) return '取得成本改過了，按「重新試算」更新預覽'
  if (preview.value.inserted === 0) return '這份檔案的交易都已經匯入過了'
  return ''
})
// 試算完成時念出結果（2026-10-07 a11y 盤點：原本 footerHint 一變成空字串就什麼都不念，螢幕閱讀器使用者不知道
// 試算好了）。footerHint 有字時照念它。
const statusText = computed(() => footerHint.value || (preview.value ? `試算完成：會新增 ${groupThousands(preview.value.inserted)} 筆` : ''))

// 兩張預覽表改用 HoldingsMetricTable（手機上 el-table 把「平均成本」「每股成本」推到對話框外）
const previewRows = computed(() => (preview.value?.holdings ?? []).map(row => ({
  name: props.symbolLabel(row.symbol),
  value: groupThousands(row.quantity),
  market: groupThousands(String(Number(row.averageCost)))
})))
const openingRows = computed(() => openings.value.map(row => ({ name: props.symbolLabel(row.symbol), value: groupThousands(row.quantity), market: String(row.price) })))

const skippedOpenings = computed(() => preview.value?.openingPositions.filter(item => item.status === 'skipped') ?? [])

function reset() {
  busy.value = false
  fileName.value = ''
  error.value = ''
  trades.value = []
  skipped.value = []
  openings.value = []
  acquisitions.value = []
  unknownCosts.value = {}
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

// 期初部位改成一般的買進列送出（一檔可能有好幾批不同成本），不再用 openingPositions（一檔只能一個成本）
function openingPayload(): OpeningPosition[] {
  return []
}

// 填或清掉一個取得成本＝送出的交易變了：舊預覽與自動補的期初都要重算
function unknownCostEdited() {
  preview.value = null
}

function applyShortfalls(shortfalls: ImportShortfall[]) {
  const { known, unknown } = splitShortfalls(shortfalls, trades.value)
  openings.value = [...openings.value, ...preWindowLots(known, trades.value)]
  acquisitions.value = mergeAcquisitions(acquisitions.value, unknown)
}

async function dryRun(autoRetry = true) {
  // 從頭算：上一輪補的期初與取得不再對應（使用者填的成本依代號保留）
  if (autoRetry) {
    openings.value = []
    acquisitions.value = []
  }
  busy.value = true
  error.value = ''
  preview.value = null
  const outcome = await props.importTrades(broker.value.source, payloadTrades.value, openingPayload(), true)
  busy.value = false
  if (outcome.kind === 'ok') preview.value = outcome.result
  else if (outcome.kind === 'shortfalls') {
    applyShortfalls(outcome.shortfalls)
    // 加總後的期初股數就是最少需要量，再試一次就會過（真實檔案模擬 11 檔零賣超）。只自動重試一次，
    // 萬一還不夠就停下來報錯，不無限迴圈。
    if (autoRetry) await dryRun(false)
    else error.value = '補上期初部位後仍有賣出超過持有股數，請檢查檔案是否完整'
  } else error.value = outcome.message
}

async function commit() {
  busy.value = true
  error.value = ''
  const outcome = await props.importTrades(broker.value.source, payloadTrades.value, openingPayload(), false)
  busy.value = false
  if (outcome.kind === 'ok') {
    visible.value = false
    if (outcome.result.importId === null) ElMessage.info('這份檔案的交易都已經匯入過了，沒有新增任何紀錄')
    return
  }
  // 試算與確認之間資料變了（例如另一個分頁記了一筆）：重新試算
  if (outcome.kind === 'shortfalls') {
    applyShortfalls(outcome.shortfalls)
    await dryRun(false)
  } else error.value = outcome.message
}
</script>

<template>
  <el-dialog v-model="visible" title="匯入券商成交明細" width="min(760px, 94vw)" destroy-on-close @closed="reset">
    <div v-loading="busy" class="import">
      <p class="import__text">選擇券商匯出的「成交明細」CSV。檔案只在你的瀏覽器裡讀取，不會上傳；送出的只有解析後的交易。匯過的交易會自動略過，重複匯入同一份檔案不會重複記錄。</p>

      <div class="import__file">
        <span class="import__file-label" aria-hidden="true">券商</span>
        <el-select v-model="brokerCode" size="large" filterable class="import__broker" aria-label="券商" :disabled="busy || parsed">
          <el-option
            v-for="item in brokerOptions"
            :key="item.code"
            :value="item.code"
            :label="item.format ? item.label : `${item.label}（尚未支援）`"
            :disabled="!item.format"
          />
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

        <section v-if="unknownLots.length" aria-labelledby="import-unknown-title">
          <h3 id="import-unknown-title" class="import__title">取得成本不明的股票</h3>
          <p class="import__text">下面這幾筆賣出的股票，在明細裡沒有買進，券商也沒有記成本，例如很久以前買的（券商紀錄已過期）或從其他券商轉入。除權配股會自動計算，不在這裡。知道成本可以填；不填就標成「成本不明」：庫存照算，已實現損益不計入。</p>
          <p class="import__hint">如果是匯出期間以前持有的股票配股配來的，請先用「記一筆交易」補上除權前原本持有的股數，配股就會自動算出來。</p>
          <div class="import__unknowns">
            <label v-for="lot in unknownLots" :key="lot.symbol" class="import__unknown">
              <span class="import__unknown-name">{{ symbolLabel(lot.symbol) }}</span>
              <span class="import__hint">{{ lot.firstDate }}{{ lot.count > 1 ? ` 起 ${lot.count} 筆` : '' }}賣出 {{ groupThousands(lot.quantity) }} 股</span>
              <el-input-number
                v-model="unknownCosts[lot.symbol]"
                :min="0"
                :controls="false"
                placeholder="不知道可以留空"
                :aria-label="`${symbolLabel(lot.symbol)} 取得成本（元／股），選填`"
                @change="unknownCostEdited"
              />
              <span class="import__hint">{{ unknownCosts[lot.symbol] == null ? '成本不明，損益不計入' : '以這個成本計入損益' }}</span>
            </label>
          </div>
        </section>

        <section v-if="preview" aria-labelledby="import-preview-title">
          <h3 id="import-preview-title" class="import__title">匯入後的持股</h3>
          <ul v-if="skippedOpenings.length" class="import__notes">
            <li v-for="item in skippedOpenings" :key="item.symbol">{{ symbolLabel(item.symbol) }} 已有期初部位，沿用原值；要改請直接編輯那筆交易</li>
          </ul>
          <p v-if="!previewRows.length" class="import__text">匯入後沒有持股（全部都已賣出）</p>
          <HoldingsMetricTable v-else caption="匯入後的持股股數與平均成本" :rows="previewRows" name-label="股票" value-label="股數" market-label="平均成本" />
          <p class="import__hint">在匯出期間以前買進、期間內一直沒有交易的股票，不會出現在明細裡，請用「記一筆交易」補上。</p>
        </section>

        <details v-if="openings.length" class="import__details">
          <summary>自動補上的期初部位（{{ new Set(openings.map(lot => lot.symbol)).size }} 檔、{{ openings.length }} 批）</summary>
          <p class="import__text">這幾檔在明細裡賣出的股數比買進多，是匯出期間以前就持有的部位。成本照先進先出，由券商在那幾天賣出時記的成本倒推，所以已實現損益會跟券商一致。這些股票在期間內都已賣完，不影響目前持股。</p>
          <HoldingsMetricTable caption="自動補上的期初部位" :rows="openingRows" name-label="股票" value-label="期初股數" market-label="每股成本" />
        </details>
      </template>
    </div>

    <template #footer>
      <div class="import__footer">
        <p v-if="footerHint" class="import__footer-hint">{{ footerHint }}</p>
        <p class="visually-hidden" role="status">{{ statusText }}</p>
        <el-button size="large" @click="visible = false">取消</el-button>
        <el-button v-if="parsed && !preview && !error" type="primary" size="large" :disabled="busy" @click="dryRun()">重新試算</el-button>
        <el-button v-else type="primary" size="large" :disabled="!preview || busy || preview.inserted === 0" @click="commit">
          {{ preview ? `確認匯入 ${groupThousands(preview.inserted)} 筆` : '確認匯入' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 觸控目標至少 44px（2026-10-07 a11y 盤點：size="large" 是 40px） */
.import__footer :deep(.el-button) {
  min-height: 44px;
}

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

.import__unknowns {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.import__unknown {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 4px 16px;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}

.import__unknown-name {
  font-weight: 600;
}

.import__unknown :deep(.el-input-number) {
  width: 100%;
}

@media (max-width: 767px) {
  .import__unknown {
    grid-template-columns: minmax(0, 1fr);
  }
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
