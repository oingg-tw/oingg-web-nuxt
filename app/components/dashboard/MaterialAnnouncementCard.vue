<script setup lang="ts">
// Was fixture-only — now wired to bff-ts's real material-announcements endpoint (confirmed
// live 2026-09-01, 254 real rows, no backfill wait). Shows `subject` (a one-line-ish
// headline) as the summary, not `description` (the full, much longer filing text with
// literal \r\n line breaks — that's for a future detail view, not this card).
const { data } = useMaterialAnnouncements(20)

// announcementTime comes back as twse-ts's raw HHMMSS, not zero-padded (e.g. "70003" for
// 07:00:03) and not reformatted server-side — pad and slice into HH:mm here.
function formatAnnouncementTime(raw: string): string {
  const padded = raw.padStart(6, '0')
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`
}
</script>

<template>
  <el-card class="material-announcement-card" shadow="never">
    <template #header>
      <span>重大訊息公告</span>
    </template>

    <el-empty v-if="data.items.length === 0" description="尚無公告資料" :image-size="64" />
    <ul v-else class="material-announcement-card__list">
      <li v-for="(row, index) in data.items" :key="`${row.symbol}-${index}`" class="material-announcement-card__item">
        <span class="material-announcement-card__time">{{ formatAnnouncementTime(row.announcementTime) }}</span>
        <div class="material-announcement-card__body">
          <div class="material-announcement-card__stock">
            <span class="material-announcement-card__code">{{ row.symbol }}</span>
            <span class="material-announcement-card__name">{{ row.name ?? '—' }}</span>
          </div>
          <p class="material-announcement-card__summary">{{ row.subject }}</p>
        </div>
      </li>
    </ul>
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

.material-announcement-card__code {
  font-weight: 600;
}

.material-announcement-card__name {
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
</style>
