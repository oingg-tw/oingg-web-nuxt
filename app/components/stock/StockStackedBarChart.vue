<script setup lang="ts">
// 沒註冊的 series type 不會丟錯，只會靜靜地畫出一個空的座標區（2026-09-21 就是這樣踩到的）。
// BarChart 和 LegendComponent 都是這張圖新用的，少任何一個都不會有錯誤訊息。

// 一般化自 StockEquityCompositionChart.vue（2026-09-27 當天）。第二個使用者出現的時候抽出來而不是
// 複製：疊層的負值處理、圖例與 grid 的留白、ECharts 註冊這三件都是量出來的，兩份手維護的複本會
// 靜靜地飄開。兩個使用者分別是資產負債表頁的「淨值組成」（存量，億元）與「每股淨值怎麼變的」
// （流量，元／股），單位和層數都不同，所以這裡不碰數字，只負責畫。
//
// 第一層拿強調色、其餘用墨色階：堆疊圖的每一層不是一樣重要，把 N 層畫成 N 個同樣醒目的顏色等於說
// 它們一樣重要。呼叫端把「回答問題的那一層」排第一個。方向性不靠顏色帶——順序固定，圖例和 tooltip
// 各自說了是哪一層。
// 合計線（2026-10-15，使用者看了淨值組成：「數字是負的 那圖表呈現這樣是不是就很怪」→「請觀察 5314」→「計畫一下怎麼改比較正常」）：
// 柱頂是「正的那幾層加總」，只要有負的一層，柱頂就比真正的合計高，而圖上沒有任何地方畫出真正的合計。5314 是最明顯的例子：
// 2021 Q3–2022 Q3 是 6 億的股本柱下面掛 −4.5 億的累積虧損，淨值只有 1.2–1.5 億；2022 Q4 減資彌補虧損，股本 6 → 1.47 億、
// 累積虧損 −4.66 → −0.04 億，柱子驟降，淨值卻是 1.19 → 1.22 億幾乎沒動。所以有負值時多畫一條「合計」線（各層加總——三個呼叫端的
// 層加起來都正好是合計：資產負債組成的恆等式由 check-balance-composition.mjs 驗、指標的堆疊模式有「未拆解」層補、每股淨值變動的六項
// 加起來就是變動）。全是正值時柱頂就是合計，線只是重複，不畫。線照高齡友善規格：2.5px 實線、8px 實心點，深墨色跟各層分得開。
export interface StackedBarLayer {
  name: string
  // 已經換算成顯示單位的值，一個類別一個。負值會疊到零軸下面，這是刻意的（其他權益的匯率換算差額、
  // 現金股利都是真的負數）。
  values: number[]
}

const props = defineProps<{
  categories: string[]
  layers: StackedBarLayer[]
  unit: string
  // 合計線的名稱（「淨值」「淨值變動」或指標名）。必填：有負值時一定要畫得出真正的合計
  totalName: string
  // 這一層改用色階最後那個中性灰，而不是照順序拿下一個顏色（2026-09-28）。用途是「拆不開的那一塊」
  // ——它不是一個成分，是「這一期沒辦法拆」，用一個跟其他成分同樣鮮明的顏色會讓它讀起來像第四個科目。
  // 灰色本身也在 getStackLayerColors 裡、對比量過，不是另外挑一個沒驗過的顏色。
  neutralLayerName?: string
  // 每個類別的合計與說明，由呼叫端算——存量的合計是權益，流量的是期初→期末，這裡無從判斷。
  tooltipHeader: (index: number) => string
  // 提示框每一列的數字怎麼印（2026-10-12）。金額圖傳 formatMoney，讓提示框跟表格是同一串字；預設 4 位有效數字，不印原始浮點數
  valueFormatter?: (value: number) => string
  height?: number
}>()
const formatValue = (value: number) => (props.valueFormatter ?? (v => formatSignificantDigits(v, 4)))(value)

const { resolvedMode, color: accentColorName } = useAppTheme()

// 第 0 層跟著使用者選的強調色，其餘來自 getStackLayerColors（對比度量過，見那邊的註解）。
// 第一版用 chartInk 的 baseline/gridline 當第 4、5 層，兩個對 light 卡片只有 1.65 和 1.21，
// 而且六層配五個值會繞回去撞色——1294 的「現金股利」和「其他」曾經是同一個灰。
const layerColors = computed(() => {
  const ramp = getStackLayerColors(resolvedMode.value)
  const neutral = ramp[ramp.length - 1]!
  const ordered = [getAccentColor(resolvedMode.value, accentColorName.value), ...ramp]
  // 中性層佔掉灰色，其餘各層照順序跳過它，否則會有兩層同色。
  if (!props.neutralLayerName) return ordered
  const rest = ordered.filter(color => color !== neutral)
  let i = 0
  return props.layers.map(layer => (layer.name === props.neutralLayerName ? neutral : rest[i++ % rest.length]!))
})

const totals = computed(() => props.categories.map((_, index) => props.layers.reduce((sum, layer) => sum + (layer.values[index] ?? 0), 0)))
const showTotal = computed(() => props.layers.some(layer => layer.values.some(value => value < 0)))
const totalColor = computed(() => getChartInk(resolvedMode.value).primary)

