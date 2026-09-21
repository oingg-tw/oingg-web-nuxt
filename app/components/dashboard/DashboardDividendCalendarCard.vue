<script setup lang="ts">
import type { DividendCalendarExType } from '~/composables/dashboard/useDividendCalendar'

// The new hero of the 總覽 dashboard, per direct redesign request ("總覽 dashboard 我設計錯了，
// 應該以配息月曆為核心才對") — replaces the old DashboardWatchlistExDividendCard.vue's own
// sorted-list-scoped-to-watchlist design with a real month-grid calendar covering the WHOLE
// MARKET (confirmed directly: "擴大成全市場"), not just the signed-in user's own tracked stocks.
// Built on el-calendar (this app's own "locked into Element Plus" convention — no custom
// month-grid layout code) rather than a hand-rolled grid.
//
// Wired to the real GET /stocks/ex-dividend-calendar?month=YYYY-MM 2026-09-10 (see
// useDividendCalendar.ts's own comment) — was mock data for a few hours while analysis-ts/bff-ts
// built and wired the market-wide endpoint; the DividendCalendarEvent shape was deliberately
// matched to the real API from the start, so swapping useDividendCalendarMock for
// useDividendCalendar needed no other changes here beyond the import and this call site.
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
// them would lose the entries a lot of readers came for. Default on, one click off.
const commonStocksOnly = ref(true)
const COMMON_STOCK_SYMBOL = /^\d{4}$/

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
</script>

<template>
  <el-card class="dividend-calendar-card" shadow="never">
    <template #header>
      <div class="dividend-calendar-card__header">
        <span class="dividend-calendar-card__title">全市場配息月曆</span>
        <div class="dividend-calendar-card__filters">
          <el-checkbox-group v-model="activeExTypes" size="small">
            <el-checkbox-button v-for="option in EX_TYPE_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </el-checkbox-button>
          </el-checkbox-group>
          <el-checkbox v-model="commonStocksOnly" size="small">只看普通股</el-checkbox>
        </div>
      </div>
    </template>

    <el-calendar v-model="selectedMonth" v-loading="pending">
      <template #date-cell="{ data }">
        <div class="dividend-calendar-card__cell" @click="eventsFor(data.day).length && openDetail(data.day)">
          <span class="dividend-calendar-card__cell-day">{{ data.day.split('-').pop() }}</span>
          <div v-if="eventsFor(data.day).length" class="dividend-calendar-card__cell-chips">
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
          </div>
        </div>
      </template>
    </el-calendar>

    <el-dialog v-model="detailVisible" :title="detailDay ? `${detailDay} 除權息事件` : ''" width="360px" append-to-body>
      <ul class="dividend-calendar-card__detail-list">
        <li v-for="event in detailEvents" :key="event.symbol" class="dividend-calendar-card__detail-row">
          <NuxtLink :to="`/stock/${event.symbol}`" class="dividend-calendar-card__detail-link">
            {{ event.symbol }}<template v-if="event.companyName"> {{ event.companyName }}</template>
          </NuxtLink>
          <el-tag size="small" :type="EX_TYPE_TAG_KIND[event.exType]">{{ event.exType }}</el-tag>
          <span v-if="event.cashDividend !== null" class="dividend-calendar-card__detail-cash">現金股利 {{ event.cashDividend }} 元</span>
        </li>
      </ul>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.dividend-calendar-card {
  border-radius: 12px;
}

.dividend-calendar-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.dividend-calendar-card__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.dividend-calendar-card__title {
  font-weight: 600;
}

.dividend-calendar-card__cell {
  height: 100%;
  min-height: 64px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: default;
}

.dividend-calendar-card__cell-day {
  font-size: 1rem;
}

.dividend-calendar-card__cell-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  cursor: pointer;
}

.dividend-calendar-card__chip {
  cursor: pointer;
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
