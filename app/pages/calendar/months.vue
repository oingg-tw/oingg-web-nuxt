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
const groupByDay = (list: ExDividendRow[]) => {
  const groups = new Map<string, ExDividendRow[]>()
  for (const row of list) (groups.get(row.exDate) ?? groups.set(row.exDate, []).get(row.exDate)!).push(row)
  return [...groups].map(([date, rowsOfDay]) => ({ date, rows: rowsOfDay, count: new Set(rowsOfDay.map(row => row.symbol)).size }))
}
const days = computed(() => groupByDay(rows.value))

// 在這個月找代號或名稱（2026-11-02，手機方案 A＋B 的搜尋）：7 月 805 檔，原本要一天一天打開才找得到某一檔。符合的日子全部展開；
// 答句與最多的那一天照舊用整個月算
const query = ref('')
const needle = computed(() => searchKey(query.value))
const shownDays = computed(() => (needle.value
  ? groupByDay(rows.value.filter(row => searchKey(row.symbol).includes(needle.value) || searchKey(row.name).includes(needle.value)))
  : days.value))
const searchResult = computed(() => {
  if (!needle.value) return ''
  const count = new Set(shownDays.value.flatMap(day => day.rows.map(row => row.symbol))).size
  const m = monthNumber(selected.value.month)
  return count ? `${m} 月有 ${count} 檔符合「${query.value.trim()}」，在 ${shownDays.value.length} 天。` : `${m} 月沒有符合「${query.value.trim()}」的標的。`
})

// 手機的切換列（2026-11-02，方案 A）：月份橫向捲動，換月時把目前的月份捲到中間，不然 7 月以後一開始看不到
const monthStrip = ref<HTMLElement | null>(null)
function centerCurrentMonth() {
  const strip = monthStrip.value
  const current = strip?.querySelector<HTMLElement>('[aria-current="true"]')
  if (strip && current) strip.scrollLeft = current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2
}
onMounted(centerCurrentMonth)
watch(() => data.value?.month, () => nextTick(centerCurrentMonth))

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

// 每一天收成一列（2026-10-21，使用者：「6 7 月的持股數量非常多 所以底下勢必不可以單純 全部列出來」，選了這個做法）：摘要寫日期、
// 檔數、前三檔的名字，點開才是那一天的表。7 月 805 檔變成 23 列；<details> 的內容照舊在伺服器 HTML 裡，爬蟲與螢幕閱讀器都讀得到
const PREVIEW_NAMES = 3
const previewOf = (rowsOfDay: ExDividendRow[]) => {
  const names = [...new Set(rowsOfDay.map(row => row.name))]
  return `${names.slice(0, PREVIEW_NAMES).join('、')}${names.length > PREVIEW_NAMES ? ' 等' : ''}`
}

// 到篩選器打開這個月除權息的標的、再加其他條件（2026-10-22，使用者：「或許是 帶去 股票篩選作為條件? 那麼是不是就要先建立 對應的指標?」
// → analysis-ts 617ba6bb 的「除權息月份」，還沒到的月份同樣看去年同月）。跟著上面的種類切換，那個月沒有的種類不給連結（點進去是 0 檔；
// 使用者 2026-10-22 問過 10 月為什麼沒有特別股，聽完確認維持隱藏）
const SCREENER_LABEL: Record<ExDividendKind, string> = { common: '普通股', etf: 'ETF', preferred: '特別股' }
const screenerLinks = computed(() => (Object.keys(SCREENER_LABEL) as ExDividendKind[])
  .filter(key => (kind.value === 'all' || kind.value === key) && selected.value.counts[key])
  .map(key => ({ key, label: SCREENER_LABEL[key], to: exDividendMonthScreenerPath(key, monthNumber(selected.value.month)) })))

const cashText = (cash: number) => String(Number(cash.toFixed(4)))
const stockText = (row: ExDividendRow) => (row.stockPerShare ? `每千股 ${Number((row.stockPerShare * 1000).toFixed(2))} 股` : row.rightsOffering ? '現金增資' : '－')
</script>

