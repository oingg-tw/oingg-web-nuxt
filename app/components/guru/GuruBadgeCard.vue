<script setup lang="ts">
import { Trophy } from '@element-plus/icons-vue'
import { GURU_BADGE_DISCLAIMER, GURU_CATEGORY_COLOR } from '~/utils/guru-badges'
import type { GuruBadge } from '~/utils/guru-badges'

const props = defineProps<{
  badge: GuruBadge
}>()

const dialogVisible = ref(false)

// Category colors and the disclaimer both moved to guru-badges.ts 2026-09-09 (see that file's
// own comments for the WCAG contrast verification and why it's shared) — StockGuruBadgeCard.vue
// on the stock-detail page needs the exact same two values, so they live in the shared data
// module instead of being duplicated per component.
const categoryColor = computed(() => GURU_CATEGORY_COLOR[props.badge.category])
const DISCLAIMER = GURU_BADGE_DISCLAIMER

// Several badges (Piotroski F-Score/Altman Z-Score/Beneish M-Score/Ohlson O-Score/Zmijewski
// Score/Graham Number) have no separate Chinese name — nameEn is set to the exact same string
// as name in guru-badges.ts (there's nothing to translate). Showing both lines back-to-back
// read as pure visual duplication (reported live). Only render nameEn when it's actually a
// different string worth showing.
const hasDistinctNameEn = computed(() => props.badge.nameEn !== props.badge.name)
</script>

<template>
  <el-card class="guru-badge-card" shadow="hover" @click="dialogVisible = true">
    <div class="guru-badge-card__medal" :style="{ background: categoryColor }">
      <el-icon><Trophy /></el-icon>
    </div>
    <el-tag size="small" :color="categoryColor" class="guru-badge-card__category">
      {{ badge.category }}
    </el-tag>
    <p class="guru-badge-card__name">{{ badge.name }}</p>
    <p v-if="hasDistinctNameEn" class="guru-badge-card__name-en">{{ badge.nameEn }}</p>
    <p class="guru-badge-card__author">{{ badge.author }}</p>
    <p class="guru-badge-card__summary">{{ badge.summary }}</p>
  </el-card>

  <el-dialog v-model="dialogVisible" :title="badge.name" width="min(560px, 92vw)" align-center append-to-body>
    <p class="guru-badge-card__dialog-author">
      <template v-if="hasDistinctNameEn">{{ badge.nameEn }}｜</template>{{ badge.author }}
    </p>
    <p class="guru-badge-card__dialog-threshold">比較標準：{{ badge.threshold.description }}</p>
    <p class="guru-badge-card__dialog-detail">{{ badge.detail }}</p>
    <p class="guru-badge-card__dialog-disclaimer">{{ DISCLAIMER }}</p>
  </el-dialog>
</template>

<style scoped>
.guru-badge-card {
  cursor: pointer;
  border-radius: 12px;
  text-align: center;
}

.guru-badge-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px 16px;
}

.guru-badge-card__medal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  color: #fff;
  font-size: 26px;
  margin-bottom: 4px;
}

.guru-badge-card__category {
  border: none;
  color: #fff;
}

.guru-badge-card__name {
  margin: 8px 0 0;
  font-size: 16px;
  font-weight: 600;
}

.guru-badge-card__name-en {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.guru-badge-card__author {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.guru-badge-card__summary {
  margin: 8px 0 0;
  font-size: 16px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.guru-badge-card__dialog-author {
  margin: 0 0 4px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.guru-badge-card__dialog-threshold {
  margin: 0 0 12px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.guru-badge-card__dialog-detail {
  margin: 0;
  font-size: 16px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.guru-badge-card__dialog-disclaimer {
  margin: 16px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}
</style>
