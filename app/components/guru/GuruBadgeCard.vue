<script setup lang="ts">
import { Trophy } from '@element-plus/icons-vue'
import type { GuruBadge, GuruBadgeCategory } from '~/utils/guru-badges'

const props = defineProps<{
  badge: GuruBadge
}>()

const dialogVisible = ref(false)

// One consistent color per category (財務體質/獲利品質/估值) so badges group visually at a
// glance without needing to read every label — same "same category, same color" convention
// already established for preferred-stocks.vue's own column-preset categories. Fixed
// (--el-color-danger/success/primary), not accent-linked for 財務體質/獲利品質 — those two need
// to stay mutually distinguishable regardless of the user's chosen theme accent, same reasoning
// as the DuPont-family charts' own fixed line-color palettes. 估值 DOES use --el-color-primary
// (the theme accent) rather than a 4th fixed hue, matching every other "primary = the site's
// own accent" usage elsewhere. --el-color-warning was tried first for 獲利品質 but rejected —
// confirmed live under this site's default GOLD theme, warning's amber and primary's gold
// measured too close in hue/lightness to read as distinct categories at a glance
// (rgb(230,162,60) vs rgb(153,115,40)) — success (green) reads unambiguously against both red
// and gold in every theme.
const CATEGORY_COLOR: Record<GuruBadgeCategory, string> = {
  財務體質: 'var(--el-color-danger)',
  獲利品質: 'var(--el-color-success)',
  估值: 'var(--el-color-primary)'
}

const categoryColor = computed(() => CATEGORY_COLOR[props.badge.category])
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
    <p class="guru-badge-card__name-en">{{ badge.nameEn }}</p>
    <p class="guru-badge-card__author">{{ badge.author }}</p>
    <p class="guru-badge-card__summary">{{ badge.summary }}</p>
  </el-card>

  <el-dialog v-model="dialogVisible" :title="badge.name" width="min(560px, 92vw)" align-center append-to-body>
    <p class="guru-badge-card__dialog-author">{{ badge.nameEn }}｜{{ badge.author }}</p>
    <p class="guru-badge-card__dialog-detail">{{ badge.detail }}</p>
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
</style>