<template>
  <div class="app-page ex-months">
    <h1 class="app-page__title">除權息月覽</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <CalendarNav />

    <StockQuestionSection id="ex-months-season" question="今年哪幾個月除權息最多？" :answer="seasonAnswer">
      <el-radio-group v-model="kind" class="ex-months__kinds" aria-label="標的種類">
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

    <!-- 手機才有：往下滑時黏在頁首下面，滑到清單哪裡都能換種類、換月；換月跳回清單開頭（#ex-months-list） -->
    <div class="ex-bar app-sticky-bar">
      <label class="ex-bar__kind">
        <span class="visually-hidden">標的種類</span>
        <select v-model="kind" class="app-select">
          <option v-for="[value, label] in KINDS" :key="value" :value="value">{{ label }}</option>
        </select>
      </label>
      <nav ref="monthStrip" class="ex-bar__months" aria-label="月份">
        <template v-for="cell in cells" :key="cell.month">
          <NuxtLink v-slot="{ href, navigate }" :to="{ query: { month: cell.month }, hash: '#ex-months-list' }" custom>
            <a :href="href ?? undefined" class="ex-bar__month" :class="[`ex-heat__cell--${step(countOf(cell))}`, { 'is-estimated': cell.estimated }]" :aria-current="cell.month === data!.month ? 'true' : undefined" @click="navigate">
              {{ monthNumber(cell.month) }}月 {{ countOf(cell) }}<span v-if="cell.estimated" aria-hidden="true">估</span><span class="visually-hidden"> 檔{{ cell.estimated ? '，用去年同月試算' : '' }}</span>
            </a>
          </NuxtLink>
        </template>
      </nav>
    </div>

    <StockQuestionSection id="ex-months-list" :question="`${year} 年 ${monthNumber(selected.month)} 月有哪些除權息？`" :answer="monthAnswer">
      <p v-if="screenerLinks.length" class="hub-answer">
        在篩選器打開這個月除權息的標的，再加其他條件：<template v-for="(link, index) in screenerLinks" :key="link.key">{{ index ? '、' : '' }}<NuxtLink :to="link.to" class="hub-inline-link">{{ link.label }}</NuxtLink></template>。
      </p>
      <div v-if="rows.length" class="ex-search">
        <label class="ex-search__field">
          <span class="visually-hidden">在 {{ monthNumber(selected.month) }} 月的除權息裡找代號或名稱</span>
          <input v-model="query" type="search" class="ex-search__input" placeholder="找代號或名稱，例如 2330、台積" autocomplete="off" enterkeyhint="search">
        </label>
        <button v-if="query" type="button" class="ex-search__clear" @click="query = ''">清除</button>
      </div>
      <p class="ex-search__result" role="status">{{ searchResult }}</p>
      <ul v-if="shownDays.length" class="ex-days">
        <li v-for="day in shownDays" :key="day.date">
          <details class="app-disclosure ex-day" :open="!!needle">
            <summary>
              <span class="ex-day__date">{{ dayLabel(day.date) }}</span>
              <span class="ex-day__count">{{ day.count }} 檔</span>
              <span class="ex-day__preview">{{ previewOf(day.rows) }}</span>
            </summary>
            <SharedTable :label="`${dayLabel(day.date)}的除權息`" table-class="ex-month-table" class="ex-month-table__card">
              <thead>
                <tr>
                  <th scope="col">代號 名稱</th>
                  <th scope="col">類型</th>
                  <th scope="col" class="seo-table__num">現金股利（元）</th>
                  <th scope="col">配股</th>
                  <th scope="col">現金發放日</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in day.rows" :key="`${row.symbol}-${row.exType}`">
                  <td class="ex-month-table__name">
                    <NuxtLink v-if="row.kind" :to="securityPath(row.symbol)" class="seo-table__link">{{ row.name }}</NuxtLink>
                    <template v-else>{{ row.name }}</template>
                    <span class="ex-month-table__code">{{ row.symbol }}</span>
                  </td>
                  <td class="ex-month-table__meta">{{ row.exType }}<el-tag v-if="row.announced" size="small" effect="plain" class="ex-month-table__tag">預告</el-tag></td>
                  <td class="seo-table__num" :class="{ 'is-empty': row.cash === null }">
                    <template v-if="row.cash !== null">{{ cashText(row.cash) }}<span class="ex-month-table__unit"> 元</span></template>
                    <template v-else>－</template>
                  </td>
                  <td class="ex-month-table__meta" :class="{ 'is-empty': !row.stockPerShare && !row.rightsOffering }"><span v-if="row.stockPerShare" class="ex-month-table__label">配股 </span>{{ stockText(row) }}</td>
                  <td class="ex-month-table__meta" :class="{ 'is-empty': !row.paymentDate }"><span v-if="row.paymentDate" class="ex-month-table__label">發放 </span>{{ row.paymentDate ? row.paymentDate.slice(5).replace('-', '/') : '－' }}</td>
                </tr>
              </tbody>
            </SharedTable>
          </details>
        </li>
      </ul>
    </StockQuestionSection>

    <section class="stock-page-section" aria-labelledby="ex-months-notes-heading">
      <h2 id="ex-months-notes-heading" class="stock-page-section__title">這些數字怎麼來的？</h2>
      <ul class="ex-months__notes">
        <li>上市櫃公司的股東常會多在 5、6 月召開，通過配息之後才訂除權息日，所以除權息集中在夏天；季配、月配的公司與 ETF 則分散在各月。</li>
        <li>檔數是那個月有除權息（除息、除權或兩者）的不重複代號數，包含已經公告、還沒除息的。</li>
        <li v-if="estimatedMonths.length">{{ estimatedMonths.join('、') }} 月還沒到，用 {{ year - 1 }} 年同月的檔數與名單試算；到了那個月就換成今年的資料。</li>
        <li>篩選器的「除權息月份」用同樣的算法，但只含現在還在交易的標的：已下市、已收回的不算，檔數可能比這裡少一兩檔。</li>
      </ul>
      <p class="hub-answer hub-sources">資料來源：臺灣證券交易所、證券櫃檯買賣中心的除權息預告，公開資訊觀測站的股利分派公告，以及投信投顧公會的 ETF 收益分配。</p>
    </section>
  </div>
