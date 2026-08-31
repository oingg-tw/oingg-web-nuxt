<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import type { ScreenerTab } from '~/composables/useScreenerTabs'
import type { FilterCategory } from '~/composables/useFilterSchema'

// Pure body content for a SharedPresetFolder — knows nothing about switching between tabs,
// just renders whichever tab it's handed.
const props = defineProps<{
  tab: ScreenerTab
  categories: FilterCategory[]
}>()

const emit = defineEmits<{
  addCondition: []
  changeSlotField: [slotId: number, triggerEl: HTMLElement]
  changeSlotPeriod: [slotId: number, fieldId: string]
  removeSlot: [slotId: number]
}>()

// The scroll area is reserved at exactly 3 pills' worth of height (3 × 44px pill + 2 × 8px
// gap) whether or not there are that many yet — a tab going from 1 to 2 to 3 conditions
// never grows this box, so nothing below it reflows either. Only once a 4th is added does
// it actually need to scroll, which is also the only time the "there's more" fade makes
// sense to show.
const CONDITIONS_AREA_HEIGHT = 3 * 44 + 2 * 8
const hasOverflowingConditions = computed(() => props.tab.slots.length > 3)
</script>

<template>
  <div class="screener-filters">
    <div class="screener-filters__conditions-wrap">
      <div
        class="screener-filters__conditions no-scrollbar"
        :style="{ '--conditions-area-height': `${CONDITIONS_AREA_HEIGHT}px` }"
      >
        <ScreenerOrganismConditionPill
          v-for="slot in tab.slots"
          :key="slot.id"
          v-model:min="slot.min"
          v-model:max="slot.max"
          v-model:exclude="slot.exclude"
          :field-label="slot.fieldLabel"
          :field-id="slot.fieldId"
          :categories="categories"
          @change-field="triggerEl => emit('changeSlotField', slot.id, triggerEl)"
          @change-period="fieldId => emit('changeSlotPeriod', slot.id, fieldId)"
          @remove="emit('removeSlot', slot.id)"
        />
        <!-- Desktop-only: lives inside the grid as one more (content-width, not stretched)
             item alongside the pills instead of its own separate full-width row below — see
             the mobile-vs-desktop pair of add-slot buttons further down for why there are
             two of these instead of repositioning one via CSS. -->
        <button type="button" class="screener-filters__add-slot screener-filters__add-slot--grid" @click="emit('addCondition')">
          <el-icon><Plus /></el-icon>
          <span>新增條件</span>
        </button>
      </div>
      <div v-if="hasOverflowingConditions" class="screener-filters__conditions-fade" />
    </div>

    <!-- Mobile-only counterpart of the button above — kept as a genuinely separate DOM node
         (each hidden via CSS at the other breakpoint) rather than one button repositioned
         with CSS, since mobile's version needs to stay OUTSIDE the height-capped/scrolling
         conditions area (unchanged from before) while desktop's needs to be INSIDE the grid
         — two fundamentally different containers to belong to, not just two different
         visual positions of the same box. -->
    <button type="button" class="screener-filters__add-slot screener-filters__add-slot--full" @click="emit('addCondition')">
      <el-icon><Plus /></el-icon>
      <span>新增條件</span>
    </button>
  </div>
</template>

<style scoped>
.screener-filters {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
}

/* SharedPresetFolder's own body gains this same 16px on desktop (see PresetFolder.vue) —
   dropped here so the two don't stack into a doubled 32px inset there. Mobile keeps its own
   padding since the folder body stays unpadded at that width. */
@media (min-width: 768px) {
  .screener-filters {
    padding: 0;
  }
}

.screener-filters__conditions-wrap {
  position: relative;
}

.screener-filters__conditions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: var(--conditions-area-height);
  overflow-y: auto;
}

.screener-filters__conditions.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.screener-filters__conditions.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.screener-filters__conditions-fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 20px;
  background: linear-gradient(to top, var(--el-bg-color), rgba(30, 30, 30, 0));
  pointer-events: none;
}

/* Desktop has the width to spare, so conditions lay out as a wrapping row (each pill sized
   to its own content, at least 280px — see OrganismConditionPill.vue's own min-width) instead
   of mobile's single scrolling column — the same N conditions take fewer rows this way, so
   the fixed "3 rows" height cap and its scroll/fade affordance (needed on a cramped mobile
   column) are dropped in favor of just growing to fit however many rows it ends up with.
   flex-wrap rather than a minmax(280px, 1fr) grid on purpose: a CSS Grid track's width comes
   from the grid's own column-sizing function, not its item's content, so a pill with a long
   field name (e.g. "淨負債對 EBITDA 比") had no way to grow past its track's share — it just
   wrapped to a second line or got clipped regardless of how the pill itself was styled.
   flex-wrap lets each pill claim exactly the width its own content needs. */
@media (min-width: 768px) {
  .screener-filters__conditions {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    height: auto;
    overflow-y: visible;
  }

  .screener-filters__conditions-fade {
    display: none;
  }
}

.screener-filters__add-slot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 44px;
  padding: 0 12px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 16px;
}

/* Mobile shows the standalone full-width button below the list; desktop shows the one living
   inside the conditions row instead — see the template comments for why these are two
   separate buttons rather than one repositioned via CSS. Sizes to its own content naturally
   in the flex-wrap layout below (no justify-self needed the way the earlier grid layout
   required, since flex items don't stretch along the main axis by default the way grid
   items stretch to fill their cell). */
.screener-filters__add-slot--grid {
  display: none;
}

@media (min-width: 768px) {
  .screener-filters__add-slot--full {
    display: none;
  }

  .screener-filters__add-slot--grid {
    display: inline-flex;
  }
}

.screener-filters__add-slot:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
</style>
