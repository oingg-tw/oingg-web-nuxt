<script setup lang="ts">
import { use } from 'echarts/core'
import { BoxplotChart } from 'echarts/charts'
import type { BusinessCycleSensitivity } from '#shared/types/hub'
import type { SortableColumn } from '~/components/shared/SharedSortableTable.vue'
// 類股景氣敏感度（2026-10-24，使用者：「做成頁面 放在 industries 下」；數字是 analysis-ts 806cd493，名稱照詞彙表，不叫 beta）：景氣同時指標
// 年增率每多 1 個百分點，類股內公司的股價 12 個月報酬多幾個百分點。跟「營收與景氣」（/industries/cycle，用營收、不排序）是兩件事：這一頁
// 用股價，照上游的名次排列（使用者在 analysis-ts 那邊決定照樣排名，家數少的也排）。敏感度高低不是好壞，文案只寫數字；「領先」是禁用詞
// （compliance-words.ts），股價比同時指標早反映寫成「早約 2 個月反映」。
// 家數少的類股一兩家就會左右中位數（上游要求顯示家數或淡化）：圖上換成灰色虛線框、名稱後面寫家數，表格有家數欄。
// 箱型圖跟類股分布頁同一種畫法（IndustryFacetChart），這裡只畫 25%～75% 與中位數。未註冊的 ECharts 型別靜靜不畫，自己註冊
use([BoxplotChart])

