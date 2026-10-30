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
//
// 手機多一頁「條件清單」（2026-10-31，使用者要篩選條件跟「檢視」一樣收進面板）：頁面上只剩「篩選條件 N 個」，按了先到清單（#list，
// 呼叫端放 ScreenerFilters），新增、修改從清單換到選指標、設定範圍，「完成」回到清單——同一個面板換頁，不疊彈窗
const props = defineProps<{
  listVisible?: boolean
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
  // 「完成」與「上一步：條件清單」：回到上一頁（不是從清單進來的就是關掉）
  done: []
  close: []
  // 關閉動畫結束（Element Plus 已經把焦點還給打開它的按鈕之後）
  closed: []
  changePeriod: [fieldId: string]
}>()

const open = computed(() => props.listVisible || props.pickerVisible || (props.rangeVisible && !!props.slot))
type Step = 'list' | 'pick' | 'range'
const liveStep = computed<Step | null>(() => (props.rangeVisible && props.slot ? 'range' : props.pickerVisible ? 'pick' : props.listVisible ? 'list' : null))
// 關掉的時候停在最後開著的那一頁：關閉動畫裡內容不換，關著的面板也不會多畫一份條件清單（電腦版從來不開清單）
const lastStep = ref<Step>('pick')
const step = computed<Step>(() => liveStep.value ?? lastStep.value)
// 從選指標、設定範圍回到清單：那一頁的控制項拆掉了，焦點移到清單的「新增條件」，不掉到 body。剛打開（before 是 null）不動：
// 那時搶先移焦點，Element 會把清單裡的按鈕記成「打開前的焦點」，關掉時還不回「篩選條件」那顆（2026-10-31 量到焦點掉到 body）
const listRef = ref<HTMLElement | null>(null)
watch(liveStep, async (now, before) => {
  if (now) lastStep.value = now
  if (now !== 'list' || !before) return
  await nextTick()
  listRef.value?.querySelector<HTMLElement>('.screener-filters__add-slot')?.focus()
})
// 類別型條件（2026-10-15）第二步是勾選項目，不是設數字範圍
const metric = computed(() => (props.slot?.fieldId ? locateFieldInSchema(props.categories, props.slot.fieldId)?.metric ?? null : null))
const categorical = computed(() => metric.value?.kind === 'categorical')
const title = computed(() => {
  if (step.value === 'list') return '篩選條件'
  if (step.value === 'range') return categorical.value ? '選擇項目' : '設定範圍'
  return props.pickerMode === 'column' ? '新增欄位' : '選擇篩選指標'
})
const periods = computed(() => periodSiblingsOf(props.categories, props.slot?.fieldId ?? null))
// 輸入框後面的單位（元、%、倍、人…），三組型錄的單位都是看得懂的字；「無單位」不顯示
const unit = computed(() => {
  const value = props.slot?.fieldId ? locateFieldInSchema(props.categories, props.slot.fieldId)?.field.unit : undefined
  return value && value !== '無單位' ? value : ''
})
</script>

<template>
  <el-dialog
    :model-value="open"
    :title="title"
    width="min(960px, 100vw)"
    class="condition-panel"
    :class="{ 'condition-panel--range': step === 'range' }"
    modal-class="condition-panel-overlay"
    :align-center="false"
    lock-scroll
    @update:model-value="value => { if (!value) emit('close') }"
    @closed="emit('closed')"
  >
    <div v-if="step === 'list'" ref="listRef">
      <slot name="list" />
    </div>
    <ScreenerIndicatorPickerBody
      v-else-if="step === 'pick'"
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
      v-model:values="slot.values"
      :kind="categorical ? 'categorical' : 'numeric'"
      :options="metric?.options ?? []"
      :unit="unit"
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
        <el-button type="primary" size="large" @click="emit('done')">完成</el-button>
      </div>
    </template>
    <template v-else-if="step === 'pick' && listVisible" #footer>
      <div class="condition-panel__footer">
        <el-button size="large" @click="emit('done')">上一步：條件清單</el-button>
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
  /* 手機底部的安全區留在面板最下緣（設定範圍那一步最下面是按鈕列，不是內容區） */
  padding-bottom: calc(var(--el-dialog-padding-primary, 16px) + env(safe-area-inset-bottom));
  border-radius: 16px 16px 0 0;
}

/* 內距只留焦點框的位置：面板本身已有 16px，內容區再給 16px 就是兩層（2026-10-23，手機上內容被縮成兩邊各 32px） */
.el-dialog.condition-panel .el-dialog__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px;
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

  /* 設定範圍那一步不用那麼寬（2026-10-22，使用者：「設定範圍 這個彈窗 太寬了 請讓他寬度適中」）：兩個輸入框或三欄勾選就夠，
     挑指標那一步照舊 960px */
  .el-dialog.condition-panel.condition-panel--range {
    width: min(600px, 92vw) !important;
  }

  /* 選指標本體在大面板裡拿掉 720px 上限、每欄拉高（同 SharedMetricColumnPicker 的桌機大小） */
  .el-dialog.condition-panel .indicator-dialog {
    max-width: none;
    --indicator-rows: 9.5;
  }
}
</style>
