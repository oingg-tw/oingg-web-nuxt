<script setup lang="ts">
import type { ExDividendKind, ExDividendMonthCell, ExDividendMonthsPageData, ExDividendRow } from '#shared/types/hub'

// 除權息月覽（2026-10-21，使用者：「我希望有圖表或是表格可以呈現該月份的所有除權息標的，跟原本的calendar不一樣或許是用熱力圖呈現，畢竟大家都知道
// 除權息有旺季，但是新手不知道。設計成sidebar的另外一個項目」）。提案選了「年 × 月」熱力表，第 2 版改成只畫今年（「移除歷年資料 我只需要今年的 還有
// 今年日期未到的才用去年模擬試算」），再加特別股。上面 12 格答「今年哪幾個月最多」，格子裡寫檔數、每一格是那個月清單的連結（?month=，canonical
// 不帶參數）；下面列出那個月的全部標的，依日期分組、不截斷（配息月曆一天一格，7 月一天上百檔只放得下「+N」）。
const route = useRoute()
const month = computed(() => (typeof route.query.month === 'string' ? route.query.month : undefined))
const { data, error } = await useFetch<ExDividendMonthsPageData>('/api/hub/ex-dividend-months', { key: 'hub-ex-dividend-months', query: { month } })
if (error.value || !data.value) throw createError({ statusCode: 503, statusMessage: '除權息資料暫時無法取得', fatal: true })

const year = computed(() => data.value!.year)
const { breadcrumbs } = useHubPageSeo({
  title: () => `除權息月覽：${year.value} 年每個月有幾檔除權息`,
  description: () => `${year.value} 年台股每個月有幾檔除權息：熱力表看出旺季在哪幾個月，點月份列出當月全部除權息的股票、ETF 與特別股，含現金股利、配股與發放日。`,
  path: '/calendar/months',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '除權息月覽', to: '/calendar/months' }
  ]
})

const KIND_LABEL: Record<ExDividendKind, string> = { common: '個股', etf: 'ETF', preferred: '特別股' }
const KINDS = [['all', '全部'], ...Object.entries(KIND_LABEL)] as ['all' | ExDividendKind, string][]
const kind = ref<'all' | ExDividendKind>('all')
// 放進句子裡的名稱：英文字前後空一格（「檔 ETF 除權息」）
const kindWord = computed(() => (kind.value === 'all' ? '' : kind.value === 'etf' ? ' ETF ' : KIND_LABEL[kind.value]))

const monthNumber = (key: string) => Number(key.slice(5))
const cells = computed(() => data.value!.cells)
const countOf = (cell: ExDividendMonthCell) => cell.counts[kind.value]
const estimatedMonths = computed(() => cells.value.filter(cell => cell.estimated).map(cell => monthNumber(cell.month)))

// 顏色是這一組裡最多那個月的幾分之幾（五階）：檔數寫在格子裡，顏色只幫忙一眼看出哪幾個月多。特別股一個月只有幾檔，固定級距會整排同色
const maxCount = computed(() => Math.max(...cells.value.map(countOf)))
const step = (count: number) => (count === 0 ? 0 : Math.ceil((count / maxCount.value) * 5))

const seasonAnswer = computed(() => {
  const counts = cells.value.map(countOf)
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (!total) return `今年沒有${kindWord.value}除權息。`
  const note = estimatedMonths.value.length ? `（${estimatedMonths.value.join('、')} 月還沒到，用去年同月試算）` : ''
  const max = Math.max(...counts)
  const min = Math.min(...counts)
  // 最多的月份不到最少的兩倍就是每個月差不多（ETF 2026 年每月 76～115 檔），不說哪個月最多
  if (min > 0 && max < min * 2) return `${kindWord.value.trimStart()}每個月都有除權息，今年每月 ${min}～${max} 檔，沒有明顯的旺季${note}。`
  const share = Math.round(((counts[5]! + counts[6]! + counts[7]! + counts[8]!) / total) * 100)
  return `今年 ${counts.indexOf(max) + 1} 月有 ${max} 檔${kindWord.value}除權息，是一年中最多的月份；6～9 月占全年的 ${share}%${note}。`
})

