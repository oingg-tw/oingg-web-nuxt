<script setup lang="ts">
// Card shell for 重大訊息公告 (material_announcement) — a live announcement feed, not a
// ranked/sorted metric, so this reads as a scrolling list rather than a table (per the
// user's own framing: "適合做即時公告牆/跑馬燈"). No backend source wired up yet — fixture
// data only.
export interface MaterialAnnouncementRow {
  code: string
  name: string
  announcedAt: string // 公告時間，HH:mm
  summary: string // 公告主旨摘要
}

const FIXTURE_ROWS: MaterialAnnouncementRow[] = [
  { code: '2330', name: '台積電', announcedAt: '13:42', summary: '公告本公司 2026 年第 3 季法人說明會參考資料' },
  { code: '1216', name: '統一', announcedAt: '11:05', summary: '公告本公司轉投資事業完成股權交割' },
  { code: '2882', name: '國泰金', announcedAt: '09:30', summary: '公告本公司子公司國泰人壽董事會決議通過投資案' },
  { code: '3008', name: '大立光', announcedAt: '08:15', summary: '公告本公司 8 月合併營收自結數' }
]
</script>

<template>
  <el-card class="material-announcement-card" shadow="never">
    <template #header>
      <span>重大訊息公告</span>
    </template>

    <ul class="material-announcement-card__list">
      <li v-for="(row, index) in FIXTURE_ROWS" :key="`${row.code}-${index}`" class="material-announcement-card__item">
        <span class="material-announcement-card__time">{{ row.announcedAt }}</span>
        <div class="material-announcement-card__body">
          <div class="material-announcement-card__stock">
            <span class="material-announcement-card__name">{{ row.name }}</span>
            <span class="material-announcement-card__code">{{ row.code }}</span>
          </div>
          <p class="material-announcement-card__summary">{{ row.summary }}</p>
        </div>
      </li>
    </ul>

    <p class="material-announcement-card__note">示意資料，尚未串接即時重大訊息公告</p>
  </el-card>
</template>

<style scoped>
.material-announcement-card__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 260px;
  overflow-y: auto;
}

.material-announcement-card__item {
  display: flex;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.material-announcement-card__item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.material-announcement-card__time {
  flex-shrink: 0;
  width: 42px;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.material-announcement-card__body {
  min-width: 0;
}

.material-announcement-card__stock {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.material-announcement-card__name {
  font-weight: 600;
}

.material-announcement-card__code {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.material-announcement-card__summary {
  margin: 2px 0 0;
  font-size: 16px;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.material-announcement-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