const chartOption = computed(() => {
  const { categories, layers } = props
  return {
    // 圖例不畫在畫布裡（2026-10-12，/stock/2330/quick-view 負債組成跑版）：ECharts 不會替圖例保留空間，原本 grid.bottom: 56
    // 是照「最多折兩行」抓的，九層的負債組成在指標速覽的半寬卡片折成四行，直接疊在長條與 X 軸上。改成畫布下方的 HTML 清單，
    // 換幾行都由瀏覽器排，只會把卡片撐高、不會蓋到圖。top: 24 是給軸名的，8 會被切掉。
    grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
    legend: { show: false },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: { dataIndex?: number }[]) => {
        const index = params[0]?.dataIndex ?? 0
        const rows = layers
          // 千分位與有效位數（2026-10-12「不要出現 2446 而是要 2,446」「有效數字位元太少」）
          .map(layer => `<div>${layer.name}　${formatValue(layer.values[index] ?? 0)}</div>`)
          .join('')
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${props.tooltipHeader(index)}</div>${rows}</div>`
      }
    },
    xAxis: {
      type: 'category',
      data: categories,
      // 刻意不設 interval: 0（瀑布圖那邊有設，理由不能照搬）。375 寬六個類別會擠在一起，而這裡讓
      // ECharts 自己藏掉撞到的標籤是安全的：兩個使用者的圖正上方都是同樣列數的 SSR 表格，少一個
      // 刻度標籤不會有任何數字消失。瀑布圖沒有那張表，所以它必須每根都標。
    },
    yAxis: {
      type: 'value',
      name: props.unit,
    },
    series: [
      ...layers.map((layer, index) => ({
        name: layer.name,
        type: 'bar',
        stack: 'composition',
        // 色塊之間 1px 卡片底色的分隔線（2026-10-09，負債組成九層）：相鄰兩層顏色接近時邊界仍看得出來
        itemStyle: { color: layerColors.value[index], borderColor: resolvedMode.value === 'DARK' ? '#1e1e1e' : '#faf9f6', borderWidth: 1 },
        data: layer.values
      })),
      // 合計線底下多一條卡片底色的寬線、點加底色外框，同 StockMultiSeriesLineChart 的做法（它的註解有對比量測）：線是深墨色，
      // 跟股本、現金股利那一層的深灰幾乎同色，穿過那幾根柱子時會消失（2026-10-15，5314 截圖）。外框不給名字：aria-label 用 series 名字組
      ...(showTotal.value
        ? [{
            name: '',
            type: 'line',
            symbol: 'circle',
            symbolSize: 8 + 4,
            silent: true,
            tooltip: { show: false },
            emphasis: { disabled: true },
            lineStyle: { width: 2.5 + 4, color: CARD_SURFACE[resolvedMode.value] },
            itemStyle: { color: CARD_SURFACE[resolvedMode.value] },
            z: 9,
            data: totals.value
          }, {
            name: props.totalName,
            type: 'line',
            symbol: 'circle',
            symbolSize: 8,
            lineStyle: { width: 2.5, color: totalColor.value },
            itemStyle: { color: totalColor.value },
            z: 10,
            data: totals.value
          }]
        : [])
    ]
  }
})
</script>

<template>
  <div class="stock-stacked-bar-chart">
    <!-- 高度寫在 style 上而不是 CSS 的 v-bind()（2026-10-14）：v-bind() 的變數要等這個元件 onMounted 才寫上去，而 SharedChart 在那之前就
         初始化了——只在瀏覽器渲染的地方（指標速覽）ECharts 會量到 0 高、印「Can't get DOM width or height」。SSR 的頁面變數已在 HTML 裡，所以沒事 -->
    <SharedChart class="stock-stacked-bar-chart__canvas" :style="{ height: `clamp(15rem, 70vw, ${height ?? 380}px)` }" :option="chartOption" autoresize />
    <ul class="stock-stacked-bar-chart__legend" aria-label="圖例">
      <li v-for="(layer, index) in layers" :key="layer.name" class="stock-stacked-bar-chart__legend-item">
        <span class="stock-stacked-bar-chart__swatch" :style="{ background: layerColors[index] }" aria-hidden="true" />{{ layer.name }}
      </li>
      <li v-if="showTotal" class="stock-stacked-bar-chart__legend-item">
        <span class="stock-stacked-bar-chart__swatch stock-stacked-bar-chart__swatch--line" :style="{ background: totalColor }" aria-hidden="true" />{{ totalName }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* 高度：手機 70vw（375 ≈ 262px），桌機到 props.height；同 main.css 的 .app-chart（2026-10-08）。寫在模板的 style 上，見那裡的註解 */
.stock-stacked-bar-chart__canvas {
  width: 100%;
}

.stock-stacked-bar-chart__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  line-height: 1.5;
  color: var(--el-text-color-primary);
}

.stock-stacked-bar-chart__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.stock-stacked-bar-chart__swatch {
  flex-shrink: 0;
  width: 20px;
  height: 12px;
  border-radius: 2px;
}

/* 合計是線不是柱：圖例畫成一條 3px 的橫線 */
.stock-stacked-bar-chart__swatch--line {
  height: 3px;
}
</style>
