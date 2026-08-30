<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import type { ScreenerTab } from '~/composables/useScreenerTabs'

// Pure body content for a SharedPresetFolder — knows nothing about switching between tabs,
// just renders whichever tab it's handed.
const props = defineProps<{
  tab: ScreenerTab
}>()

const emit = defineEmits<{
  addCondition: []
  changeSlotField: [slotId: number]
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
        :style="{ height: `${CONDITIONS_AREA_HEIGHT}px` }"
      >
        <ScreenerOrganismConditionPill
          v-for="slot in tab.slots"
          :key="slot.id"
          v-model:min="slot.min"
          v-model:max="slot.max"
          v-model:exclude="slot.exclude"
          :field-label="slot.fieldLabel"
          @change-field="emit('changeSlotField', slot.id)"
          @remove="emit('removeSlot', slot.id)"
        />
      </div>
      <div v-if="hasOverflowingConditions" class="screener-filters__conditions-fade" />
    </div>

    <button type="button" class="screener-filters__add-slot" @click="emit('addCondition')">
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

.screener-filters__conditions-wrap {
  position: relative;
}

.screener-filters__conditions {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.screener-filters__add-slot:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
</style>
