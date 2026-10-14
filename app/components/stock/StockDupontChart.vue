<script setup lang="ts">
import type { LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'
import type { LookbackWindow } from '~/utils/lookback-window'
import type { StockDupontPageResponse } from '#shared/types/stock-dupont-page'
// 杜邦分析的圖（ROE 與三項因子四條線）連同右上角的期別、近N年與空狀態說明（2026-10-14 從 pages/stock/[code]/dupont.vue 抽出，
// 使用者：「杜邦分析也該要可以釘選」——指標速覽畫得出圖才能釘，見 hasPinnableChart）。期別用 v-model:basis：杜邦頁的表格與答句
// 跟著同一個期別，所以由頁面持有；指標速覽不綁，元件自己記。
const props = defineProps<{ data: StockDupontPageResponse }>()
// 預設近四季：單季 ROE 是季報酬，9.71% 被讀成年化會高估約四倍
const basis = defineModel<'TTM' | 'Q'>('basis', { default: 'TTM' })

// 四條線（2026-09-22「線圖怎麼只剩下一條？請給我稅後淨利率 總資產周轉 權益乘數 ROE」）。原本只畫 ROE，理由是三個因子單位不同
//（%、次、倍）「不能共軸」、而指數化到共同基期被否決（淨利率在虧損年是負的，負基期會翻轉後面每一點的符號）。漏掉的是：不必共用一個
// 軸——百分比在左、倍數在右（次與倍都是 0–2 之間的無量綱比率），tooltip 各自標單位。四組不同的（線型, 符號）配對，不靠顏色就分得開
//（WCAG 1.4.1），也看得出哪條線屬於哪個軸。仍然不把 ROE 的變動歸因給某個因子。
// 名稱帶單位：權益乘數在右軸 1.5 附近，卻會穿過左軸 54 那條格線，圖例不寫「（倍）」就會被讀成 54%。
const ROE_SERIES = [
  { code: 'roe', name: '股東權益報酬率（%）', lineType: 'solid', symbol: 'circle' },
  { code: 'netProfitMargin', name: '稅後淨利率（%）', lineType: 'dashed', symbol: 'triangle' },
  { code: 'assetTurnover', name: '資產週轉率（次）', lineType: 'dotted', symbol: 'rect', axis: 'right', format: dupontTimesText },
  { code: 'equityMultiplier', name: '權益乘數（倍）', lineType: 'solid', symbol: 'diamond', axis: 'right', format: dupontMultipleText }
] as const satisfies readonly LineSeriesSpec[]

const ascending = computed(() => trimDupontEntries((basis.value === 'Q' ? props.data.quarterlySeries : props.data.series)?.entries ?? []))

// 圖表區間（2026-09-22「圖表要可以選 1235 年」）：全站同一組 近 1/2/3/5/8 年、同一個 SharedLookbackWindowSelect，從已載入的期數切片不重抓。
// 停用的視窗依「篩選後的筆數」逐基準量出來（2330 的近四季 equityMultiplier 曾經只回溯 2.5 年）；回填到了選項自己恢復。
const DISABLED_WINDOW_YEARS = computed<number[]>(() => LOOKBACK_YEARS.filter(years => ascending.value.length < years * 4))
// 自己的 ref，不用 useMetricHistoryChartWindow()：一頁的視窗不該動到另一頁。存讀者要的視窗、從不寫它；真正畫的是 effectiveWindow——
// 可用深度隨基準切換而變，夾住 ref 本身會把我們的收窄變成他們的選擇。
const chartWindow = ref<LookbackWindow>('近5年')
const effectiveWindow = computed<LookbackWindow>(() => {
  const disabled = DISABLED_WINDOW_YEARS.value
  if (!disabled.includes(LOOKBACK_WINDOW_YEARS[chartWindow.value])) return chartWindow.value
  const widest = [...LOOKBACK_YEARS].reverse().find(years => !disabled.includes(years))
  return widest ? (`近${widest}年` as LookbackWindow) : chartWindow.value
})
const windowedAscending = computed(() => ascending.value.slice(-(LOOKBACK_WINDOW_YEARS[effectiveWindow.value] ?? 5) * 4))
// 自訂區間（2026-10-14，跟指標圖同一套，見 useCustomPeriodRange）
const { open: customOpen, from: customFrom, to: customTo, keys: periodOptions, toKeys: toOptions, shown, summary: customSummary, labelOf, start: openCustom, stop: closeCustom } =
  useCustomPeriodRange({ all: ascending, windowed: windowedAscending, keyOf: entry => `${entry.fiscalYear}Q${entry.fiscalQuarter}`, labelOf: key => key.replace('Q', ' Q'), unit: '季' })
function handleWindowChange(value: LookbackWindow) {
  chartWindow.value = value
  closeCustom()
}

// 沒有分解的原因從資料讀（2026-09-22 之前無條件寫成「銀行、保險與金控」，但歷史淺的 2207 和泰車不是金融股）：金融股沒有資產週轉率、
// 歷史淺的公司有它但缺三個獲利因子，兩者都沒有才是一般的「沒有資料」。
const emptyReason = computed<'financial' | 'history' | 'none'>(() => {
  const entry = props.data.series?.entries.at(-1)
  if (!entry) return 'none'
  return entry.values.assetTurnover?.value == null ? 'financial' : 'history'
})
</script>

<template>
  <div class="stock-dupont-chart">
    <template v-if="ascending.length">
      <!-- 期別在近N年的左邊，同 StockMetricHistoryChartInteractive 的排法 -->
      <div class="stock-dupont-chart__corner">
        <el-radio-group v-model="basis" aria-label="期別（單季或近四季）">
          <el-radio-button value="TTM">近四季</el-radio-button>
          <el-radio-button value="Q">單季</el-radio-button>
        </el-radio-group>
        <SharedLookbackWindowSelect
          :model-value="effectiveWindow"
          :insufficient-years="DISABLED_WINDOW_YEARS"
          custom-label="自訂區間…"
          :custom-active="customOpen"
          @update:model-value="handleWindowChange"
          @custom="openCustom"
        />
      </div>
      <StockMultiSeriesLineChart :entries="shown" :series="ROE_SERIES" unit="%" unit-right="倍 / 次" :format="dupontRateText" />
      <SharedPeriodRangeFields
        v-if="customOpen"
        v-model:from="customFrom"
        v-model:to="customTo"
        :keys="periodOptions"
        :to-keys="toOptions"
        :label-of="labelOf"
        :summary="customSummary"
      />
    </template>
    <p v-else-if="emptyReason === 'financial'" class="stock-dupont-chart__line">
      銀行、保險與金控不適用：資產是放款與保單，資產週轉率沒有意義。
    </p>
    <p v-else-if="emptyReason === 'history'" class="stock-dupont-chart__line">
      三項裡有一項還算不出來，所以暫時沒有這張圖。
    </p>
    <p v-else class="stock-dupont-chart__line">
      目前沒有這檔股票的杜邦拆解資料。
    </p>
  </div>
</template>

<style scoped>
/* 選項自己一列、靠右，在圖上方。疊在圖的右上角時，四個圖例項目在 1440 寬就會被蓋到第四個（「權益乘數（倍）」只剩「權益乘」，
   2026-10-14 截圖量到），窄螢幕更是整列被蓋，所以不疊 */
.stock-dupont-chart__corner {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.stock-dupont-chart__line {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
}
</style>
