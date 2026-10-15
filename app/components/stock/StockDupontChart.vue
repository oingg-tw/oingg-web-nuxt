<script setup lang="ts">
import type { LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'
import type { StockDupontPageResponse } from '#shared/types/stock-dupont-page'
// 杜邦分析的圖卡（ROE 與三項因子四條線；外殼、近N年與自訂區間在 SharedChartCard）連同期別切換與空狀態說明（2026-10-14 從 pages/stock/[code]/dupont.vue 抽出，
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

// 圖表區間（2026-09-22「圖表要可以選 1235 年」）與自訂區間：useChartPeriod＋SharedChartCard，從已載入的期數切片不重抓。停用的
// 近N年依「篩選後的筆數」逐基準量（2330 的近四季 equityMultiplier 曾經只回溯 2.5 年）。
const { period, shown } = useChartPeriod({
  all: ascending,
  keyOf: entry => `${entry.fiscalYear}Q${entry.fiscalQuarter}`,
  labelOf: key => key.replace('Q', ' Q')
})

// 沒有分解的原因從資料讀（2026-09-22 之前無條件寫成「銀行、保險與金控」，但歷史淺的 2207 和泰車不是金融股）：金融股沒有資產週轉率、
// 歷史淺的公司有它但缺三個獲利因子，兩者都沒有才是一般的「沒有資料」。
const emptyReason = computed<'financial' | 'history' | 'none'>(() => {
  const entry = props.data.series?.entries.at(-1)
  if (!entry) return 'none'
  return entry.values.assetTurnover?.value == null ? 'financial' : 'history'
})
</script>

<template>
  <SharedChartCard :period="ascending.length ? period : undefined">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <!-- 期別在近N年的左邊，同 StockMetricHistoryChartInteractive 的排法 -->
    <template v-if="ascending.length" #controls>
      <el-radio-group v-model="basis" aria-label="期別（單季或近四季）">
        <el-radio-button value="TTM">近四季</el-radio-button>
        <el-radio-button value="Q">單季</el-radio-button>
      </el-radio-group>
    </template>
    <StockMultiSeriesLineChart v-if="ascending.length" :entries="shown" :series="ROE_SERIES" unit="%" unit-right="倍 / 次" :format="dupontRateText" />
    <p v-else-if="emptyReason === 'financial'" class="stock-dupont-chart__line">
      銀行、保險與金控不適用：資產是放款與保單，資產週轉率沒有意義。
    </p>
    <p v-else-if="emptyReason === 'history'" class="stock-dupont-chart__line">
      三項裡有一項還算不出來，所以暫時沒有這張圖。
    </p>
    <p v-else class="stock-dupont-chart__line">
      目前沒有這檔股票的杜邦拆解資料。
    </p>
  </SharedChartCard>
</template>

<style scoped>
.stock-dupont-chart__line {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
}
</style>
