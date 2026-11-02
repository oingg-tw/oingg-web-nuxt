<script setup lang="ts">
import { Calendar } from '@element-plus/icons-vue'
import type { HomeAgendaDay } from '#shared/types/hub'

// 首頁的「接下來的除權息與發放」（2026-11-02 首頁改版，使用者選了 B-3）：左邊除權息、右邊股利發放，各列從今天起有事件的四天，
// 每天三檔（照代號排）寫金額，其餘收在「另外 N 檔」，名單照樣在伺服器輸出的 HTML 裡。只列有事件的日子：除權息的淡季（11 月）
// 正是發放的旺季，兩欄都不會空。首頁是給第一次來的人看的，沒有「我的持股」這類登入後的篩選（使用者：「首頁主要是用來說服陌生用戶的」）。
// 桌機兩欄並排；手機用「除權息／股利發放」切換——同一份標記，CSS 換版面
const props = defineProps<{ ex: HomeAgendaDay[]; pay: HomeAgendaDay[]; today: string }>()

const SHOWN = 3
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const tracks = computed(() => [
  { key: 'ex', tag: '除', title: '除權息', help: '除權息日的前一個交易日以前買進，才領得到這次股利', days: props.ex },
  { key: 'pay', tag: '發', title: '股利發放', help: '股利匯入帳戶的日子', days: props.pay }
])
const shownTrack = ref('ex')

