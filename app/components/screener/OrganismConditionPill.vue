<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'
import { periodSiblingsOf, type FilterCategory } from '~/composables/screener/useFilterSchema'

// Two halves, two distinct jobs, each reachable exactly one way — no overlap:
// - Front half (the field name) opens the shared field-picker dialog. Same dialog whether
//   this is a brand-new condition getting its first field, or an existing pill having its
//   field swapped for a different one — one dialog, one entry point, never two ways to reach
//   the same outcome.
// - Back half (the value) opens the shared range-editor popover (OrganismRangeEditorPopover,
//   owned by screener.vue — no longer this component's own; see useScreenerTabs.ts's
//   rangeEditorSlot for why it had to move up a level). Only shown once a field is set —
//   there's nothing to edit a range against before that.
// min/max/exclude are read-only here (display text only) — actually editing them happens in
// the shared popover directly against the real slot object, not through this component.
const props = defineProps<{
  slotId: number
  fieldLabel: string | null
  fieldId: string | null
  min: number | null
  max: number | null
  exclude: boolean
  categories: FilterCategory[]
}>()

const emit = defineEmits<{
  changeField: [triggerEl: HTMLElement]
  openValue: [triggerEl: HTMLElement]
  remove: []
}>()

// Empty (nothing to switch to) for a field with no real period variants — see
// MoleculeRangeEditor, which only renders the switcher once there's an actual choice.
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

const rangeText = computed(() => {
  if (props.min === null && props.max === null) return '設定範圍'
  if (props.min !== null && props.max !== null) {
    if (props.min === props.max) return `= ${props.min}`
    return props.exclude ? `不在 ${props.min}～${props.max}` : `${props.min}～${props.max}`
  }
  if (props.min !== null) return `≥ ${props.min}`
  return `≤ ${props.max}`
})

// Period now surfaces here rather than on the field-name half — picking a condition's field
// no longer asks for a period up front (see MoleculeIndicatorPickerBody's hidePeriod prop),
// so this is the only place left where it's visible without opening the range editor.
const valueText = computed(() => (currentPeriodLabel.value ? `${currentPeriodLabel.value}  ${rangeText.value}` : rangeText.value))
</script>

<template>
  <div class="condition-pill" :class="{ 'condition-pill--empty': !fieldLabel }">
    <button
      type="button"
      class="condition-pill__field"
      :title="fieldLabel ? '變更篩選項目' : '選擇篩選項目'"
      @click="emit('changeField', $event.currentTarget as HTMLElement)"
    >{{ fieldLabel ?? '請選擇篩選項目' }}</button>

    <button
      v-if="fieldLabel"
      type="button"
      class="condition-pill__value"
      @click="emit('openValue', $event.currentTarget as HTMLElement)"
    >{{ valueText }}</button>

    <!-- A real sibling button, not part of either half above — removing a condition doesn't
         need the field picker or range editor to be open first. Icon sits in its own small
         circle rather than the button's full 44px box taking the hover color — the 44px
         itself stays the real clickable/touch area (docs/ui-ux/accessibility-guidelines.md §1.2
         calls out exactly this kind of filter icon-button for that), only the visual hover
         indicator shrinks to avoid a harsh full-rectangle color fill. -->
    <button type="button" class="condition-pill__remove" title="移除條件" aria-label="移除條件" @click="emit('remove')">
      <span class="condition-pill__remove-icon">
        <el-icon><Close /></el-icon>
      </span>
    </button>
  </div>
</template>

<style scoped>
/* 44px tall throughout (not the 36px this used to be) so the field half, value half, and
   remove button each clear the project's icon-button touch-target guideline on their own,
   not just the WCAG 24px floor. */
.condition-pill {
  display: inline-flex;
  align-items: stretch;
  /* The parent list (.screener-filters__conditions) is a column flex box with a fixed
     height, meant to scroll once there are more than 3 conditions — but flex items default
     to flex-shrink: 1, so without this, the browser shrinks every pill's height to cram
     them all into that fixed box instead of ever letting it overflow and scroll. */
  flex-shrink: 0;
  height: 44px;
  max-width: 100%;
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

/* The pill sits in a flex column (.screener-filters__conditions) with default
   align-items: stretch, so it's always already the full row width — without the field
   segment itself growing to fill that box too, the value/remove segments were left
   floating at their natural size with dead space after them instead of the remove button
   sitting flush against the pill's actual right edge. */
@media (max-width: 767px) {
  .condition-pill {
    width: 100%;
  }
}

.condition-pill__field,
.condition-pill__value {
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border: none;
  background: transparent;
  cursor: pointer;
  /* Buttons center their content by default — matters once condition-pill__field grows to
     fill extra width (mobile, or the empty placeholder state) instead of staying
     content-sized. */
  text-align: left;
}

.condition-pill__field {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* Matches useIsDesktop's own 768px breakpoint (already what this component switches its
   popover/dialog choice on) — a long field name (e.g. "淨負債對 EBITDA 比") should show in
   full on one line rather than ellipsis-truncating, but WITHOUT wrapping to a second line or
   growing the pill's height (a first attempt at this did both — corrected per feedback).
   width: max-content (not the mobile flex: 1) sizes the pill to exactly what its content
   needs. This only works because OrganismFilters.vue's desktop conditions row switched from
   a minmax(280px, 1fr) grid to flex-wrap — a grid track's width comes from the grid's own
   column-sizing, not its item's content, so max-content here would have had no room to
   actually grow into under the old layout.
   Deliberately NO min-width floor (an earlier version had 280px, matching the old grid's own
   minimum) — .condition-pill__field's flex: none below means nothing inside the pill grows
   to absorb that extra width, so a short field name (e.g. "ROE") left as dead empty space
   after the remove button instead of looking "cramped" — reported as 跑版 (broken layout),
   not the intended "short pills get a comfortable minimum" outcome. Pure content-sized pills
   avoid that entirely. */
@media (min-width: 768px) {
  .condition-pill {
    width: max-content;
  }

  .condition-pill__field {
    flex: none;
  }
}

.condition-pill--empty .condition-pill__field {
  color: var(--el-text-color-secondary);
  font-weight: 400;
}

/* Value + remove read as one soft-tinted group now, instead of three boxes stitched
   together with hard 1px divider lines (that literal-boxes look was the main thing behind
   "看起來醜醜的") — the background tint alone marks the boundary, no border-left needed. */
.condition-pill__value {
  flex-shrink: 0;
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}

.condition-pill__remove {
  display: flex;
  flex-shrink: 0;
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
  font-size: 16px;
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