const selected = computed(() => cells.value.find(cell => cell.month === data.value!.month)!)
const rows = computed(() => data.value!.rows.filter(row => kind.value === 'all' || row.kind === kind.value))
const days = computed(() => {
  const groups = new Map<string, ExDividendRow[]>()
  for (const row of rows.value) (groups.get(row.exDate) ?? groups.set(row.exDate, []).get(row.exDate)!).push(row)
  return [...groups].map(([date, list]) => ({ date, rows: list, count: new Set(list.map(row => row.symbol)).size }))
})

const WEEKDAYS = '日一二三四五六'
// 試算月份的日期是去年的那一天
const dayLabel = (date: string) => `${selected.value.estimated ? '去年 ' : ''}${Number(date.slice(5, 7))}/${Number(date.slice(8))}（${WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]}）`

const monthAnswer = computed(() => {
  const cell = selected.value
  const m = monthNumber(cell.month)
  const lead = cell.estimated ? `${m} 月還沒到，下面用 ${cell.source.slice(0, 4)} 年 ${m} 月試算：` : ''
  const total = cell.counts[kind.value]
  if (!total) return `${lead}${cell.estimated ? '去年這個月' : '這個月'}沒有${kindWord.value}除權息。`
  const other = cell.counts.all - cell.counts.common - cell.counts.etf - cell.counts.preferred
  const parts = (Object.keys(KIND_LABEL) as ExDividendKind[]).filter(key => cell.counts[key]).map(key => `${KIND_LABEL[key]} ${cell.counts[key]}`)
  const split = kind.value === 'all' ? `（${[...parts, ...(other ? [`其他 ${other}`] : [])].join('、')}）` : ''
  const busiest = days.value.reduce((top, day) => (day.count > top.count ? day : top))
  const announced = cell.estimated ? 0 : rows.value.filter(row => row.announced).length
  return `${lead}共 ${total} 檔${split}，${cell.estimated ? '去年 ' : ''}${m} 月 ${Number(busiest.date.slice(8))} 日最多，有 ${busiest.count} 檔。${announced ? `其中 ${announced} 筆還沒除息（公司預告）。` : ''}`
})

const cashText = (cash: number) => String(Number(cash.toFixed(4)))
const stockText = (row: ExDividendRow) => (row.stockPerShare ? `每千股 ${Number((row.stockPerShare * 1000).toFixed(2))} 股` : row.rightsOffering ? '現金增資' : '－')
</script>