// 'YYYY-MM-DD' 照 UTC 解析，伺服器與瀏覽器算出同一個星期
const dayText = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}（${WEEKDAYS[new Date(date).getUTCDay()]}）`

// 每股（ETF 每單位）現金，最多四位小數。只配股、沒有現金的寫「除權」；還沒公布的寫「未公布」
function amountText(item: HomeAgendaDay['items'][number], track: string) {
  if (item.cash !== null && item.cash > 0) return `${Number(item.cash.toFixed(4))} 元`
  return track === 'ex' && item.exType !== '息' ? '除權' : '未公布'
}
</script>

<template>
  <section class="upcoming" aria-labelledby="upcoming-title">
    <div class="upcoming__head">
      <el-icon class="upcoming__icon" aria-hidden="true"><Calendar /></el-icon>
      <h2 id="upcoming-title" class="upcoming__title">接下來的除權息與發放</h2>
      <NuxtLink to="/calendar" class="upcoming__more">看配息月曆 ›</NuxtLink>
    </div>

    <div class="upcoming__switch" role="group" aria-label="看哪一種日子">
      <button
        v-for="track in tracks"
        :key="track.key"
        type="button"
        class="upcoming__switch-button"
        :aria-pressed="shownTrack === track.key"
        @click="shownTrack = track.key"
      >
        <span class="upcoming__tag" :class="{ 'upcoming__tag--pay': track.key === 'pay' }" aria-hidden="true">{{ track.tag }}</span>{{ track.title }}
      </button>
    </div>

    <div class="upcoming__tracks">
      <div v-for="track in tracks" :key="track.key" class="upcoming__track" :class="{ 'upcoming__track--hidden': shownTrack !== track.key }">
        <div class="upcoming__track-head">
          <h3 class="upcoming__track-title">
            <span class="upcoming__tag" :class="{ 'upcoming__tag--pay': track.key === 'pay' }" aria-hidden="true">{{ track.tag }}</span>{{ track.title }}
          </h3>
          <p class="upcoming__help">{{ track.help }}</p>
        </div>
        <p v-if="!track.days.length" class="upcoming__empty">接下來一個月沒有{{ track.title }}</p>
        <div v-for="day in track.days" :key="day.date" class="upcoming__day" :class="{ 'upcoming__day--today': day.date === today }">
          <p class="upcoming__date">
            <span class="upcoming__date-text">{{ dayText(day.date) }}</span>
            <span v-if="day.date === today" class="upcoming__today">今天</span>
            <span class="upcoming__count">{{ day.items.length }} 檔</span>
          </p>
          <ul class="upcoming__items">
            <li v-for="item in day.items.slice(0, SHOWN)" :key="item.symbol">
              <NuxtLink :to="securityPath(item.symbol)" class="upcoming__item">
                <span class="upcoming__name">{{ item.name }}<span v-if="item.name !== item.symbol" class="upcoming__code"> {{ item.symbol }}</span></span>
                <span class="upcoming__amount" :class="{ 'upcoming__amount--pending': !(item.cash && item.cash > 0) }">{{ amountText(item, track.key) }}</span>
              </NuxtLink>
            </li>
          </ul>
          <details v-if="day.items.length > SHOWN" class="app-disclosure upcoming__rest">
            <summary>另外 {{ day.items.length - SHOWN }} 檔</summary>
            <ul class="upcoming__items">
              <li v-for="item in day.items.slice(SHOWN)" :key="item.symbol">
                <NuxtLink :to="securityPath(item.symbol)" class="upcoming__item">
                  <span class="upcoming__name">{{ item.name }}<span v-if="item.name !== item.symbol" class="upcoming__code"> {{ item.symbol }}</span></span>
                  <span class="upcoming__amount" :class="{ 'upcoming__amount--pending': !(item.cash && item.cash > 0) }">{{ amountText(item, track.key) }}</span>
                </NuxtLink>
              </li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.upcoming {
  background: var(--app-card-bg);
  border: 1px solid var(--app-surface-border);
  border-radius: 12px;
  overflow: hidden;
}

.upcoming__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--app-divider);
}

.upcoming__icon {
  font-size: 1.5rem;
  color: var(--el-color-primary);
}

.upcoming__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.04em;
}

.upcoming__more {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-weight: 700;
  color: var(--el-color-primary-dark-2);
  text-underline-offset: 3px;
}

/* 除＝實心、發＝外框：兩種日子靠明暗分，不只靠顏色。字色用頁面底色，深色模式的主色是淺金，白字會看不清 */
.upcoming__tag {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--el-color-primary);
  color: var(--el-bg-color);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
}

.upcoming__tag--pay {
  background: none;
  box-shadow: inset 0 0 0 1.5px var(--el-color-primary);
  color: var(--el-color-primary-dark-2);
}

/* 除權息／股利發放切換只在手機出現 */
.upcoming__switch {
  display: none;
}

.upcoming__tracks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.upcoming__track {
  min-width: 0;
}

.upcoming__track + .upcoming__track {
  border-left: 1px solid var(--app-divider);
}

.upcoming__track-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 24px 24px 16px;
}

.upcoming__track-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.04em;
}

.upcoming__help,
.upcoming__empty {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.upcoming__empty {
  padding: 16px 24px;
  border-top: 1px solid var(--app-divider);
}

.upcoming__day {
  padding: 12px 24px 8px;
  border-top: 1px solid var(--app-divider);
}

.upcoming__day--today {
  background: var(--el-color-primary-light-9);
}

.upcoming__date {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.upcoming__date-text {
  font-size: 1.125rem;
  font-weight: 700;
}

.upcoming__today {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--el-color-primary);
  color: var(--el-bg-color);
  font-weight: 600;
  line-height: 1;
}

.upcoming__count {
  margin-left: auto;
  color: var(--el-text-color-secondary);
}

.upcoming__items {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* 一檔一行：名稱放不下在行尾截掉，金額靠右、數字等寬 */
.upcoming__item {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 44px;
  border-top: 1px solid var(--app-divider);
  color: inherit;
  text-decoration: none;

  &:hover .upcoming__name,
  &:focus-visible .upcoming__name {
    color: var(--el-color-primary-dark-2);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

.upcoming__name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* 間距用 margin：標籤開頭的空白會被模板的空白壓縮吃掉 */
.upcoming__code {
  margin-left: 0.5em;
  color: var(--el-text-color-secondary);
}

.upcoming__amount {
  margin-left: auto;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  white-space: nowrap;
}

.upcoming__amount--pending {
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.upcoming__rest > summary {
  font-weight: 700;
  color: var(--el-color-primary-dark-2);
}

@media (max-width: 767px) {
  .upcoming__head {
    padding: 16px 16px 8px;
  }

  .upcoming__title {
    font-size: 1.25rem;
  }

  .upcoming__switch {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
    margin: 8px 16px 0;
    padding: 4px;
    border-radius: 12px;
    background: var(--el-color-primary-light-9);
  }

  .upcoming__switch-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--el-text-color-regular);
    font: inherit;
    transition: background-color 160ms cubic-bezier(0.23, 1, 0.32, 1);
  }

  .upcoming__switch-button[aria-pressed='true'] {
    background: var(--app-card-bg);
    box-shadow: 0 1px 3px rgb(0 0 0 / 15%);
    color: var(--el-text-color-primary);
    font-weight: 700;
  }

  .upcoming__tracks {
    display: block;
  }

  .upcoming__track + .upcoming__track {
    border-left: 0;
  }

  /* 放在 .upcoming__track 後面：同樣一個 class 的權重，後寫的才贏 */
  .upcoming__track--hidden,
  .upcoming__track-title {
    display: none;
  }

  .upcoming__track-head {
    padding: 12px 16px;
  }

  .upcoming__day {
    padding: 12px 16px 8px;
  }

  .upcoming__empty {
    padding: 16px;
  }

  .upcoming__item {
    min-height: 48px;
  }
}
</style>
