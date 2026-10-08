<script setup lang="ts">
import type { DividendCalendarEvent, DividendCalendarExType } from '~/composables/dashboard/useDividendCalendar'

// 配息月曆——/calendar 的核心（「總覽 dashboard 我設計錯了，應該以配息月曆為核心才對」），涵蓋全市場而不只自選股（「擴大成全市場」）。
// 用 el-calendar（本專案「鎖定 Element Plus」的慣例），不手刻月格。
// 資料來自 GET /stocks/ex-dividend-calendar?month=YYYY-MM（2026-09-10 接上，見 useDividendCalendar）。
const selectedMonth = ref(new Date())
const monthKey = computed(() => {
  const year = selectedMonth.value.getFullYear()
  const month = String(selectedMonth.value.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
})

const { events, pending } = useDividendCalendar(monthKey)

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
// PENDING（agreed with analysis-ts/bff-ts/mops-ts 2026-09-22, NOT yet applied）: mops-ts is
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
const beforeCoverage = computed(() => monthKey.value < COVERAGE_FROM)

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

// The 預告/已實現 distinction lives here as TEXT rather than as a fourth colour on the grid chips.
// The chips already carry one colour axis (除息/除權/除權息) and hold nothing but a symbol code;
// a second axis on a 3-character tag would be both unreadable and a WCAG 1.4.1 problem, since
// colour would be the only thing carrying it. A word in the day's own list says it outright.
function detailMeta(event: DividendCalendarEvent): string[] {
  const parts: string[] = []
  // ETF 的金額在 distributionPerUnit、個股在 cashDividend；少數 ETF 兩邊都有（twse 的預告表也
  // 收了部分 ETF），所以取前者優先。詞也跟著換——ETF 分配的是「每受益權單位」不是「每股」。
  const amount = event.distributionPerUnit ?? event.cashDividend
  if (amount !== null) parts.push(event.securityType === 'ETF' ? `每單位配息 ${amount} 元` : `現金股利 ${amount} 元`)
  if (event.fiscalYear !== null) parts.push(`${event.fiscalYear} 年度`)
  if (event.status === 'announced') parts.push('尚未除息（公司預告）')
  else if (event.paymentDate) parts.push(`發放日 ${event.paymentDate}`)
  return parts
}
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

    <p v-if="beforeCoverage" class="dividend-calendar-card__note" role="status">
      {{ monthKey }} 早於本站的除權息資料涵蓋範圍。完整的全市場紀錄自 {{ COVERAGE_FROM }} 起，更早的月份只有零星幾筆，不代表當月的全部除權息事件。
    </p>

    <el-calendar v-model="selectedMonth" v-loading="pending">
      <!-- 有事件的日子是真的 <button>（2026-10-08；原本是 click-div，鍵盤到不了），沒事件的日子維持 <div>——42 顆 disabled 按鈕
           對螢幕閱讀器只是噪音。aria-label 含可見的日號（2.5.3）。手機只放筆數：375px 的格子約 45px 寬，兩顆四位數代號的 chip
           放不下；768px 起才顯示 chip。 -->
      <template #date-cell="{ data }">
        <component
          :is="eventsFor(data.day).length ? 'button' : 'div'"
          :type="eventsFor(data.day).length ? 'button' : undefined"
          class="dividend-calendar-card__cell"
          :class="{ 'dividend-calendar-card__cell--events': eventsFor(data.day).length }"
          :aria-label="eventsFor(data.day).length ? `${data.day} 有 ${eventsFor(data.day).length} 筆除權息事件` : undefined"
          @click="eventsFor(data.day).length && openDetail(data.day)"
        >
          <span class="dividend-calendar-card__cell-day">{{ data.day.split('-').pop() }}</span>
          <template v-if="eventsFor(data.day).length">
            <span class="dividend-calendar-card__cell-count">{{ eventsFor(data.day).length }} 筆</span>
            <span class="dividend-calendar-card__cell-chips">
              <el-tag
                v-for="event in eventsFor(data.day).slice(0, 2)"
                :key="event.symbol"
                size="small"
                :type="EX_TYPE_TAG_KIND[event.exType]"
                class="dividend-calendar-card__chip"
              >
                {{ event.symbol }}
              </el-tag>
              <span v-if="eventsFor(data.day).length > 2" class="dividend-calendar-card__cell-more">
                +{{ eventsFor(data.day).length - 2 }}
              </span>
            </span>
          </template>
        </component>
      </template>
    </el-calendar>

    <el-dialog v-model="detailVisible" :title="detailDay ? `${detailDay} 除權息事件` : ''" width="min(360px, calc(100vw - 32px))" append-to-body>
      <ul class="dividend-calendar-card__detail-list">
        <li v-for="event in detailEvents" :key="event.symbol" class="dividend-calendar-card__detail-row">
          <NuxtLink :to="`/stock/${event.symbol}`" class="dividend-calendar-card__detail-link">
            {{ event.symbol }}<template v-if="event.companyName"> {{ event.companyName }}</template>
          </NuxtLink>
          <el-tag size="small" :type="EX_TYPE_TAG_KIND[event.exType]">{{ event.exType }}</el-tag>
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
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-size: 1rem;
  line-height: 1.6;
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
.dividend-calendar-card :deep(.el-calendar-table .el-calendar-day) {
  height: auto;
  min-height: 76px;
  padding: 6px;
}
</style>