</template>

<style scoped>
/* 熱力表：寬螢幕一列 12 格、手機一個月一列。底色是主題色混進卡片底色的五階；格子裡的字在七種主題色、淺深兩種模式都過 4.5:1
  （淺色 12／25／40／60% 深字、100% 白字；深色 12／25／40% 淺字、75%／100% 深字） */
.ex-heat,
.ex-heat__legend,
.ex-bar {
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
html.dark .ex-heat__legend,
html.dark .ex-bar {
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
.ex-heat__swatch.is-estimated,
.ex-bar__month.is-estimated {
  border: 2px dashed var(--el-text-color-primary);
}

/* 手機的切換列（顯示在下面的手機媒體查詢裡）：種類＋月份，月份是熱力表同色的圓角鈕，橫向捲動 */
.ex-bar {
  display: none;
}

.ex-bar__kind {
  flex: none;
}

.ex-bar__months {
  position: relative;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  /* 上下 2px 留給焦點框，右邊 16px 讓最後一顆不貼邊 */
  padding: 2px 16px 2px 2px;
  scrollbar-width: none;
}

.ex-bar__month {
  flex: none;
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 22px;
  text-decoration: none;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* 字色放在 :where() 裡（權重 0）：要讓位給熱力五階的字色（第 4、5 階是深字／白字），寫在 .ex-bar__month 會蓋掉它們（axe 2.53:1） */
:where(.ex-bar__month) {
  color: var(--el-text-color-primary);
}

.ex-bar__month[aria-current='true'] {
  font-weight: 700;
  box-shadow: inset 0 0 0 2px var(--el-text-color-primary), inset 0 0 0 4px var(--el-bg-color);
}

.ex-bar__month:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 0;
}

/* 搜尋框：跟 .app-select 同一個框（44px、內框線） */
.ex-search {
  display: flex;
  gap: 8px;
  align-items: center;
  max-width: 420px;
  margin-top: 16px;
}

.ex-search__field {
  flex: 1 1 auto;
  min-width: 0;
}

.ex-search__input {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-blank);
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
  color: var(--el-text-color-primary);
  font: inherit;
}

.ex-search__input::placeholder {
  color: var(--el-text-color-placeholder);
}

/* 瀏覽器自帶的 ×：旁邊已經有 44px 的「清除」 */
.ex-search__input::-webkit-search-cancel-button {
  display: none;
}

.ex-search__input:hover {
  box-shadow: 0 0 0 1px var(--el-border-color-hover) inset;
}

.ex-search__input:focus-visible,
.ex-search__clear:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.ex-search__clear {
  flex: none;
  min-width: 44px;
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: var(--el-color-primary);
  font: inherit;
  cursor: pointer;
}

/* 一直留在畫面上（role="status" 要先在才唸得出來），沒在搜尋時是空的、不佔高度 */
.ex-search__result {
  margin: 8px 0 0;
  color: var(--el-text-color-regular);
}

.ex-search__result:empty {
  margin: 0;
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

/* 每一天一列：上下一條線分開；摘要是 箭頭｜日期｜檔數｜前三檔，名字放不下就省略，窄螢幕換到下一行 */
/* 分隔線用全站表格那一條淡的（--app-divider，2026-10-23）；展開的那一天是全站表格的卡片（SharedTable） */
.ex-days {
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--app-divider);
}

.ex-days > li {
  border-bottom: 1px solid var(--app-divider);
}

.ex-day > summary {
  flex-wrap: wrap;
  column-gap: 12px;
  row-gap: 2px;
  font-variant-numeric: tabular-nums;
}

.ex-day__date {
  min-width: 7.5em;
}

.ex-day__count {
  min-width: 4em;
  font-weight: 400;
}

.ex-day__preview {
  flex: 1 1 12em;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.ex-month-table__card {
  margin: 0 0 12px;
}

/* 窄螢幕：名字固定在第二行，跟日期對齊（箭頭 13px＋間距 12px） */
@media (max-width: 767px) {
  .ex-day__preview {
    flex-basis: 100%;
    padding-left: 25px;
  }
}

.ex-month-table__code {
  margin-left: 6px;
  color: var(--el-text-color-secondary);
}

.ex-month-table__tag {
  margin-left: 6px;
}

/* 寬螢幕的表頭已經寫「（元）」「配股」「現金發放日」 */
.ex-month-table__unit,
.ex-month-table__label {
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

/* 手機（2026-11-02，方案 A）：熱力表 6×2（原本一個月一列，約 600px 高，清單要滑過一個半畫面才開始）；種類搬進黏著的切換列；
   清單每一檔兩行 */
@media (max-width: 767px) {
  .ex-heat {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    row-gap: 8px;
  }

  .ex-heat__cell {
    height: 44px;
  }

  /* 「120估」在 320px 寬的格子裡會碰到虛線框 */
  .ex-heat__cell > span {
    font-size: 0.75em;
  }

  .ex-months__kinds {
    display: none;
  }

  /* 右邊不留內距：月份鈕捲到畫面邊緣 */
  .ex-bar {
    display: flex;
    gap: 8px;
    align-items: center;
    padding-right: 0;
  }

  /* 從切換列換月會跳到這裡：讓開頁首與切換列 */
  #ex-months-list {
    scroll-margin-top: calc(var(--app-header-height) + var(--app-banner-height) + 64px);
  }

  .ex-month-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  /* table 與 tbody 也改成 block：只把 tr 改成 flex 的話，列被包進匿名的表格格子、寬度照內容撐開，金額欄超出卡片被切掉（2026-11-02 截圖） */
  :deep(.ex-month-table),
  .ex-month-table tbody {
    display: block;
  }

  /* 每一檔兩行：名稱｜金額，下一行小字是類型、配股、發放日。::after 是全寬的換行（order 2），那三格排在它後面（order 3） */
  .ex-month-table tbody tr {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 12px;
    padding: 9px 16px;
    border-bottom: 1px solid var(--app-divider);
  }

  .ex-month-table tbody tr::after {
    content: '';
    flex-basis: 100%;
    order: 2;
  }

  .ex-month-table tbody tr:last-child {
    border-bottom: 0;
  }

  .ex-month-table tbody td {
    padding: 0;
    border: 0;
  }

  .ex-month-table__name {
    flex: 1 1 0;
    min-width: 0;
    white-space: normal;
  }

  .ex-month-table__meta {
    order: 3;
    font-size: 0.875rem;
    color: var(--el-text-color-secondary);
  }

  .ex-month-table td.is-empty {
    display: none;
  }

  .ex-month-table__unit,
  .ex-month-table__label {
    display: inline;
  }
}
</style>
