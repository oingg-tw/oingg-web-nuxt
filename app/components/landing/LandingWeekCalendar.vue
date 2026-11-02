<script setup lang="ts">
import { Calendar } from '@element-plus/icons-vue'
import type { HomePageData } from '#shared/types/hub'

// 首頁的「這兩週的除權息與發放」（2026-11-02，首頁改版 B-1，使用者從四個版本裡選的）：週一到週五兩週，一格一天，除權息與發放各寫
// 檔數與前兩檔。兩種日子一起放：除權息的淡季（11 月）正是發放的旺季（10 月除權息的錢在 11 月入帳），首頁一年到頭都有東西。桌機兩週
// 都畫；手機一次一週，用「本週／下週」切換——同一份標記，CSS 換版面。名稱照代號排：是日期上的事實，不是挑股票
defineProps<{ weeks: NonNullable<HomePageData['weeks']>; today: string }>()

const WEEKDAYS = ['週一', '週二', '週三', '週四', '週五']
const shownWeek = ref(0)
const monthDay = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
</script>

<template>
  <section class="week-cal" aria-labelledby="week-cal-title">
    <div class="week-cal__head">
      <el-icon class="week-cal__icon" aria-hidden="true"><Calendar /></el-icon>
      <h2 id="week-cal-title" class="week-cal__title">這兩週的除權息與發放</h2>
      <span class="week-cal__range">{{ monthDay(weeks[0]!.days[0]!.date) }}（一）～{{ monthDay(weeks.at(-1)!.days.at(-1)!.date) }}（五）</span>
      <span class="week-cal__legend" aria-hidden="true">
        <span><span class="week-cal__tag">除</span>除權息</span>
        <span><span class="week-cal__tag week-cal__tag--pay">發</span>股利發放</span>
      </span>
    </div>

    <div class="week-cal__switch" role="group" aria-label="看哪一週">
      <button
        v-for="(week, index) in weeks"
        :key="week.label"
        type="button"
        class="week-cal__switch-button"
        :aria-pressed="shownWeek === index"
        @click="shownWeek = index"
      >
        {{ week.label }} {{ monthDay(week.days[0]!.date) }}–{{ monthDay(week.days.at(-1)!.date) }}
      </button>
    </div>

    <div class="week-cal__weekdays" aria-hidden="true">
      <span />
      <span v-for="weekday in WEEKDAYS" :key="weekday">{{ weekday }}</span>
    </div>
    <div v-for="(week, index) in weeks" :key="week.label" class="week-cal__week" :class="{ 'week-cal__week--hidden': shownWeek !== index }">
      <span class="week-cal__week-label">{{ week.label }}</span>
      <div v-for="(day, dayIndex) in week.days" :key="day.date" class="week-cal__day" :class="{ 'week-cal__day--today': day.date === today }">
        <p class="week-cal__date">
          <span class="week-cal__date-number">{{ monthDay(day.date) }}</span>
          <span class="week-cal__weekday">{{ WEEKDAYS[dayIndex] }}</span>
          <span v-if="day.date === today" class="week-cal__today">今天</span>
        </p>
        <p v-if="day.ex.count" class="week-cal__line">
          <span class="week-cal__tag" aria-hidden="true">除</span>
          <span class="week-cal__line-text">
            <b class="week-cal__count">除權息 {{ day.ex.count }} 檔</b>
            <span class="week-cal__names"><template v-for="(item, itemIndex) in day.ex.first" :key="item.symbol"><template v-if="itemIndex">、</template><NuxtLink :to="securityPath(item.symbol)">{{ item.name }}</NuxtLink></template><template v-if="day.ex.count > day.ex.first.length">…</template></span>
          </span>
        </p>
        <p v-if="day.pay.count" class="week-cal__line">
          <span class="week-cal__tag week-cal__tag--pay" aria-hidden="true">發</span>
          <span class="week-cal__line-text">
            <b class="week-cal__count">發放 {{ day.pay.count }} 檔</b>
            <span class="week-cal__names"><template v-for="(item, itemIndex) in day.pay.first" :key="item.symbol"><template v-if="itemIndex">、</template><NuxtLink :to="securityPath(item.symbol)">{{ item.name }}</NuxtLink></template><template v-if="day.pay.count > day.pay.first.length">…</template></span>
          </span>
        </p>
        <p v-if="!day.ex.count && !day.pay.count" class="week-cal__none">沒有除權息或發放</p>
      </div>
    </div>

    <div class="week-cal__foot">
      <NuxtLink to="/calendar" class="week-cal__more">看整個月的配息月曆 ›</NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.week-cal {
  background: var(--app-card-bg);
  border: 1px solid var(--app-surface-border);
  border-radius: 12px;
  overflow: hidden;
}

