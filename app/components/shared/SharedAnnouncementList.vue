<script setup lang="ts">
import type { MaterialAnnouncement } from '#shared/types/material-announcements'

// 重大訊息的清單卡片（2026-11-24 從個股重大訊息頁抽出，全市場的最新重大訊息頁也用）：日期分組（今天／昨天加日期），每則點開是全文、
// 換行照留，負面事件的類別是主旨前一個中性的小標籤。全市場那一頁的列多了代號與名稱：名稱寫在主旨前，全文底下連到那家公司的重大訊息頁
//（連結不放在 <summary> 裡，那裡本身就是一顆按鈕）
type Item = Pick<MaterialAnnouncement, 'subject' | 'description' | 'announcedAt' | 'negativeEvent'> & { time: string; symbol?: string; companyName?: string | null }
defineProps<{
  groups: { day: string; label: string; items: Item[] }[]
  title: string
  hint?: string
  emptyText: string
}>()
</script>

<template>
  <section class="app-card announcement-list" :aria-label="title">
    <div class="announcement-list__head">
      <h3 class="announcement-list__title">{{ title }}</h3>
      <span v-if="hint" class="announcement-list__hint">{{ hint }}</span>
    </div>
    <div v-for="group in groups" :key="group.day">
      <h4 class="announcement-list__day">{{ group.label }}</h4>
      <ul class="announcement-list__list">
        <li v-for="(item, index) in group.items" :key="`${group.day}-${index}`" class="announcement-list__item">
          <details class="app-disclosure">
            <summary>
              <span class="announcement-list__subject">
                <span v-if="item.symbol" class="announcement-list__company">{{ item.companyName ? `${item.companyName} ${item.symbol}` : item.symbol }}</span>
                <span v-if="negativeEventLabel(item.negativeEvent)" class="announcement-list__tag">{{ negativeEventLabel(item.negativeEvent) }}</span>{{ item.subject }}
              </span>
              <time v-if="item.time" class="announcement-list__time" :datetime="item.announcedAt ?? undefined">{{ item.time }}</time>
            </summary>
            <p class="announcement-list__body">{{ item.description }}</p>
            <p v-if="item.symbol" class="announcement-list__more">
              <NuxtLink :to="`/stock/${item.symbol}/announcements`">看{{ item.companyName ?? item.symbol }}的所有重大訊息</NuxtLink>
            </p>
          </details>
        </li>
      </ul>
    </div>
    <p v-if="!groups.length" class="announcement-list__empty">{{ emptyText }}</p>
  </section>
</template>

<style scoped>
.announcement-list {
  overflow: hidden;
}

.announcement-list__head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px 16px;
  padding: 16px;
}

.announcement-list__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
}

.announcement-list__hint,
.announcement-list__time {
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
}

/* 日期分組的標題同近期新聞：暖色底、一般文字色 */
.announcement-list__day {
  margin: 0;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--el-text-color-regular);
  background: var(--app-table-head-bg);
}

.announcement-list__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.announcement-list__item {
  padding: 4px 16px;
}

.announcement-list__item + .announcement-list__item {
  border-top: 1px solid var(--app-divider);
}

/* 全市場那一頁的公司名稱：一行，接著才是主旨 */
.announcement-list__company {
  display: block;
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

/* 負面事件的類別：主旨前一個小標籤，只描述是哪一類（不用紅色，不說好壞） */
.announcement-list__tag {
  display: inline-block;
  margin-right: 8px;
  padding: 0 6px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--el-text-color-regular);
}

/* 主旨換行照排（上游有的主旨中間就有換行），時刻接在主旨後面、靠右 */
.announcement-list__subject {
  flex: 1;
  font-weight: 600;
  line-height: 1.5;
}

.announcement-list__time {
  flex: none;
}

/* 全文：原文的換行照留，長的網址或數字也能斷行 */
.announcement-list__body {
  margin: 0 0 12px;
  white-space: pre-line;
  overflow-wrap: anywhere;
  line-height: 1.8;
}

.announcement-list__more {
  margin: 0 0 12px;
}

.announcement-list__empty {
  margin: 0;
  padding: 40px 16px;
  text-align: center;
  color: var(--el-text-color-secondary);
}
</style>
