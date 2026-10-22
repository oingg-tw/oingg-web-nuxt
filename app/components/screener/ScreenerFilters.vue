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
// 2026-10-22 再改成一張清單（使用者選設定區方案 B，手機與電腦一起）：每個條件不再各自一個框，列與列之間細線分隔，
// 「＋ 新增條件」是清單最後一列。
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
/* 清單的上緣就是跟「我的篩選」之間的那條線。沒有左右內距：跟上面「我的篩選」、下面的結果切齊。
   container：欄數看這一塊自己的寬度（側欄、滿版或置中模式都對），不是看視窗 */
.screener-filters {
  container-type: inline-size;
  border-top: 1px solid var(--el-border-color-lighter);
}

/* 窄的時候一欄，760px 以上兩欄（兩個最長的條件放得下：危機預警分數那類名稱約 230px＋值約 110px＋移除 44px），
   不再多——使用者選的是兩欄。列與列之間的線在每一列自己的下緣（ScreenerConditionPill） */
.screener-filters__conditions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

@container (min-width: 760px) {
  .screener-filters__conditions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 32px;
  }
}

/* 清單最後一列：主色字、沒有框，「＋」跟上面條件的名稱切齊 */
.screener-filters__add-slot {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--el-color-primary);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
}

.screener-filters__add-slot:hover {
  text-decoration: underline;
  text-underline-offset: 5px;
}
</style>
