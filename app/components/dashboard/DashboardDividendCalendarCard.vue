<script setup lang="ts">
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import type { DividendCalendarEvent, DividendCalendarExType } from '~/composables/dashboard/useDividendCalendar'

// 配息月曆——/calendar 的核心（「總覽 dashboard 我設計錯了，應該以配息月曆為核心才對」），涵蓋全市場而不只自選股（「擴大成全市場」）。
// 用 el-calendar（本專案「鎖定 Element Plus」的慣例），不手刻月格。
// 資料來自 GET /stocks/ex-dividend-calendar?yearMonth=YYYY-MM（2026-09-10 接上，見 useDividendCalendar）。
const selectedMonth = ref(new Date())
const monthKey = computed(() => {
  const year = selectedMonth.value.getFullYear()
  const month = String(selectedMonth.value.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
})

// 今天（2026-11-08，使用者：「配息月曆看不出來 今天是哪一天」）：台北日期，跟持股的配息月曆同一天。這個元件只在瀏覽器畫（ClientOnly）
const today = holdingsTaipeiDate()

// 手機預設看一週（2026-11-08，使用者在方案頁選 B：「手機版用B 方案，他的UIUX更容易些」）：週一到週五往下排，每天先列 3 筆，其餘按一下
// 展開；週末打開時是下一週。月格的手機版每格只寫筆數，看內容要一天一天開對話框。「月」切回月格；768px 起只有月格（view 只管手機）
const view = ref<'week' | 'month'>('week')
const thisWeek = tradingWeekOf(today)
const weekStart = ref(thisWeek[0]!)
const week = computed(() => tradingWeekOf(weekStart.value))

const { events, pending, failed } = useDividendCalendar(() => [monthKey.value, ...week.value.map(day => day.slice(0, 7))])

const EX_TYPE_OPTIONS: { value: DividendCalendarExType; label: string }[] = [
  { value: '息', label: '除息' },
  { value: '權', label: '除權' },
  { value: '權息', label: '除權息' }
]
const activeExTypes = ref<DividendCalendarExType[]>(['息', '權', '權息'])

// 只看普通股（2026-09-22,「能否限制顯示普通股的配息日期就好？」）, on by default.
//
// GET /stocks/ex-dividend-calendar carries no security-type field, so the SYMBOL decides — the
// same /^\d{4}$/ rule three server routes already use for「a four-digit listed symbol」, not a new
// convention invented here. Measured on 2026-09: 109 entries, of which 58 are four-digit and 51
// are ETFs（00939, 00940…）, preferred shares（9941A, 00400A）and 受益證券（01010T）. Every 權 and
// 權息 event in that month is four-digit, which is expected — an ETF does not issue stock dividends.
//
// A toggle rather than a hard filter, and NOT because the request was ambiguous: 0056 and 00878
// are among the things this app's own audience actually holds, so a calendar that can never show
// them would lose the entries a lot of readers came for.
//
// **預設改成關（兩種都顯示），2026-09-30**：「配息月曆 至少要有普通股與 ETF 配息資料」。預設開著
// 的時候，ETF 要按一下才看得到——而 ETF 佔了這一頁將近一半的筆數（2026-09 實測 96/206）。想只看
// 普通股的人仍然是一個勾選框的距離。
const commonStocksOnly = ref(false)
const COMMON_STOCK_SYMBOL = /^\d{4}$/

// 往回翻歷史月份（2026-09-22,「配息月曆可以查以前的歷史嗎」→「A」）.
//
// The NAVIGATION itself needed no code: el-calendar ships 上個月/下個月 buttons in its own header
// and useDividendCalendar already watches `month` and refetches. What the feature actually needed
// was the backend gaining historical rows at all (see that composable's own comment) plus the two
// things below — telling 預告 from 已實現, and being honest about how far back the data goes.
//
// The coverage floor is MEASURED, not taken on trust. analysis-ts reported「全市場覆蓋只從
// 2026-03 起」; sweeping all 34 months confirms a real cliff there（2026-02: 10 筆 → 2026-03:
// 104 筆）and that everything before it is a scatter of 0–13 rows a month. What the sweep also
// shows is why a simple「筆數變少就是缺資料」rule would be wrong: 2026-05 returns only 27 rows
// despite being past the cliff, because May genuinely is a low season for Taiwanese ex-dates
// (2024-05 and 2025-05 are both 0). So the note keys off the MONTH, not off the row count.
//
// PENDING（agreed with analysis-ts/業務中台/mops-ts 2026-09-22, NOT yet applied）: mops-ts is
// backfilling 股利分派 for 1,985 companies over 民國 106~115（3–4 days）, after which this floor
// drops to 2020-09. NOT 2020-01, which is what the fiscal-year range would suggest: fiscal_year is
// the EARNINGS period, not the ex-dividend year, so fiscal 109's earliest ex-date is 2020-09-17 —
// setting 2020-01 would claim eight empty months. 2020-09 also happens to meet the whole
// ecosystem's 109Q3 financial-data floor, so no month claims ex-dividend events with no statements
// behind them.
//
// This value stays at the conservative 2026-03 until the batch has actually landed and mops-ts
// reports the real MIN(除息日): COVERAGE_FROM is a CLAIM TO THE READER about what we hold, so it
// may only be widened after the rows exist, never in anticipation of them.
const COVERAGE_FROM = '2026-03'
// 月格看它自己那個月，手機的一週看週一那個月
const coverageNote = (month: string) => (month < COVERAGE_FROM
  ? `${month} 的除權息紀錄不完整：完整的全市場紀錄自 ${COVERAGE_FROM} 起，更早的月份只有零星幾筆，不代表當月的全部除權息事件。`
  : '')

const eventsByDay = computed<Record<string, typeof events.value>>(() => {
  const map: Record<string, typeof events.value> = {}
  for (const event of events.value) {
    if (!activeExTypes.value.includes(event.exType)) continue
    if (commonStocksOnly.value && !COMMON_STOCK_SYMBOL.test(event.symbol)) continue
    ;(map[event.exDate] ??= []).push(event)
  }
  return map
})

// el-calendar's own #date-cell slot data.day is already 'YYYY-MM-DD', matching exDate's format
// directly — no reparsing needed.
function eventsFor(day: string) {
  return eventsByDay.value[day] ?? []
}

// 月格只畫自己那個月的事件：一週跨月時另一個月也讀進來了，月格頭尾幾格原本就是空的
const cellEvents = (data: { type: string; day: string }) => (data.type === 'current-month' ? eventsFor(data.day) : [])
const monthDays = computed(() => events.value.map(event => event.exDate).filter(day => day.startsWith(monthKey.value)))

// 標頭自己畫（2026-11-08）：Element 預設的標頭只有月份與三顆按鈕，旁邊要寫今天是哪一天；三顆按鈕照預設
function shiftMonth(months: number) {
  const current = selectedMonth.value
  selectedMonth.value = new Date(current.getFullYear(), current.getMonth() + months, 1)
}

const EX_TYPE_TAG_KIND: Record<DividendCalendarExType, 'success' | 'warning' | 'info'> = {
  息: 'success',
  權: 'warning',
  權息: 'info'
}

// Detail popover state — clicking a day's "+N more" (or any chip, when there's room) opens the
// full list for that day rather than trying to cram every symbol into the cell itself.
// el-dialog's v-model is a boolean visibility flag, so the selected day and the dialog's own
// open/closed state are two separate refs (detailDay keeps its last value while the dialog
// closes, which is fine — nothing reads it while hidden).
const detailDay = ref<string | null>(null)
const detailVisible = ref(false)
const detailEvents = computed(() => (detailDay.value ? eventsFor(detailDay.value) : []))
function openDetail(day: string) {
  detailDay.value = day
  detailVisible.value = true
}

// 「00940 元大台灣價值高息」：原本寫成 {{ 代號 }}<template v-if> {{ 名稱 }}</template>，Vue 把 template 開頭只有空白的字拿掉，代號跟名稱黏在一起
const eventName = (event: DividendCalendarEvent) => [event.symbol, event.companyName].filter(Boolean).join(' ')

// ETF 的金額在 distributionPerUnit、個股在 cashDividend；少數 ETF 兩邊都有（twse 的預告表也
// 收了部分 ETF），所以取前者優先。詞也跟著換——ETF 分配的是「每受益權單位」不是「每股」。
function amountText(event: DividendCalendarEvent): string | null {
  const amount = event.distributionPerUnit ?? event.cashDividend
  if (amount === null) return null
  return event.securityType === 'ETF' ? `每單位配息 ${amount} 元` : `現金股利 ${amount} 元`
}

// The 預告/已實現 distinction lives here as TEXT rather than as a fourth colour on the grid chips.
// The chips already carry one colour axis (除息/除權/除權息) and hold nothing but a symbol code;
// a second axis on a 3-character tag would be both unreadable and a WCAG 1.4.1 problem, since
// colour would be the only thing carrying it. A word in the day's own list says it outright.
function detailMeta(event: DividendCalendarEvent): string[] {
  const parts: string[] = []
  const amount = amountText(event)
  if (amount) parts.push(amount)
  if (event.fiscalYear !== null) parts.push(`${event.fiscalYear} 年度`)
  if (event.status === 'announced') parts.push('尚未除息（公司預告）')
  else {
    if (event.paymentDate) parts.push(`發放日 ${event.paymentDate}`)
    // 配股的發放日（2026-10-20 起才有，只有個股）
    if (event.stockDividendDistributionDate) parts.push(`配股發放日 ${event.stockDividendDistributionDate}`)
  }
  return parts
}

// 一週（手機）：每天先列 3 筆，其餘按「顯示其餘 N 筆」，換週時收回去。每筆一行說明只放金額與預告或發放日（手機上一行放得下），
// 年度與配股發放日留在月格的對話框
const AGENDA_SHOWN = 3
const expandedDays = ref(new Set<string>())
const agenda = computed(() => week.value.map(day => ({ day, events: eventsFor(day), past: day < today, isToday: day === today })))
// 「11/16～11/20」不寫星期：360 寬放不下「11/16（一）～11/20（五）」，每天的標題列已經寫了
const weekLabel = computed(() => `${monthDay(week.value[0]!)}～${monthDay(week.value[4]!)}`)
const weekNote = computed(() => coverageNote(week.value[0]!.slice(0, 7)))
// 每一段各自不折（「公司預告」原本在 320 寬折成「公司預／告」），放不下就從「・」換行
function agendaMeta(event: DividendCalendarEvent): string[] {
  const status = event.status === 'announced' ? '公司預告' : event.paymentDate ? `發放 ${monthDay(event.paymentDate)}` : null
  return [amountText(event), status].filter((part): part is string => !!part).map((part, index) => (index ? `・${part}` : part))
}
function toggleDay(day: string) {
  const next = new Set(expandedDays.value)
  if (!next.delete(day)) next.add(day)
  expandedDays.value = next
}
function shiftWeek(days: number) {
  weekStart.value = addDays(weekStart.value, days)
}
watch(weekStart, () => {
  expandedDays.value = new Set()
})
// 兩種檢視互相帶過去：切到月格看這一週的那個月（週三那個月，一週至少三天在那裡）；切回一週看月格那個月的第一週，當月就是今天這週
watch(view, current => {
  if (current === 'month') selectedMonth.value = new Date(`${week.value[2]}T00:00:00`)
  else weekStart.value = monthKey.value === today.slice(0, 7) ? thisWeek[0]! : tradingWeekOf(`${monthKey.value}-01`)[0]!
})
</script>

<template>
  <!-- NOT an el-card（2026-09-23,「月曆不要放在卡片裡面會怎樣」）.
       A card separates one item from its siblings. This one had none left: calendar.vue's
       DASHBOARD_GRID_CARDS_ENABLED went false, so the page is this component and nothing else,
       and the card had become a border around the whole page.
       Two things it was actively costing. The card header carried the title「全市場配息月曆」83px
       below the page's own h1「配息月曆」— the same sentence twice, which is what looked wrong.
       And it kept the filters inside a card header rather than in a toolbar under the page title,
       where every other filter row in this app sits.
       Nothing was lost by dropping it: measured live, `.el-calendar` sets its OWN white background
       （rgb(255,255,255), identical to the card's）, so the月曆 keeps its surface against the page's
       beige. The 20px padding it also gave back is worth ~6px per day cell — not the reason. -->
  <section class="dividend-calendar-card">
    <div class="dividend-calendar-card__filters" role="group" aria-label="除權息類型篩選">
      <el-checkbox-group v-model="activeExTypes">
        <el-checkbox-button v-for="option in EX_TYPE_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </el-checkbox-button>
      </el-checkbox-group>
      <el-checkbox v-model="commonStocksOnly">只看普通股</el-checkbox>
    </div>

    <div class="dividend-calendar-card__views app-narrow-only">
      <el-radio-group v-model="view" aria-label="檢視">
        <el-radio-button value="week">週</el-radio-button>
        <el-radio-button value="month">月</el-radio-button>
      </el-radio-group>
      <el-button v-show="view === 'week'" text type="primary" class="dividend-calendar-agenda__today" @click="weekStart = thisWeek[0]!">今天 {{ shortDayLabel(today) }}</el-button>
    </div>

    <!-- 五天等資料到了才一起畫（2026-11-08 量到 375 寬 0.059：日期列先畫、各天的列晚到，後面幾天被推下去）。頁尾在 main 的 100dvh 之下，
         所以後出現的只是新內容，沒有東西被推動；讀取中第一天的位置放一條同高的骨架。讀不到時也不畫：「沒有除權息」會是錯的 -->
    <section v-show="view === 'week'" class="dividend-calendar-agenda app-narrow-only" aria-labelledby="dividend-calendar-week" :aria-busy="pending">
      <div class="dividend-calendar-agenda__nav">
        <el-button :icon="ArrowLeft" text circle aria-label="上一週" @click="shiftWeek(-7)" />
        <h2 id="dividend-calendar-week" class="dividend-calendar-agenda__range">{{ weekLabel }}</h2>
        <el-button :icon="ArrowRight" text circle aria-label="下一週" @click="shiftWeek(7)" />
      </div>
      <el-alert v-if="weekNote" type="info" show-icon :closable="false" role="status" class="dividend-calendar-agenda__note" :title="weekNote" />
      <span v-if="pending || failed" class="app-skeleton dividend-calendar-agenda__skeleton" aria-hidden="true" />
      <template v-else>
        <section v-for="item in agenda" :key="item.day" class="dividend-calendar-agenda__day" :class="{ 'dividend-calendar-agenda__day--past': item.past }" :aria-labelledby="`agenda-${item.day}`">
          <h3 :id="`agenda-${item.day}`" class="dividend-calendar-agenda__head">
            <span class="dividend-calendar-agenda__date">
              {{ shortDayLabel(item.day) }}
              <span v-if="item.isToday" class="dividend-calendar-agenda__pill">今天</span>
            </span>
            <span class="dividend-calendar-agenda__count">{{ item.events.length ? `${item.events.length} 筆` : '沒有除權息' }}</span>
          </h3>
          <ul v-if="item.events.length" class="dividend-calendar-agenda__list">
            <li v-for="event in expandedDays.has(item.day) ? item.events : item.events.slice(0, AGENDA_SHOWN)" :key="`${event.symbol}-${event.exType}`" class="dividend-calendar-agenda__row">
              <span class="dividend-calendar-agenda__row-head">
                <NuxtLink :to="securityPath(event.symbol)" class="dividend-calendar-card__detail-link">{{ eventName(event) }}</NuxtLink>
                <el-tag size="small" :type="EX_TYPE_TAG_KIND[event.exType]">{{ EX_TYPE_LABELS[event.exType] }}</el-tag>
              </span>
              <span v-if="agendaMeta(event).length" class="dividend-calendar-card__detail-cash">
                <span v-for="part in agendaMeta(event)" :key="part" class="dividend-calendar-agenda__meta-part">{{ part }}</span>
              </span>
            </li>
          </ul>
          <button v-if="item.events.length > AGENDA_SHOWN" type="button" class="dividend-calendar-agenda__more" :aria-expanded="expandedDays.has(item.day)" @click="toggleDay(item.day)">
            {{ expandedDays.has(item.day) ? '收起' : `顯示其餘 ${item.events.length - AGENDA_SHOWN} 筆` }}
          </button>
        </section>
        <div class="dividend-calendar-agenda__pager">
          <el-button text type="primary" @click="shiftWeek(-7)">‹ 上一週</el-button>
          <el-button text type="primary" @click="shiftWeek(7)">下一週 ›</el-button>
        </div>
      </template>
    </section>

    <div class="dividend-calendar-card__month" :class="{ 'dividend-calendar-card__month--week': view === 'week' }">
      <el-alert
        v-if="coverageNote(monthKey)"
        type="info"
        show-icon
        :closable="false"
        role="status"
        class="dividend-calendar-card__note"
        :title="coverageNote(monthKey)"
      />

      <el-calendar v-model="selectedMonth" v-loading="pending" :class="{ 'app-calendar--weekdays': !hasWeekendDate(monthDays) }">
        <template #header="{ date }">
          <span class="app-calendar-title">
            <span class="el-calendar__title">{{ date }}</span>
            <span class="app-calendar-today">今天 {{ shortDayLabel(today) }}</span>
          </span>
          <div class="el-calendar__button-group">
            <el-button-group>
              <el-button size="small" @click="shiftMonth(-1)">上個月</el-button>
              <el-button size="small" @click="selectedMonth = new Date()">今天</el-button>
              <el-button size="small" @click="shiftMonth(1)">下個月</el-button>
            </el-button-group>
          </div>
        </template>
        <!-- 有事件的日子是真的 <button>（2026-10-08；原本是 click-div，鍵盤到不了），沒事件的日子維持 <div>——42 顆 disabled 按鈕
             對螢幕閱讀器只是噪音。aria-label 含可見的日號（2.5.3）。手機只放筆數：375px 的格子約 45px 寬，兩顆四位數代號的 chip
             放不下；768px 起才顯示 chip。今天與過去的日子用 main.css 的 .app-calendar-day 那一組 -->
        <template #date-cell="{ data }">
          <component
            :is="cellEvents(data).length ? 'button' : 'div'"
            :type="cellEvents(data).length ? 'button' : undefined"
            class="dividend-calendar-card__cell"
            :class="{
              'dividend-calendar-card__cell--events': cellEvents(data).length,
              'app-calendar-day--today': data.day === today,
              'app-calendar-day--past': data.day < today
            }"
            :aria-label="cellEvents(data).length ? `${data.day} 有 ${cellEvents(data).length} 筆除權息事件${data.day === today ? '，今天' : ''}` : undefined"
            @click="cellEvents(data).length && openDetail(data.day)"
          >
            <span class="app-calendar-day__head">
              <span class="dividend-calendar-card__cell-day app-calendar-day__num">{{ data.day.split('-').pop() }}</span>
              <span v-if="data.day === today" class="app-calendar-day__today">今天</span>
            </span>
            <template v-if="cellEvents(data).length">
              <span class="dividend-calendar-card__cell-count">{{ cellEvents(data).length }} 筆</span>
              <span class="dividend-calendar-card__cell-chips">
                <el-tag
                  v-for="event in cellEvents(data).slice(0, 2)"
                  :key="event.symbol"
                  size="small"
                  :type="EX_TYPE_TAG_KIND[event.exType]"
                  class="dividend-calendar-card__chip"
                >
                  {{ event.symbol }}
                </el-tag>
                <span v-if="cellEvents(data).length > 2" class="dividend-calendar-card__cell-more">
                  +{{ cellEvents(data).length - 2 }}
                </span>
              </span>
            </template>
          </component>
        </template>
      </el-calendar>
    </div>

    <el-dialog v-model="detailVisible" :title="detailDay ? `${detailDay} 除權息事件` : ''" width="min(360px, calc(100vw - 32px))" append-to-body>
      <ul class="dividend-calendar-card__detail-list">
        <li v-for="event in detailEvents" :key="event.symbol" class="dividend-calendar-card__detail-row">
          <!-- ETF、特別股各有自己的頁（securityPath）：原本一律連 /stock/{代號}，00931B 這類 ETF 點下去是「找不到這檔股票」 -->
          <NuxtLink :to="securityPath(event.symbol)" class="dividend-calendar-card__detail-link">{{ eventName(event) }}</NuxtLink>
          <el-tag size="small" :type="EX_TYPE_TAG_KIND[event.exType]">{{ EX_TYPE_LABELS[event.exType] }}</el-tag>
          <span v-if="detailMeta(event).length" class="dividend-calendar-card__detail-cash">{{ detailMeta(event).join('・') }}</span>
        </li>
      </ul>
    </el-dialog>
  </section>
