<script setup lang="ts">
import type { HoldingDividendEvent } from '~/composables/holdings/holdings-model'

// 持股的配息月曆（2026-10-19，使用者：「holdings/dividends 要先呈現配息月曆，下半部才會是表格」）。每一筆配息在月曆上標兩天：
// 除權息日（「除息／除權／除權息」）與現金發放日（「發放」，只配股的「權」沒有，上游沒有配股入帳日）。種類用字寫出來，不只靠顏色。
// 點有事件的那一天，對話框列出當天的事件、每股、股數與應收。
//
// ponytail: 月格的寫法（el-calendar＋按鈕格＋手機只放筆數）跟全市場的 DashboardDividendCalendarCard 各寫一份。那一個自己抓全市場資料、
// 有篩選與資料起點的提示，跟這裡共用的只有月格；第三個月曆出現時再抽元件。
interface CalendarEvent extends HoldingDividendEvent {
  key: string
  name: string
  link: string
  perShareText: string
  sharesText: string
  amountText: string
}
const props = defineProps<{
  events: CalendarEvent[]
  // 業務中台判斷狀態用的台北日期：月曆從這個月開始（不用瀏覽器的時間，跟表格的「已發放／待發放」同一天）
  asOf: string
}>()

const month = ref(new Date(`${props.asOf}T00:00:00`))

interface DayItem { key: string; kind: 'ex' | 'pay'; label: string; event: CalendarEvent }
const itemsByDay = computed(() => {
  const map: Record<string, DayItem[]> = {}
  for (const event of props.events) {
    ;(map[event.exDate] ??= []).push({ key: `${event.key}-ex`, kind: 'ex', label: EX_TYPE_LABELS[event.exType] ?? event.exType, event })
    if (event.paymentDate && event.exType !== '權') (map[event.paymentDate] ??= []).push({ key: `${event.key}-pay`, kind: 'pay', label: '發放', event })
  }
  return map
})
const itemsFor = (day: string) => itemsByDay.value[day] ?? []
const dayLabel = (day: string) => `${Number(day.slice(5, 7))} 月 ${Number(day.slice(8))} 日`

const detailDay = ref<string | null>(null)
const detailVisible = ref(false)
function openDetail(day: string) {
  detailDay.value = day
  detailVisible.value = true
}
</script>

<template>
  <div class="holdings-dividend-calendar">
    <el-calendar v-model="month">
      <!-- 有事件的格子是按鈕（點了看明細），沒有的是 div。aria-label 寫出日期與每一件事，螢幕閱讀器不必打開對話框。
           手機只放筆數：375px 的格子約 45px 寬，名稱放不下；768px 起才顯示名稱 -->
      <template #date-cell="{ data }">
        <component
          :is="itemsFor(data.day).length ? 'button' : 'div'"
          :type="itemsFor(data.day).length ? 'button' : undefined"
          class="holdings-dividend-calendar__cell"
          :class="{ 'holdings-dividend-calendar__cell--events': itemsFor(data.day).length }"
          :aria-label="itemsFor(data.day).length ? `${dayLabel(data.day)}：${itemsFor(data.day).map(item => `${item.event.name}${item.label}`).join('、')}` : undefined"
          @click="itemsFor(data.day).length && openDetail(data.day)"
        >
          <span class="holdings-dividend-calendar__day">{{ data.day.split('-').pop() }}</span>
          <template v-if="itemsFor(data.day).length">
            <span class="holdings-dividend-calendar__count">{{ itemsFor(data.day).length }} 筆</span>
            <span class="holdings-dividend-calendar__chips">
              <el-tag
                v-for="item in itemsFor(data.day).slice(0, 2)"
                :key="item.key"
                size="small"
                :type="item.kind === 'pay' ? 'primary' : 'success'"
                :effect="item.kind === 'pay' ? 'dark' : 'light'"
                class="holdings-dividend-calendar__chip"
              >
                {{ item.event.name }} {{ item.label }}
              </el-tag>
              <span v-if="itemsFor(data.day).length > 2" class="holdings-dividend-calendar__more">+{{ itemsFor(data.day).length - 2 }}</span>
            </span>
          </template>
        </component>
      </template>
    </el-calendar>

    <el-dialog v-model="detailVisible" :title="detailDay ? dayLabel(detailDay) : ''" width="min(420px, calc(100vw - 32px))" append-to-body>
      <ul class="holdings-dividend-calendar__detail">
        <li v-for="item in detailDay ? itemsFor(detailDay) : []" :key="item.key" class="holdings-dividend-calendar__detail-row">
          <div class="holdings-dividend-calendar__detail-head">
            <NuxtLink :to="item.event.link" class="holdings-dividend-calendar__detail-link">{{ item.event.name }}</NuxtLink>
            <el-tag size="small" :type="item.kind === 'pay' ? 'primary' : 'success'" :effect="item.kind === 'pay' ? 'dark' : 'light'">{{ item.label }}</el-tag>
          </div>
          <p class="holdings-dividend-calendar__detail-text">
            每股 {{ item.event.perShareText || '—' }}・{{ item.event.sharesText }}・應收 {{ item.event.amountText }}
          </p>
        </li>
      </ul>
    </el-dialog>
  </div>
</template>

<style scoped>
.holdings-dividend-calendar__cell {
  height: 100%;
  min-height: 64px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: default;
}

/* 按鈕重設：外觀跟 div 版一樣，只多了可聚焦與游標 */
.holdings-dividend-calendar__cell--events {
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

.holdings-dividend-calendar__day,
.holdings-dividend-calendar__count,
.holdings-dividend-calendar__more {
  font-size: 1rem;
}

.holdings-dividend-calendar__count,
.holdings-dividend-calendar__more {
  color: var(--el-text-color-secondary);
}

/* 手機只放筆數，768px 起換成名稱 */
.holdings-dividend-calendar__chips {
  display: none;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

@media (min-width: 768px) {
  .holdings-dividend-calendar__count {
    display: none;
  }

  .holdings-dividend-calendar__chips {
    display: flex;
  }
}

/* 名稱太長就截斷，完整的在 aria-label 與對話框 */
.holdings-dividend-calendar__chip {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.holdings-dividend-calendar__detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.holdings-dividend-calendar__detail-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.holdings-dividend-calendar__detail-link {
  font-weight: 600;
}

.holdings-dividend-calendar__detail-text {
  margin: 4px 0 0;
  color: var(--el-text-color-regular);
}

/* 格子高度：日號＋兩個名稱（同全市場月曆的最小高度做法） */
.holdings-dividend-calendar :deep(.el-calendar-table .el-calendar-day) {
  height: auto;
  min-height: 96px;
  padding: 6px;
}
</style>
