<script setup lang="ts">
import { Close, EditPen } from '@element-plus/icons-vue'
import type { MetricCategory } from '~/composables/screener/useFilterSchema'
// Two halves, two distinct jobs, each reachable exactly one way — no overlap:
// - Front half (the field name) opens the shared field-picker dialog. Same dialog whether
//   this is a brand-new condition getting its first field, or an existing pill having its
//   field swapped for a different one — one dialog, one entry point, never two ways to reach
//   the same outcome.
// - Back half (the value) opens the shared range-editor popover (ScreenerRangeEditor,
//   owned by screener.vue — no longer this component's own; see useScreenerTabs.ts's
//   rangeEditorSlot for why it had to move up a level). Only shown once a field is set —
//   there's nothing to edit a range against before that.
// min/max/exclude are read-only here (display text only) — actually editing them happens in
// the shared popover directly against the real slot object, not through this component.
const props = defineProps<{
  fieldLabel: string | null
  fieldId: string | null
  min: number | null
  max: number | null
  exclude: boolean
  // 類別型條件選的項目（2026-10-15）；數字型不帶
  values?: (string | number)[]
  categories: MetricCategory[]
}>()

const emit = defineEmits<{
  changeField: [triggerEl: HTMLElement]
  openValue: [triggerEl: HTMLElement]
  remove: []
}>()

// Empty (nothing to switch to) for a field with no real period variants — see
// ScreenerRangeEditor, which only renders the switcher once there's an actual choice.
const periods = computed(() => periodSiblingsOf(props.categories, props.fieldId))

// Suppressed for a field with only one period option AND that option is 'daily' (every
// field here is at least daily-granularity, so "每日" states the obvious) or 'snapshot'
// ("最新" — there's no other period to contrast it against, so it doesn't tell you anything
// "設定範圍" alone doesn't already). Only when it's the ONE AND ONLY option, same as daily —
// a field that genuinely offers 最新 alongside other real periods still shows it.
// 型錄的每日是 'EOD'（2026-10-21 改：原本寫 'daily'，型錄裡沒有這個代碼，於是殖利率、市場別這類只有每日的條件都多寫一個「每日」）
const NON_INFORMATIVE_SOLE_PERIODS = new Set(['EOD', 'snapshot'])

const currentPeriodLabel = computed(() => {
  const sole = periods.value.length === 1 ? periods.value[0] : null
  if (sole && NON_INFORMATIVE_SOLE_PERIODS.has(sole.period)) return null
  return periods.value.find(option => option.fieldId === props.fieldId)?.label ?? null
})

// 類別型：顯示選了哪些項目，超過兩個就寫「等 N 項」免得膠囊撐到整行
const metric = computed(() => (props.fieldId ? locateFieldInSchema(props.categories, props.fieldId)?.metric ?? null : null))
const categoricalText = computed(() => {
  const values = props.values ?? []
  if (!values.length) return '選擇項目'
  const labels = values.map(value => metric.value?.options?.find(option => option.value === value)?.label ?? metric.value?.missingOptionLabel ?? value)
  const shown = labels.length > 2 ? `${labels.slice(0, 2).join('、')} 等 ${labels.length} 項` : labels.join('、')
  return `${props.exclude ? '排除' : '包含'} ${shown}`
})

const rangeText = computed(() => {
  if (metric.value?.kind === 'categorical') return categoricalText.value
  if (props.min === null && props.max === null) return '設定範圍'
  if (props.min !== null && props.max !== null) {
    if (props.min === props.max) return `= ${props.min}`
    return props.exclude ? `不在 ${props.min}～${props.max}` : `${props.min}～${props.max}`
  }
  if (props.min !== null) return `≥ ${props.min}`
  return `≤ ${props.max}`
})

// Period now surfaces here rather than on the field-name half — picking a condition's field
// no longer asks for a period up front (see ScreenerIndicatorPickerBody's hidePeriod prop),
// so this is the only place left where it's visible without opening the range editor.
const valueText = computed(() => (currentPeriodLabel.value ? `${currentPeriodLabel.value}  ${rangeText.value}` : rangeText.value))
</script>