</template>

<style scoped>
/* A toolbar under the page title. LEFT-aligned: it sits on its own line rather than sharing one
   with the h1, and right-alignment on its own line left it stranded across an empty band at 1440.
   Flush left, it shares an edge with the h1, the subtitle and the calendar below it.
   16px below, which is the gap the card's own header border used to imply. */
.dividend-calendar-card__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.dividend-calendar-card__note {
  margin-bottom: 12px;
}

.dividend-calendar-card__cell {
  height: 100%;
  min-height: 64px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: default;
}

/* 按鈕重設：外觀跟 div 版一樣，只多了可聚焦與游標 */
.dividend-calendar-card__cell--events {
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.dividend-calendar-card__cell-count {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.dividend-calendar-card__cell-day {
  font-size: 1rem;
}

/* 手機只放筆數，768px 起換成 chip（見 template 的註解） */
.dividend-calendar-card__cell-chips {
  display: none;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

@media (min-width: 768px) {
  .dividend-calendar-card__cell-count {
    display: none;
  }

  .dividend-calendar-card__cell-chips {
    display: flex;
  }
}

.dividend-calendar-card__cell-more {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.dividend-calendar-card__detail-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dividend-calendar-card__detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dividend-calendar-card__detail-link {
  font-weight: 600;
  color: var(--el-text-color-primary);
  text-decoration: none;
}

.dividend-calendar-card__detail-link:hover {
  color: var(--el-color-primary);
}

.dividend-calendar-card__detail-cash {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

/* el-calendar's own cell padding is too tight for a day number + chips to breathe — widen it a
   little and let content define height instead of the component's own fixed row height. */
/* 最小高度＝有事件那一格的高度（日號＋筆數＋代號標籤）：事件在瀏覽器才讀到，原本 76px 的空格在事件到了以後撐成 88px，整個月曆
   一列一列往下推（2026-10-18 全站量測，1440 與 375 寬都是每列 77→89px）。先留好位置，事件到了不動 */
.dividend-calendar-card :deep(.el-calendar-table .el-calendar-day) {
  height: auto;
  min-height: 88px;
  padding: 6px;
}

/* 手機的週／月切換與一週清單（方案 B）。清單跟月格同一個底色（el-calendar 自己的底），日期列用表頭的暖色、過去的日子用淡底 */
.dividend-calendar-card__views {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.dividend-calendar-agenda {
  padding: 4px 12px 8px;
  background: var(--el-fill-color-blank);
}

.dividend-calendar-agenda__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dividend-calendar-agenda__nav .el-button {
  width: 44px;
  height: 44px;
}

.dividend-calendar-agenda__range {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.dividend-calendar-agenda__note {
  margin-top: 8px;
}

.dividend-calendar-agenda__day {
  margin-top: 12px;
}

.dividend-calendar-agenda__skeleton {
  display: block;
  height: 44px;
  margin-top: 12px;
  border-radius: 8px;
}

.dividend-calendar-agenda__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  margin: 0;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--app-table-head-bg);
  color: var(--el-text-color-primary);
  font-size: 1rem;
  font-weight: 600;
}

.dividend-calendar-agenda__day--past .dividend-calendar-agenda__head {
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
}

.dividend-calendar-agenda__date {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* 今天：跟選中的膠囊同一組顏色（主色底、反白字），七種主題、深淺色都過 AA */
.dividend-calendar-agenda__pill {
  padding: 0 10px;
  border-radius: 999px;
  background: var(--el-color-primary);
  color: var(--el-bg-color);
  line-height: 1.625rem;
}

.dividend-calendar-agenda__count {
  font-weight: 400;
}

.dividend-calendar-agenda__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.dividend-calendar-agenda__row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
}

.dividend-calendar-agenda__row + .dividend-calendar-agenda__row {
  border-top: 1px solid var(--app-divider);
}

.dividend-calendar-agenda__row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dividend-calendar-agenda__row-head .el-tag {
  flex: none;
}

.dividend-calendar-agenda__meta-part {
  white-space: nowrap;
}

.dividend-calendar-agenda__more {
  width: 100%;
  min-height: 44px;
  border: 0;
  border-top: 1px solid var(--app-divider);
  background: none;
  font: inherit;
  font-weight: 600;
  color: var(--el-color-primary);
  cursor: pointer;
}

.dividend-calendar-agenda__pager {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
}

.dividend-calendar-agenda__pager .el-button,
.dividend-calendar-agenda__today {
  min-height: 44px;
  margin: 0;
}

@media (max-width: 767px) {
  .dividend-calendar-card__month--week {
    display: none;
  }
}
</style>