const requestUrl = useRequestURL()
useSeoMeta({
  title: '台股類股景氣敏感度：股價跟著景氣起伏的程度',
  description: '證交所各類股的景氣敏感度：國發會景氣同時指標年增率每多 1 個百分點，類股內公司的股價 12 個月報酬多幾個百分點。近 15 年的中位數與四分位，附加權指數對照與各類股家數。'
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}/industries/sensitivity` }] })

const { data, error } = await useFetch<BusinessCycleSensitivity | null>('/api/hub/business-cycle-sensitivity', {
  key: 'hub-business-cycle-sensitivity',
  default: () => null
})
// 讀不到回 503（照其他 hub 頁的規則）：搜尋引擎要拿到暫時錯誤，不是一頁空白的 200
if (error.value) throw createError({ statusCode: 503, statusMessage: '類股景氣敏感度資料暫時無法取得', fatal: true })

type Row = BusinessCycleSensitivity['sectors'][number]
const rows = computed(() => data.value?.sectors ?? [])
// 家數少於這個的類股，一兩家公司就會左右中位數
const FEW = 10
const nameOf = (row: Row) => row.sectorName ?? row.sectorCode
const slope = (value: number) => `${value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}`
const monthText = (month: string) => `${month.slice(0, 4)} 年 ${Number(month.slice(5, 7))} 月`
// 計算日期寫台北日期（UTC＋8，同 holdingsTaipeiDate）：上游給的是 UTC 時間，台北早上 8 點前算的會差一天
const computedDate = computed(() => (data.value?.computedAt ? new Date(Date.parse(data.value.computedAt) + 8 * 3600_000).toISOString().slice(0, 10) : null))

const leadAnswer = computed(() => {
  const d = data.value
  const first = rows.value[0]
  const last = rows.value.at(-1)
  if (!d || !first || !last) return null
  const span = d.window ? `以 ${monthText(d.window.from)}到 ${monthText(d.window.to)}計，` : ''
  const index = d.taiex === null ? '' : `加權指數的 12 個月報酬多 ${slope(d.taiex)} 個百分點；`
  return `${span}國家發展委員會景氣同時指標的年增率每多 1 個百分點，${index}${rows.value.length} 個類股的中位數從${nameOf(first)}的 ${slope(first.median)} 到${nameOf(last)}的 ${slope(last.median)}。`
})

const COLUMNS: SortableColumn<Row>[] = [
  { key: 'sector', label: '類股', sortValue: row => row.sectorCode },
  { key: 'rank', label: '名次', num: true, sortValue: row => row.rank },
  { key: 'count', label: '家數', num: true, sortValue: row => row.count },
  { key: 'median', label: '中位數', num: true, sortValue: row => row.median },
  { key: 'q1', label: '25%', num: true, sortValue: row => row.q1 },
  { key: 'q3', label: '75%', num: true, sortValue: row => row.q3 }
]

const isDesktop = useIsDesktop()
const { resolvedMode, color: accentColorName } = useAppTheme()
// 一列一個類股；ECharts 的類別軸由下往上排，反過來才是名次 1 在最上面。
// 手機另一種排法（2026-10-24，使用者：「電腦這樣排可以，手機請另外想辦法」）：名稱在左邊會吃掉一大半寬度、圖只剩約 120px，改成名稱與
// 中位數寫在框的上方、框用滿整個寬度。圖的高度跟著換（CSS 的 .industries-sensitivity__chart），不在渲染時判斷寬度
const ordered = computed(() => [...rows.value].reverse())
const chartOption = computed(() => {
  const ink = getChartInk(resolvedMode.value)
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  const taiex = data.value?.taiex ?? null
  const mobile = !isDesktop.value
  return {
    grid: mobile ? { left: 8, right: 16, top: 36, bottom: 48 } : { left: 8, right: 24, top: 32, bottom: 32, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (param: { dataIndex: number }) => {
        const row = ordered.value[param.dataIndex]
        if (!row) return ''
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${nameOf(row)}（${row.count} 家）</div>`
          + `<div>中位數：${slope(row.median)}</div><div>25%～75%：${slope(row.q1)}～${slope(row.q3)}</div></div>`
      }
    },
    xAxis: { type: 'value', name: '景氣敏感度', nameLocation: 'middle', nameGap: 28, splitNumber: isDesktop.value ? 6 : 3, axisLabel: { hideOverlap: true } },
    yAxis: {
      type: 'category',
      data: ordered.value.map(row => (row.count < FEW ? `${nameOf(row)}（${row.count} 家）` : nameOf(row))),
      axisTick: { show: false },
      // interval 0：每一列都要有名字，不讓 ECharts 嫌擠自己跳過
      axisLabel: mobile
        ? { interval: 0, inside: true, align: 'left', verticalAlign: 'bottom', padding: [0, 0, 8, 0], color: ink.primary, formatter: (name: string, index: number) => `${name}　${slope(ordered.value[index]?.median ?? 0)}` }
        : { interval: 0, color: ink.primary }
    },
    series: [{
      type: 'boxplot',
      boxWidth: mobile ? [6, 10] : [8, 14],
      itemStyle: { color: 'transparent', borderColor: accent, borderWidth: 2 },
      data: ordered.value.map(row => ({
        value: [row.q1, row.q1, row.median, row.q3, row.q3],
        ...(row.count < FEW ? { itemStyle: { borderColor: ink.muted, borderType: 'dashed' } } : {})
      })),
      // 0 與加權指數兩條參考線（同一個中性墨色、虛線），加權指數那條寫數字
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: ink.baseline, type: 'dashed' },
        data: [
          { xAxis: 0, label: { show: false } },
          ...(taiex === null ? [] : [{ xAxis: taiex, label: { show: true, position: 'end', color: ink.primary, fontSize: 16, formatter: `加權指數 ${slope(taiex)}` } }])
        ]
      }
    }]
  }
})
</script>

