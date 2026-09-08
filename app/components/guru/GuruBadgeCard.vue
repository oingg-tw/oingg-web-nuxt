<script setup lang="ts">
import { Trophy } from '@element-plus/icons-vue'
import type { GuruBadge, GuruBadgeCategory } from '~/utils/guru-badges'

const props = defineProps<{
  badge: GuruBadge
}>()

const dialogVisible = ref(false)

// One consistent color per category (股東回饋/獲利品質/獲利能力/成長動能/財務韌性/市場評價/
// 營運周轉/大戶籌碼, per direct request "徽章分成八類") so badges group visually at a glance
// without needing to read every label — same "same category, same color" convention already
// established for preferred-stocks.vue's own column-preset categories. All 8 fixed hex values,
// not accent-linked (unlike the earlier 3-category version, which let 估值 ride
// --el-color-primary) — with 8 categories there's no natural "one of these IS the theme accent"
// candidate the way there was with 3, and fixing all 8 avoids a repeat of the earlier
// warning-vs-primary near-collision under this site's default GOLD theme (see this component's
// own git history). Every value contrast-checked directly (relative-luminance formula, not
// eyeballed) against white badge-icon/tag text — all clear the WCAG 1.4.11 3:1 non-text floor
// AND the stricter 4.5:1 AA normal-text floor (4.83–7.13:1), since 獲利品質's first pick
// (#16a34a, 3.30:1) failed AA against white before being darkened to #15803d.
const CATEGORY_COLOR: Record<GuruBadgeCategory, string> = {
  股東回饋: '#0e7490',
  獲利品質: '#15803d',
  獲利能力: '#2563eb',
  成長動能: '#c2410c',
  財務韌性: '#dc2626',
  市場評價: '#7c3aed',
  營運周轉: '#92400e',
  大戶籌碼: '#be185d'
}

const categoryColor = computed(() => CATEGORY_COLOR[props.badge.category])

// One fixed disclaimer line in the shared dialog, not repeated per-badge in each `detail`
// string — per direct request ("與其文案在那邊寫非投資建議，不如把這個彈窗共用元件下面放固定
// 文案就好"). Every badge's `detail` in guru-badges.ts had its own near-identical trailing
// "不代表個股的投資建議" clause; stripped from all 9 in the same pass this component changed,
// since the dialog itself now says it once for every badge.
const DISCLAIMER = '以上為公開學術方法論的框架介紹，不代表本站對任何個股之評等或投資建議。'
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
