<script setup lang="ts">
import type { MetricCategory } from '~/composables/screener/useFilterSchema'
import type { TabFilterSlot } from '~/composables/screener/screener-tab-model'

// 新增／修改篩選條件的面板（2026-10-07 篩選器重新設計，mobile first、a11y）。取代原本的三層：選指標的
// popover（手機是全螢幕對話框）→ 100ms 後再開範圍編輯的 popover（手機是另一個對話框）。現在是同一個容器的兩步：
// 選指標 → 設定範圍，中間有「上一步」，不疊對話框、焦點不會在兩個容器之間掉。
//
// 同一個 el-dialog：手機是貼底的面板（全寬、最高 92dvh、可見的關閉鈕），桌機（≥768px）是置中對話框——
// 只靠 CSS，不在渲染時用 useIsDesktop 選標記（專案規則；原本兩個元件都違反）。焦點的進出交給 el-dialog
// 自己的 focus trap：打開時進到面板、關閉時回到觸發按鈕。
//
// 「新增欄位」（column 模式）只用第一步，選了就關。
const props = defineProps<{
  pickerVisible: boolean
  pickerMode: 'condition' | 'column'
  rangeVisible: boolean
  slot: TabFilterSlot | null
  categories: MetricCategory[]
  currentFieldId: string | null
}>()

const emit = defineEmits<{
  select: [fieldId: string, fieldLabel: string]
  back: []
  close: []
  changePeriod: [fieldId: string]
}>()

const open = computed(() => props.pickerVisible || (props.rangeVisible && !!props.slot))
const step = computed<'pick' | 'range'>(() => (props.rangeVisible && props.slot ? 'range' : 'pick'))
const title = computed(() => {
  if (step.value === 'range') return '設定範圍'
  return props.pickerMode === 'column' ? '新增欄位' : '選擇篩選指標'
})
const periods = computed(() => periodSiblingsOf(props.categories, props.slot?.fieldId ?? null))
</script>

<template>
  <el-dialog
    :model-value="open"
    :title="title"
    width="min(960px, 100vw)"
    class="condition-panel"
    modal-class="condition-panel-overlay"
    lock-scroll
    @update:model-value="value => { if (!value) emit('close') }"
  >
    <ScreenerIndicatorPickerBody
      v-if="step === 'pick'"
      :categories="categories"
      :current-field-id="currentFieldId"
      :active="open"
      :hide-period="pickerMode === 'condition'"
      @select="(fieldId: string, fieldLabel: string) => emit('select', fieldId, fieldLabel)"
    />
    <ScreenerRangeEditor
      v-else-if="slot"
      v-model:min="slot.min"
      v-model:max="slot.max"
      v-model:exclude="slot.exclude"
      :field-label="slot.fieldLabel ?? ''"
      :periods="periods"
      :current-field-id="slot.fieldId"
      :visible="open"
      @reset="emit('close')"
      @update:field-id="(fieldId: string) => emit('changePeriod', fieldId)"
    />

    <template v-if="step === 'range'" #footer>
      <div class="condition-panel__footer">
        <el-button size="large" @click="emit('back')">上一步：換指標</el-button>
        <el-button type="primary" size="large" @click="emit('close')">完成</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style>
/* Unscoped: el-dialog teleports to <body>. Mobile first — the base is a bottom sheet. */
.condition-panel-overlay .el-overlay-dialog {
  display: flex;
  align-items: flex-end;
}

.el-dialog.condition-panel {
  display: flex;
  flex-direction: column;
  width: 100% !important;
  max-width: none;
  max-height: 92dvh;
  margin: 0;
  border-radius: 16px 16px 0 0;
}

.el-dialog.condition-panel .el-dialog__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}

.el-dialog.condition-panel .el-dialog__headerbtn {
  width: 44px;
  height: 44px;
}

.condition-panel__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.condition-panel__footer .el-button {
  min-height: 44px;
  margin: 0;
}

@media (min-width: 768px) {
  .condition-panel-overlay .el-overlay-dialog {
    align-items: center;
  }

  .el-dialog.condition-panel {
    width: min(960px, 92vw) !important;
    max-height: 86vh;
    margin: auto;
    border-radius: var(--el-dialog-border-radius, 8px);
  }

  /* 選指標本體在大面板裡拿掉 720px 上限、每欄拉高（同原本 ScreenerIndicatorPicker 的置中模式） */
  .el-dialog.condition-panel .indicator-dialog {
    max-width: none;
    --indicator-rows: 9.5;
  }
}
</style>
