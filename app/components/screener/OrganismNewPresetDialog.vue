<script setup lang="ts">
import { ArrowLeft, Coin, Collection, DataAnalysis, Edit, Histogram, Trophy } from '@element-plus/icons-vue'
import type { Component } from 'vue'
import type { ScreenerTemplate } from '~/composables/screener/useScreenerTemplates'

const props = defineProps<{
  modelValue: boolean
  templates: ScreenerTemplate[]
  templatesLoading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  custom: []
  template: [id: string]
}>()

const isDesktop = useIsDesktop()

// Rebuilt 2026-09-02 per explicit user request — was a two-step "choose custom vs. 官方精選
//策略" flow (two big cards → a step labeled "官方精選策略" listing every category's templates
// stacked together). 官方精選策略 as its own labeled step is gone; the grid below (same
// icon-over-label tile style as AppFeatureMenu.vue's mobile nav grid) now sits where that
// choice used to be, with 自訂篩選邏輯 as just one more tile alongside each template category —
// picking a category tile drills into that one category's template list instead of a single
// long list grouped under every category at once.
const step = ref<'grid' | 'category'>('grid')
const selectedCategory = ref<string | null>(null)

watch(
  () => props.modelValue,
  visible => {
    if (visible) {
      step.value = 'grid'
      selectedCategory.value = null
    }
  }
)

function close() {
  emit('update:modelValue', false)
}

function chooseCustom() {
  emit('custom')
  close()
}

function chooseTemplate(template: ScreenerTemplate) {
  if (template.status !== 'AVAILABLE') return
  emit('template', template.id)
  close()
}

function openCategory(category: string) {
  selectedCategory.value = category
  step.value = 'category'
}

function backToGrid() {
  step.value = 'grid'
  selectedCategory.value = null
}

// Grouped by the backend's own `category` field (大師策略／量化因子／台股籌碼面／存股主題
// as of writing) rather than a frontend-maintained list — a new category added server-side
// just shows up as its own tile here with no code change needed (falling back to the generic
// Collection icon below for any name not in CATEGORY_ICONS).
const groupedTemplates = computed(() => {
  const groups = new Map<string, ScreenerTemplate[]>()
  for (const template of props.templates) {
    const list = groups.get(template.category) ?? []
    list.push(template)
    groups.set(template.category, list)
  }
  return [...groups.entries()]
})

const CATEGORY_ICONS: Record<string, Component> = {
  大師策略: Trophy,
  量化因子: DataAnalysis,
  台股籌碼面: Histogram,
  存股主題: Coin
}

function categoryIcon(category: string): Component {
  return CATEGORY_ICONS[category] ?? Collection
}

const activeTemplates = computed(() => {
  if (!selectedCategory.value) return []
  return props.templates.filter(t => t.category === selectedCategory.value)
})
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="step === 'grid' ? '新增分頁' : selectedCategory!"
    :width="isDesktop ? '560px' : '92%'"
    align-center
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="step === 'grid'" class="new-preset-dialog__grid">
      <button
        v-for="[category, items] in groupedTemplates"
        :key="category"
        type="button"
        class="new-preset-dialog__tile"
        @click="openCategory(category)"
      >
        <el-icon class="new-preset-dialog__tile-icon"><component :is="categoryIcon(category)" /></el-icon>
        <span class="new-preset-dialog__tile-label">{{ category }}</span>
        <span class="new-preset-dialog__tile-count">{{ items.length }}</span>
      </button>

      <!-- Last tile, not first — the template categories above are the "browse options
           we curated" path and read as the primary offering; 自訂篩選邏輯 is the fallback
           for "none of those fit," which belongs at the end, not competing for the first
           (most-noticed) grid slot. -->
      <button type="button" class="new-preset-dialog__tile" @click="chooseCustom">
        <el-icon class="new-preset-dialog__tile-icon"><Edit /></el-icon>
        <span class="new-preset-dialog__tile-label">自訂篩選邏輯</span>
      </button>

      <div v-if="templatesLoading" class="new-preset-dialog__status">載入中…</div>
    </div>

    <div v-else class="new-preset-dialog__browse">
      <button type="button" class="new-preset-dialog__back" @click="backToGrid">
        <el-icon><ArrowLeft /></el-icon>返回
      </button>

      <div v-if="!activeTemplates.length" class="new-preset-dialog__status">目前沒有可用的策略</div>
      <div v-else class="new-preset-dialog__templates">
        <button
          v-for="template in activeTemplates"
          :key="template.id"
          type="button"
          class="new-preset-dialog__template"
          :class="{ 'is-pending': template.status !== 'AVAILABLE' }"
          :disabled="template.status !== 'AVAILABLE'"
          @click="chooseTemplate(template)"
        >
          <div class="new-preset-dialog__template-head">
            <span class="new-preset-dialog__template-name">{{ template.name }}</span>
            <el-tag size="small" :type="template.tier === 'PAID' ? 'warning' : 'success'" effect="plain">
              {{ template.tier === 'PAID' ? '付費' : '免費' }}
            </el-tag>
            <el-tag v-if="template.status !== 'AVAILABLE'" size="small" type="info" effect="plain">即將推出</el-tag>
          </div>
          <p class="new-preset-dialog__template-desc">{{ template.description }}</p>
          <p v-if="template.pendingReason" class="new-preset-dialog__template-pending">{{ template.pendingReason }}</p>
        </button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
/* Same icon-over-label tile grid as AppFeatureMenu.vue's mobile nav grid — deliberately
   matched (3 columns, same gap/padding/icon size) so "adding a preset" reads as the same
   pattern language as the rest of the app's own navigation, not a one-off dialog layout. */
.new-preset-dialog__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: min-content;
  gap: 16px;
}

.new-preset-dialog__tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: transparent;
  color: var(--el-text-color-primary);
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.new-preset-dialog__tile:hover {
  border-color: var(--el-color-primary-light-5);
}

.new-preset-dialog__tile-icon {
  font-size: 28px;
  color: var(--el-color-primary);
}

.new-preset-dialog__tile-label {
  font-size: 16px;
  text-align: center;
}

.new-preset-dialog__tile-count {
  position: absolute;
  top: 8px;
  right: 8px;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}

.new-preset-dialog__status {
  grid-column: 1 / -1;
  padding: 24px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 16px;
}

.new-preset-dialog__back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 16px;
  cursor: pointer;
}

.new-preset-dialog__back:hover {
  color: var(--el-color-primary);
}

.new-preset-dialog__templates {
  max-height: 60vh;
  overflow-y: auto;
}

/* Whole card is the click target — same real <button> + hover-border pattern as
   .new-preset-dialog__tile, just left-aligned block layout instead of that one's centered
   icon-over-label, since the tag row + description here read better as stacked blocks.
   Pending templates stay disabled (native disabled, not just a visual dim) — chooseTemplate
   already no-ops for them, this is what stops the click and the hover border from firing. */
.new-preset-dialog__template {
  display: block;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.new-preset-dialog__template:not(:disabled):hover {
  border-color: var(--el-color-primary-light-5);
}

.new-preset-dialog__template + .new-preset-dialog__template {
  margin-top: 8px;
}

.new-preset-dialog__template.is-pending {
  opacity: 0.6;
  cursor: not-allowed;
}

.new-preset-dialog__template-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.new-preset-dialog__template-name {
  font-size: 16px;
  font-weight: 600;
}

.new-preset-dialog__template-desc {
  margin: 6px 0 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.new-preset-dialog__template-pending {
  margin: 4px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
}
</style>