<template>
  <div class="app-page app-page--compact industries-page">
    <h1 class="app-page__title industries-page__title">台股類股景氣敏感度</h1>
    <IndustryNav />

    <section class="stock-page-section" aria-labelledby="industries-sensitivity-heading">
      <h2 id="industries-sensitivity-heading" class="stock-page-section__title">哪些類股的股價跟著景氣起伏最多？</h2>
      <p v-if="leadAnswer" class="hub-answer">{{ leadAnswer }}</p>
      <p v-else class="hub-answer">景氣敏感度還沒有計算結果。</p>
      <el-card v-if="rows.length" shadow="never" class="industries-page__card">
        <SharedChart
          class="app-chart industries-sensitivity__chart"
          :style="{ '--rows': rows.length }"
          :option="chartOption"
          autoresize
          aria-label="各類股景氣敏感度的中位數與 25% 到 75% 範圍，依名次由上往下排列，虛線是 0 與加權指數"
        />
      </el-card>
      <SharedSortableTable
        v-if="rows.length"
        :rows="rows"
        :columns="COLUMNS"
        :row-key="row => row.sectorCode"
        label="各證交所類股的景氣敏感度"
        caption="各類股景氣敏感度的中位數與四分位，依名次排列"
      >
        <template #row="{ row }">
          <th scope="row"><NuxtLink :to="sectorPath(row.sectorCode) ?? '/industries'">{{ nameOf(row) }}</NuxtLink></th>
          <td class="seo-table__num">{{ row.rank }}</td>
          <td class="seo-table__num">{{ row.count }}</td>
          <td class="seo-table__num">{{ slope(row.median) }}</td>
          <td class="seo-table__num">{{ slope(row.q1) }}</td>
          <td class="seo-table__num">{{ slope(row.q3) }}</td>
        </template>
      </SharedSortableTable>
    </section>

    <section v-if="data && rows.length" class="stock-page-section" aria-labelledby="industries-sensitivity-notes-heading">
      <h2 id="industries-sensitivity-notes-heading" class="stock-page-section__title">這個數字怎麼算？看的時候要注意什麼？</h2>
      <ul class="industries-page__notes">
        <li>每一家公司把每個月的股價 12 個月報酬，對國家發展委員會景氣同時指標的年增率做迴歸，斜率就是那一家的景氣敏感度：同時指標年增率每多 1 個百分點，股價報酬多幾個百分點。類股的數字是類股內公司的中位數，以及 25%、75% 的位置。</li>
        <li>股價通常比同時指標早約 {{ data.leadMonths }} 個月反映，所以兩者錯開 {{ data.leadMonths }} 個月對齊。每家公司至少要有 {{ data.minMonths }} 個月的資料才算進去，共 {{ groupThousands(data.companyCount) }} 家。</li>
        <li>只提供類股、不提供個股：單一公司的股價受景氣以外的因素影響太多，景氣能解釋的部分很小。</li>
        <li>數字大小會跟著這段期間景氣起伏的幅度變，適合看類股之間的高低順序，不適合拿來跟其他期間的數字比。</li>
        <li>家數少的類股，一兩家公司就會左右中位數；圖上以灰色虛線框表示，名稱後面寫家數。</li>
        <li>景氣同時指標的構成項目偏重製造業與出口，所以這個數字量到的是跟出口製造業景氣同步的程度。觀光事業是負的，主要來自疫情期間。</li>
        <li>營收跟著景氣起落的程度，在<NuxtLink to="/industries/cycle" class="hub-inline-link">營收與景氣</NuxtLink>那一頁。</li>
      </ul>
      <p class="hub-answer hub-sources industries-page__sources">
        資料來源：臺灣證券交易所、證券櫃檯買賣中心每日收盤價，國家發展委員會景氣指標<template v-if="data.coincidentIndexMonth">（同時指標到 {{ monthText(data.coincidentIndexMonth) }}）</template>。<template v-if="computedDate">計算日期 {{ computedDate }}。</template>
      </p>
    </section>
  </div>
</template>

<style scoped>
.industries-page__title {
  font-weight: 600;
}

/* 一列一個類股。手機名稱寫在框的上方，每列要高一點；用 CSS 依寬度切換，伺服器與瀏覽器的第一個畫面才一樣高（斷點同 useIsDesktop） */
.industries-sensitivity__chart {
  height: calc(var(--rows) * 40px + 84px);
}

@media (min-width: 768px) {
  .industries-sensitivity__chart {
    height: calc(var(--rows) * 26px + 72px);
  }
}

.industries-page__notes {
  margin: 0;
  padding-left: 1.2em;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}
</style>
