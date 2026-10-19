<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import type { TabFilterSlot } from '~/composables/screener/screener-tab-model'
import type { MetricCategory } from '~/composables/screener/useFilterSchema'

// 條件區：條件膠囊加「新增條件」。三組篩選（普通股、特別股、ETF）共用（2026-10-15），只拿條件本身與型錄，不管是哪一組、
// 存在哪裡。
//
// 2026-10-19 重新設計（使用者：「我選了四個條件…排版看起來就亂亂的」，選了「等寬兩欄」）：條件排成一樣寬的格子，窄的時候一欄、
// 夠寬兩欄，左右切齊。原本是依內容長短的膠囊（flex-wrap），一多就各自長短、兩欄對不齊。「新增條件」是格子的最後一格，
// 手機與桌機同一顆（以前手機那顆要留在 3 列高的捲動框外面才分成兩顆；那個框 2026-10-07 就拿掉了）。
defineProps<{
  slots: TabFilterSlot[]
  categories: MetricCategory[]
}>()

const emit = defineEmits<{
  addCondition: [triggerEl: HTMLElement]
  changeSlotField: [slotId: number, triggerEl: HTMLElement]
  // 膠囊的數值按鈕被點了——編輯器由 useScreenerConditionEditor 擁有（ScreenerRangeEditor 渲染），這裡只回報哪個 slot、錨在哪。
  openValueEditor: [slotId: number, triggerEl: HTMLElement]
  removeSlot: [slotId: number]
}>()
</script>

<template>
  <div class="screener-filters">
    <div class="screener-filters__conditions">
      <ScreenerConditionPill
        v-for="slot in slots"
        :key="slot.id"
        :data-slot-id="slot.id"
        :field-label="slot.fieldLabel"
        :field-id="slot.fieldId"
        :min="slot.min"
        :max="slot.max"
        :exclude="slot.exclude"
        :values="slot.values"
        :categories="categories"
        @change-field="triggerEl => emit('changeSlotField', slot.id, triggerEl)"
        @open-value="triggerEl => emit('openValueEditor', slot.id, triggerEl)"
        @remove="emit('removeSlot', slot.id)"
      />
      <button type="button" class="screener-filters__add-slot" @click="emit('addCondition', $event.currentTarget as HTMLElement)">
        <el-icon><Plus /></el-icon>
        <span>新增條件</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 跟上面的「我的篩選」用一條細線分開。沒有左右內距：外框（ScreenerPageShell 的設定區）已經有 16px。
   container：欄數看這一塊自己的寬度（側欄、滿版或置中模式都對），不是看視窗 */
.screener-filters {
  container-type: inline-size;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

/* 一樣寬的格子：窄的時候一欄，760px 以上兩欄（兩個最長的條件放得下：危機預警分數那類名稱約 230px＋值約 110px＋移除 44px），
   不再多——使用者選的是兩欄 */
.screener-filters__conditions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px 12px;
}

@container (min-width: 760px) {
  .screener-filters__conditions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* 整格寬、虛線框，文字靠左，跟上面條件的名稱對齊 */
.screener-filters__add-slot {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 44px;
  padding: 0 12px;
  border: 1px dashed var(--el-border-color);
  border-radius: 10px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 1rem;
}

.screener-filters__add-slot:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
</style>