<template>
  <div class="app-page ex-months">
    <h1 class="app-page__title">除權息月覽</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <CalendarNav />

    <StockQuestionSection id="ex-months-season" question="今年哪幾個月除權息最多？" :answer="seasonAnswer">
      <el-radio-group v-model="kind" aria-label="標的種類">
        <el-radio-button v-for="[value, label] in KINDS" :key="value" :value="value">{{ label }}</el-radio-button>
      </el-radio-group>
      <ol class="ex-heat" :aria-label="`${year} 年每個月有幾檔${kindWord}除權息`">
        <li v-for="cell in cells" :key="cell.month">
          <NuxtLink v-slot="{ href, navigate }" :to="{ query: { month: cell.month } }" custom>
            <a :href="href ?? undefined" class="ex-heat__link" :aria-current="cell.month === data!.month ? 'true' : undefined" @click="navigate">
              <span class="ex-heat__month">{{ monthNumber(cell.month) }}月</span>
              <span class="ex-heat__cell" :class="[`ex-heat__cell--${step(countOf(cell))}`, { 'is-estimated': cell.estimated }]">
                {{ countOf(cell) }}<span v-if="cell.estimated" aria-hidden="true">估</span>
              </span>
              <span class="visually-hidden"> 檔{{ cell.estimated ? `，還沒到，用 ${cell.source.slice(0, 4)} 年同月試算` : '' }}</span>
            </a>
          </NuxtLink>
        </li>
      </ol>
      <p class="ex-heat__legend">
        <span>單位：檔</span>
        <span class="ex-heat__scale" aria-hidden="true">少<i v-for="n in 5" :key="n" :class="`ex-heat__cell--${n}`" />多</span>
        <span v-if="estimatedMonths.length"><i class="ex-heat__swatch is-estimated" aria-hidden="true" />估：還沒到，用去年同月試算</span>
      </p>
    </StockQuestionSection>

    <StockQuestionSection id="ex-months-list" :question="`${year} 年 ${monthNumber(selected.month)} 月有哪些除權息？`" :answer="monthAnswer">
      <table v-if="rows.length" class="seo-table ex-month-table" data-ssr-table>
        <caption class="visually-hidden">{{ year }} 年 {{ monthNumber(selected.month) }} 月的除權息，依除權息日分組</caption>
        <thead>
          <tr>
            <th scope="col">代號 名稱</th>
            <th scope="col">類型</th>
            <th scope="col" class="seo-table__num">現金股利（元）</th>
            <th scope="col">配股</th>
            <th scope="col">現金發放日</th>
          </tr>
        </thead>
        <tbody v-for="day in days" :key="day.date">
          <tr class="ex-month-table__day">
            <th colspan="5" scope="colgroup">{{ dayLabel(day.date) }}　{{ day.count }} 檔</th>
          </tr>
          <tr v-for="row in day.rows" :key="`${row.symbol}-${row.exType}`">
            <td class="ex-month-table__name">
              <NuxtLink v-if="row.kind" :to="securityPath(row.symbol)" class="seo-table__link">{{ row.name }}</NuxtLink>
              <template v-else>{{ row.name }}</template>
              <span class="ex-month-table__code">{{ row.symbol }}</span>
            </td>
            <td>{{ row.exType }}<el-tag v-if="row.announced" size="small" effect="plain" class="ex-month-table__tag">預告</el-tag></td>
            <td class="seo-table__num" :class="{ 'is-empty': row.cash === null }">
              <template v-if="row.cash !== null">{{ cashText(row.cash) }}<span class="ex-month-table__unit"> 元</span></template>
              <template v-else>－</template>
            </td>
            <td :class="{ 'is-empty': !row.stockPerShare && !row.rightsOffering }">{{ stockText(row) }}</td>
            <td class="ex-month-table__paid">{{ row.paymentDate ? row.paymentDate.slice(5).replace('-', '/') : '－' }}</td>
          </tr>
        </tbody>
      </table>
    </StockQuestionSection>

    <section class="stock-page-section" aria-labelledby="ex-months-notes-heading">
      <h2 id="ex-months-notes-heading" class="stock-page-section__title">這些數字怎麼來的？</h2>
      <ul class="ex-months__notes">
        <li>上市櫃公司的股東常會多在 5、6 月召開，通過配息之後才訂除權息日，所以除權息集中在夏天；季配、月配的公司與 ETF 則分散在各月。</li>
        <li>檔數是那個月有除權息（除息、除權或兩者）的不重複代號數，包含已經公告、還沒除息的。</li>
        <li v-if="estimatedMonths.length">{{ estimatedMonths.join('、') }} 月還沒到，用 {{ year - 1 }} 年同月的檔數與名單試算；到了那個月就換成今年的資料。</li>
      </ul>
      <p class="hub-answer hub-sources">資料來源：臺灣證券交易所、證券櫃檯買賣中心的除權息預告，公開資訊觀測站的股利分派公告，以及投信投顧公會的 ETF 收益分配。</p>
    </section>
  </div>
</template>

<style scoped>
/* 熱力表：寬螢幕一列 12 格、手機一個月一列。底色是主題色混進卡片底色的五階；格子裡的字在七種主題色、淺深兩種模式都過 4.5:1
  （淺色 12／25／40／60% 深字、100% 白字；深色 12／25／40% 淺字、75%／100% 深字） */
.ex-heat,
.ex-heat__legend {
  --ex-heat-4: 60%;
  --ex-heat-ink-4: var(--el-text-color-primary);
  --ex-heat-ink-5: #fff;
}

.ex-heat {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 6px;
  margin: 16px 0 8px;
  padding: 0;
  list-style: none;
}

