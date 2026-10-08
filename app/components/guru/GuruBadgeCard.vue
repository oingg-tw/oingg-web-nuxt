<script setup lang="ts">
import { Trophy, TopRight } from '@element-plus/icons-vue'
import type { GuruBadge } from '~/utils/guru-badges'
const props = defineProps<{
  badge: GuruBadge
}>()

const dialogVisible = ref(false)

// 徽章一律主題色（2026-09-10 使用者：「徽章的顏色都幫我統一改成主題色...減少畫面上的雜訊」），分類已由卡片所在的區塊說明
const categoryColor = 'var(--el-color-primary)'
const DISCLAIMER = GURU_BADGE_DISCLAIMER

// 幾個徽章（F-Score、Z-Score…）沒有中文名，nameEn 跟 name 同字串，只有真的不同才多顯示一行
const hasDistinctNameEn = computed(() => props.badge.nameEn !== props.badge.name)

// 公式與來源都從型錄讀（2026-09-10「後端有給 referenceUrl，你前端忠實呈現就好」），前端不放第二份
const { data: filterSchema } = await useFilterSchema()
const badgeMetricLocation = computed(() => locateFieldInSchema(filterSchema.value?.categories ?? [], props.badge.fieldId))
const formulaHtml = computed(() => renderFormulaHtml(badgeMetricLocation.value?.metric.formulaLatex, true))
// 徽章自己的門檻來源（型錄 badge.sourceUrl，2026-09-20），不是指標的 referenceUrl；沒有就不顯示連結
const sourceUrl = computed(() => props.badge.sourceUrl)
</script>

<template>
  <!-- 整張卡是一顆真的 <button>（2026-09-10，WCAG AA：鍵盤可及、能朗讀為互動元件）；`id` 是個股頁「這是什麼指標？」連結的錨點，
       guru-badge-{metricCode}，上線後不改 -->
  <el-card :id="`guru-badge-${badge.id}`" class="guru-badge-card" shadow="hover" :body-style="{ padding: 0 }">
    <button type="button" class="guru-badge-card__trigger" @click="dialogVisible = true">
      <div class="guru-badge-card__medal" :style="{ background: categoryColor }">
        <el-icon><Trophy /></el-icon>
      </div>
      <el-tag :color="categoryColor" class="guru-badge-card__category">
        {{ badge.category }}
      </el-tag>
      <p class="guru-badge-card__name">{{ badge.name }}</p>
      <p v-if="hasDistinctNameEn" class="guru-badge-card__name-en">{{ badge.nameEn }}</p>
      <p class="guru-badge-card__author">{{ badge.author }}</p>
      <p class="guru-badge-card__summary">{{ badge.summary }}</p>
    </button>
  </el-card>

  <!-- append-to-body：不被祖先的 overflow 裁掉；#header 用 el-dialog 給的 titleId，對話框的 aria-labelledby 才指到徽章名
       （沒有它，朗讀器只聽到「對話框」）。出處（署名）放在標題下當副標（2026-09-10 使用者：「這邊看起來亂」）。
       注意這裡的 CSS 不能用 v-bind()：Teleport 出去的內容繼承不到元件根元素上的變數。 -->
  <el-dialog v-model="dialogVisible" width="min(600px, 92vw)" align-center append-to-body>
    <template #header="{ titleId, titleClass }">
      <p :id="titleId" :class="[titleClass, 'guru-badge-card__dialog-title']">{{ badge.name }}</p>
      <p class="guru-badge-card__dialog-byline">
        <span><template v-if="hasDistinctNameEn">{{ badge.nameEn }}｜</template>{{ badge.author }}</span>
        <a
          v-if="sourceUrl"
          :href="sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="guru-badge-card__dialog-source-link"
        >
          查看公式出處（另開新視窗）
          <el-icon aria-hidden="true"><TopRight /></el-icon>
        </a>
      </p>
    </template>

    <!-- 門檻與公式是同一件事（這個徽章的量化定義）的兩種說法，所以放進同一張有邊框的卡（深色模式下只靠底色分不出來，
         2026-09-10 實測 rgb(30,30,30) 對 rgb(38,39,39)）；視覺重點在公式，門檻文字退回一般字重（使用者指定）。 -->
    <div class="guru-badge-card__criteria-card">
      <p class="guru-badge-card__criteria-label">比較標準</p>
      <p class="guru-badge-card__criteria-value">{{ badge.threshold.description }}</p>
      <!-- 幾個公式（Ohlson／Zmijewski／Beneish 的多項迴歸）寬過對話框：在自己的盒子裡橫向捲動；可聚焦的具名區域，鍵盤才捲得到被切掉的那一段 -->
      <div v-if="formulaHtml" class="guru-badge-card__criteria-formula" tabindex="0" role="group" :aria-label="`${badge.name}的公式，可左右捲動`" v-html="formulaHtml" />
    </div>

    <p class="guru-badge-card__dialog-detail">{{ badge.detail }}</p>
    <p class="guru-badge-card__dialog-disclaimer">{{ DISCLAIMER }}</p>
  </el-dialog>
</template>

<style scoped>
.guru-badge-card {
  border-radius: 12px;
  text-align: center;
  /* Anchor landings (see the id above) clear the sticky app header/banner. */
  scroll-margin-top: calc(var(--app-header-height) + var(--app-banner-height) + 16px);
}

.guru-badge-card__trigger {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  color: inherit;
  text-align: center;
}

.guru-badge-card__medal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  color: var(--app-on-primary);
  font-size: 1.625rem;
  margin-bottom: 4px;
}

.guru-badge-card__category {
  border: none;
  color: var(--app-on-primary);
}

.guru-badge-card__name {
  margin: 8px 0 0;
  font-size: 1rem;
  font-weight: 600;
}

.guru-badge-card__name-en {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}

.guru-badge-card__author {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.guru-badge-card__summary {
  margin: 8px 0 0;
  font-size: 1rem;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.guru-badge-card__dialog-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.guru-badge-card__dialog-byline {
  margin: 4px 0 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px 16px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.guru-badge-card__dialog-source-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--el-color-primary);
}

.guru-badge-card__criteria-card {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
}

.guru-badge-card__criteria-label {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.guru-badge-card__criteria-value {
  margin: 4px 0 0;
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

/* 公式是卡片的視覺重點：主題色淡底＋只有上緣一條線（2026-09-10 使用者指定）。負的左右下 margin 抵掉父層 12px 16px 的內距，
   讓這塊貼齊卡片邊緣、圓角對得上。對話框 600px（2026-09-10 為 NCAV 公式加寬），最寬的多項迴歸（Ohlson 九因子，原尺寸 1050px）
   仍靠 overflow-x 捲動；字級照全站 16px 地板，不再縮成 14px。 */
.guru-badge-card__criteria-formula {
  margin: 12px -16px -12px;
  padding: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  border-radius: 0 0 7px 7px;
  background: var(--el-color-primary-light-9);
  overflow-x: auto;
  text-align: center;
  font-size: 1rem;
}

.guru-badge-card__dialog-detail {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.guru-badge-card__dialog-disclaimer {
  margin: 16px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}
</style>