<template>
  <div class="condition-pill" :class="{ 'condition-pill--empty': !fieldLabel }">
    <!-- title 帶完整名稱：兩欄時名稱太長會加刪節號（可及名稱本來就是按鈕上的全名） -->
    <button
      type="button"
      class="condition-pill__field"
      :title="fieldLabel ? `${fieldLabel}：變更篩選項目` : '選擇篩選項目'"
      @click="emit('changeField', $event.currentTarget as HTMLElement)"
    >{{ fieldLabel ?? '請選擇篩選項目' }}</button>

    <!-- 可及名稱帶上欄位名：朗讀器聽到的是「ROE：大於 15%」，不是孤零零的「大於 15%」 -->
    <button
      v-if="fieldLabel"
      type="button"
      class="condition-pill__value"
      :title="valueText"
      :aria-label="`${fieldLabel}：${valueText}`"
      @click="emit('openValue', $event.currentTarget as HTMLElement)"
    ><el-icon class="condition-pill__value-icon" aria-hidden="true"><EditPen /></el-icon>{{ valueText }}</button>

    <!-- A real sibling button, not part of either half above — removing a condition doesn't
         need the field picker or range editor to be open first. Icon sits in its own small
         circle rather than the button's full 44px box taking the hover color — the 44px
         itself stays the real clickable/touch area (docs/ui-ux/accessibility-guidelines.md §1.2
         calls out exactly this kind of filter icon-button for that), only the visual hover
         indicator shrinks to avoid a harsh full-rectangle color fill. -->
    <button type="button" class="condition-pill__remove" title="移除條件" :aria-label="`移除條件：${fieldLabel ?? ''}`" @click="emit('remove')">
      <span class="condition-pill__remove-icon">
        <el-icon><Close /></el-icon>
      </span>
    </button>
  </div>
</template>

<style scoped>
/* 條件清單的一列（2026-10-22 使用者選設定區方案 B「一張條件清單」，手機與電腦一起）：原本每個條件各自一個框，手機上名稱一行、
   值一行，5 個條件就比一個畫面還高（721px）。現在不畫框，列與列之間一條細線；名稱｜值｜✕ 一行，跟持股總覽「一個面板、對齊的列」同一套。
   名稱至少 4em、值要多寬給多寬：
   - 一欄（手機）：放不下就在自己那一格折行，不截斷（「五年加權平均股東權益報酬率」折兩行、長的類股值也是）
   - 兩欄（ScreenerFilters 760px 以上）：同一列的兩格要一樣高，不換行、放不下加刪節號（名稱先讓，全名在 title 與可及名稱裡）
   44px 高（觸控下限）：名稱、值、移除各自都是夠大的按鈕。 */
.condition-pill {
  display: grid;
  grid-template-columns: minmax(4em, 1fr) minmax(0, max-content) 44px;
  min-height: 44px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

/* block 而不是 flex：刪節號只對 block 裡的文字有效（flex 容器裡的文字是匿名項目，text-overflow 套不上） */
.condition-pill__field,
.condition-pill__value {
  display: block;
  min-width: 0;
  padding: 10px 12px;
  font-size: 1rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  /* 折行時兩行一樣長：360 寬「股東權益報酬率」原本折成「股東權益報酬／率」 */
  text-wrap: balance;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

/* 名稱貼齊清單左緣（跟上面「我的篩選」的選單切齊） */
.condition-pill__field {
  padding-left: 0;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.condition-pill__field:hover {
  color: var(--el-color-primary);
}

.condition-pill--empty .condition-pill__field {
  color: var(--el-text-color-secondary);
  font-weight: 400;
}

/* 值看起來要能單獨改（2026-10-22，使用者：「condition-pill__main UIUX 樣式要改動 右邊數值的部分 太不像是可以單獨變更了」，方案頁選 3C）：
   值前面一支筆、字下面虛線（滑過變實線）。靠右：名稱左、值右（同卡片「名稱左、數字右」） */
.condition-pill__value {
  color: var(--el-color-primary);
  text-align: right;
  text-decoration: underline dashed;
  text-decoration-thickness: 1px;
  text-underline-offset: 5px;
}

.condition-pill__value:hover,
.condition-pill__value:focus-visible {
  text-decoration-style: solid;
}

.condition-pill__value-icon {
  margin-right: 6px;
  vertical-align: -2px;
}

@container (min-width: 760px) {
  .condition-pill__field,
  .condition-pill__value {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* 還沒選欄位的那一列沒有值那一格：移除鈕照樣在最後一欄 */
.condition-pill__remove {
  grid-column: -2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  border: none;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  /* Without this, the Close icon renders at ~13px instead of matching the pill's own 16px
     scale — <button> doesn't inherit font-size from its ancestors like a normal element
     would (the browser's UA stylesheet gives form controls their own default ~13.3px
     control font instead), and el-icon's svg sizes itself off the button's own font-size
     via 1em. Confirmed live: this button measured font-size: 13.3333px before this rule. */
  font-size: 1rem;
}

/* The button itself stays the full 44px clickable/touch area (see the template comment) —
   only this inner circle's background changes on hover, replacing what used to be a hard
   edge-to-edge rectangle fill with something that reads as a real icon control rather than
   a slab of color. */
.condition-pill__remove-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.condition-pill__remove:hover .condition-pill__remove-icon {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
</style>