html.dark .ex-heat,
html.dark .ex-heat__legend {
  --ex-heat-4: 75%;
  --ex-heat-ink-4: #1a1a1a;
  --ex-heat-ink-5: #1a1a1a;
}

.ex-heat__link {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: stretch;
  text-align: center;
  color: var(--el-text-color-regular);
  text-decoration: none;
  border-radius: 8px;
}

.ex-heat__link:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.ex-heat__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 48px;
  border-radius: 6px;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}

.ex-heat__link[aria-current='true'] .ex-heat__cell {
  outline: 3px solid var(--el-text-color-primary);
  outline-offset: 2px;
  font-weight: 700;
}

.ex-heat__link:hover .ex-heat__cell {
  text-decoration: underline;
}

.ex-heat__cell--0 {
  color: var(--el-text-color-secondary);
  box-shadow: inset 0 0 0 1px var(--el-border-color-lighter);
}

.ex-heat__cell--1 { background: color-mix(in srgb, var(--el-color-primary) 12%, var(--el-bg-color)); }
.ex-heat__cell--2 { background: color-mix(in srgb, var(--el-color-primary) 25%, var(--el-bg-color)); }
.ex-heat__cell--3 { background: color-mix(in srgb, var(--el-color-primary) 40%, var(--el-bg-color)); }
.ex-heat__cell--4 { background: color-mix(in srgb, var(--el-color-primary) var(--ex-heat-4), var(--el-bg-color)); color: var(--ex-heat-ink-4); }
.ex-heat__cell--5 { background: var(--el-color-primary); color: var(--ex-heat-ink-5); }

/* 試算的月份：虛線框＋「估」，不只靠顏色 */
.ex-heat__cell.is-estimated,
.ex-heat__swatch.is-estimated {
  border: 2px dashed var(--el-text-color-primary);
}

.ex-heat__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  align-items: center;
  margin: 0;
  color: var(--el-text-color-secondary);
}

.ex-heat__scale {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.ex-heat__scale i,
.ex-heat__swatch {
  display: inline-block;
  width: 20px;
  height: 14px;
  border-radius: 3px;
  vertical-align: middle;
}

.ex-heat__swatch {
  margin-right: 6px;
}

.ex-month-table {
  width: 100%;
  margin-top: 16px;
}

.ex-month-table__day th {
  background: var(--el-fill-color-light);
  font-weight: 600;
}

.ex-month-table__code {
  margin-left: 6px;
  color: var(--el-text-color-secondary);
}

.ex-month-table__tag {
  margin-left: 6px;
}

/* 寬螢幕的表頭已經寫「（元）」 */
.ex-month-table__unit {
  display: none;
}

.ex-months__notes {
  margin: 0;
  padding-left: 1.2em;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--el-text-color-regular);
}

/* 手機：熱力表一個月一列；清單每一列是「名稱｜類型 金額」，空的欄與發放日不顯示 */
@media (max-width: 767px) {
  .ex-heat {
    grid-template-columns: 1fr;
  }

  .ex-heat__link {
    flex-direction: row;
    align-items: center;
  }

  .ex-heat__month {
    width: 3em;
    text-align: right;
  }

  .ex-heat__cell {
    width: min(200px, 100%);
    height: 40px;
  }

  .ex-month-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  /* 名稱太長就在自己那一格換行，類型與金額留在右邊 */
  .ex-month-table tr {
    display: flex;
    gap: 12px;
    align-items: baseline;
  }

  .ex-month-table__day th {
    flex: 1 1 100%;
  }

  .ex-month-table td {
    border: 0;
  }

  .ex-month-table tbody tr:not(.ex-month-table__day) {
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .ex-month-table__name {
    flex: 1 1 auto;
    min-width: 0;
    white-space: normal;
  }

  .ex-month-table td.is-empty,
  .ex-month-table__paid {
    display: none;
  }

  .ex-month-table__unit {
    display: inline;
  }

  /* 金額欄固定寬、靠右，各列的「息」對齊 */
  .ex-month-table td.seo-table__num {
    min-width: 6em;
    text-align: right;
  }
}
</style>
