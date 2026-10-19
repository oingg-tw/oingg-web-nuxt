<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'
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
  values?: string[]
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
const NON_INFORMATIVE_SOLE_PERIODS = new Set(['daily', 'snapshot'])

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
  const labels = values.map(value => metric.value?.options?.find(option => option.value === value)?.label ?? value)
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
    <!-- 名稱與值包一層：窄的時候在這層裡放不下就換行（值到第二行），寬的時候這層 display: contents，兩顆直接排進膠囊的格子 -->
    <div class="condition-pill__main">
      <!-- title 帶完整名稱：等寬格子裡名稱太長會加刪節號（可及名稱本來就是按鈕上的全名） -->
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
      >{{ valueText }}</button>
    </div>

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
/* 2026-10-19 起膠囊填滿 ScreenerFilters 的等寬格子（使用者選「等寬兩欄」）：
   - 窄（手機）：名稱一行、值一行，兩段都可以再換行、不截斷；✕ 在右邊、跟著膠囊一樣高。以前三段硬擠一行，
     「類股：包含 水泥工業（7）、食品工業（34）等 3 項」這種長的值會把名稱擠成一團、值本身也被切掉（375 量到）。
   - 寬（768px 以上，跟 useIsDesktop 同一個斷點）：名稱｜值｜✕ 一行（grid）。名稱至少 4em、值要多寬給多寬，放不下才加刪節號
     （名稱先讓、全名在 title 與可及名稱裡）——同一列的兩格要一樣高，不能有的換行有的不換。
   44px 高（觸控下限）：名稱、值、移除各自都是夠大的按鈕。 */
.condition-pill {
  display: flex;
  min-height: 44px;
  border: 1px solid var(--el-border-color-lighter);
  /* Squarish rounded corners rather than a fully-rounded capsule shape — slightly softer
     than the original 8px, reads less "boxy" (reported: 看起來醜醜的) without drifting
     toward a full pill/capsule. */
  border-radius: 10px;
  background: var(--el-fill-color-blank);
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.condition-pill:hover {
  border-color: var(--el-color-primary-light-3);
}

.condition-pill--empty {
  border-style: dashed;
}

.condition-pill__main {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  min-width: 0;
}

/* block 而不是 flex：刪節號只對 block 裡的文字有效（flex 容器裡的文字是匿名項目，text-overflow 套不上） */
.condition-pill__field,
.condition-pill__value {
  display: block;
  min-height: 44px;
  padding: 10px 12px;
  font-size: 1rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.condition-pill__field {
  flex: 1 1 auto;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.condition-pill--empty .condition-pill__field {
  color: var(--el-text-color-secondary);
  font-weight: 400;
}

/* Value + remove read as one soft-tinted group, instead of boxes stitched together with hard
   1px divider lines (that literal-boxes look was the main thing behind "看起來醜醜的") — the
   background tint alone marks the boundary. */
/* 窄的時候值固定在第二行、整行寬（每一顆都一樣高、底色整行；只有放不下才換行的話，有的一行有的兩行、底色只到字那麼寬） */
.condition-pill__value {
  flex: 1 1 100%;
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}

@media (min-width: 768px) {
  .condition-pill {
    display: grid;
    grid-template-columns: minmax(4em, 1fr) minmax(0, max-content) 44px;
  }

  .condition-pill__main {
    display: contents;
  }

  .condition-pill__field,
  .condition-pill__value {
    min-height: 0;
    padding: 0 12px;
    line-height: 42px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 還沒選欄位的膠囊沒有值那一格：移除鈕照樣在最後一欄 */
  .condition-pill__remove {
    grid-column: -2;
  }
}

.condition-pill__remove {
  display: flex;
  flex: 0 0 44px;
  align-items: center;
  justify-content: center;
  width: 44px;
  border: none;
  background: var(--el-fill-color-light);
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