.week-cal__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--app-divider);
}

.week-cal__icon {
  font-size: 1.5rem;
  color: var(--el-color-primary);
}

.week-cal__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.04em;
}

.week-cal__range {
  color: var(--el-text-color-secondary);
}

.week-cal__legend {
  margin-left: auto;
  display: flex;
  gap: 16px;

  > span {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
}

/* 除＝實心、發＝外框：兩種日子靠明暗分，不只靠顏色。字色用頁面底色，深色模式的主色是淺金，白字會看不清 */
.week-cal__tag {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--el-color-primary);
  color: var(--el-bg-color);
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
}

.week-cal__tag--pay {
  background: none;
  box-shadow: inset 0 0 0 1.5px var(--el-color-primary);
  color: var(--el-color-primary-dark-2);
}

/* 本週／下週切換只在手機出現 */
.week-cal__switch {
  display: none;
}

.week-cal__weekdays,
.week-cal__week {
  display: grid;
  grid-template-columns: 72px repeat(5, minmax(0, 1fr));
}

.week-cal__weekdays {
  color: var(--el-text-color-secondary);
  text-align: center;

  > span + span {
    padding: 8px 0;
    border-left: 1px solid var(--app-divider);
  }
}

.week-cal__week {
  border-top: 1px solid var(--app-divider);
}

.week-cal__week-label {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: var(--el-text-color-regular);
}

.week-cal__day {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  min-height: 184px;
  padding: 12px 16px 16px;
  border-left: 1px solid var(--app-divider);
}

.week-cal__day--today {
  background: var(--el-color-primary-light-9);
}

.week-cal__date {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.week-cal__date-number {
  font-size: 1.125rem;
  font-weight: 700;
}

/* 桌機的星期寫在表頭；手機一天一列才寫在日期下面 */
.week-cal__weekday {
  display: none;
  color: var(--el-text-color-secondary);
}

.week-cal__today {
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

.week-cal__line {
  margin: 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.week-cal__line-text {
  min-width: 0;
}

.week-cal__count {
  display: block;
}

.week-cal__names {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--el-text-color-regular);

  /* 同篩選結果格的連結：顏色不變，滑過或聚焦才畫底線（一格兩行名稱都帶底線太花） */
  a {
    color: inherit;
    text-decoration: none;
  }

  a:hover,
  a:focus-visible {
    color: var(--el-color-primary-dark-2);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

.week-cal__none {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.week-cal__foot {
  display: flex;
  justify-content: flex-end;
  padding: 4px 24px;
  border-top: 1px solid var(--app-divider);
}

.week-cal__more {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-weight: 700;
  color: var(--el-color-primary-dark-2);
  text-underline-offset: 3px;
}

@media (max-width: 767px) {
  .week-cal__head {
    padding: 16px 16px 8px;
  }

  .week-cal__title {
    font-size: 1.25rem;
  }

  /* 日期範圍寫在切換鈕上 */
  .week-cal__range {
    display: none;
  }

  .week-cal__legend {
    margin-left: 0;
    flex-basis: 100%;
  }

  .week-cal__switch {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
    margin: 8px 16px 12px;
    padding: 4px;
    border-radius: 12px;
    background: var(--el-color-primary-light-9);
  }

  .week-cal__switch-button {
    min-height: 44px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--el-text-color-regular);
    font: inherit;
    transition: background-color 160ms cubic-bezier(0.23, 1, 0.32, 1);
  }

  .week-cal__switch-button[aria-pressed='true'] {
    background: var(--app-card-bg);
    box-shadow: 0 1px 3px rgb(0 0 0 / 15%);
    color: var(--el-text-color-primary);
    font-weight: 700;
  }

  .week-cal__week {
    display: block;
    border-top: 0;
  }

  /* 放在 .week-cal__week 後面：同樣一個 class 的權重，後寫的才贏 */
  .week-cal__weekdays,
  .week-cal__week-label,
  .week-cal__week--hidden {
    display: none;
  }

  .week-cal__day {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    gap: 8px 12px;
    min-height: 0;
    padding: 12px 16px;
    border-left: 0;
    border-top: 1px solid var(--app-divider);
  }

  .week-cal__date {
    grid-row: 1 / span 3;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    line-height: 1.4;
  }

  .week-cal__weekday {
    display: inline;
  }

  .week-cal__today {
    margin-top: 4px;
  }

  .week-cal__line,
  .week-cal__none {
    grid-column: 2;
  }

  .week-cal__foot {
    justify-content: flex-start;
    padding: 4px 16px;
  }
}
</style>
