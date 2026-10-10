<script setup lang="ts">
import type { MetricCategory } from '~/composables/screener/useFilterSchema'

const props = defineProps<{
  modelValue: boolean
  categories: MetricCategory[]
  // The field already on the slot being edited, if any — see ScreenerIndicatorPickerBody,
  // which uses it to jump straight to that field's own 大/中/小 location on open.
  currentFieldId?: string | null
  // The button that opened this (a condition pill's field half, or the table's "+" column
  // header) — only used on desktop, to anchor the dropdown to it. Mobile ignores this and
  // stays fullscreen regardless.
  triggerEl?: HTMLElement | null
  // See ScreenerIndicatorPickerBody's own prop of the same name — true for condition-picking
  // (period moves to the range editor instead), false for column-picking (no range editor to
  // move it into, keeps showing every period variant as its own row).
  hidePeriod: boolean
  // 桌機改成置中的大彈窗，不錨在按鈕旁（2026-10-06，觀察清單：「欄位彈窗的大小偏小，因為這個畫面只有一個
  // 彈窗，是否可以改成置中的彈窗，拉大顯示空間」）。篩選器維持錨定的下拉——那一頁條件與欄位兩種觸發點並存，
  // 錨在按下去的那顆鈕旁邊才看得出是在改哪一個。手機兩者都是全螢幕，不受影響。
  centered?: boolean
  title?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  select: [fieldId: string, fieldLabel: string]
}>()

// Two different UI mechanisms depending on viewport, not just two different sizes of the
// same one: mobile gets a fullscreen modal (see the dialog branch below for why), desktop
// gets a dropdown anchored to whichever button opened it — a fullscreen takeover would be
// overkill on a screen with room to spare, and el-popover has no fullscreen mode to grow
// into on mobile, so this picks between two actually-different wrapper components rather
// than reskinning one via CSS.
const isDesktop = useIsDesktop()

function handleSelect(fieldId: string, fieldLabel: string) {
  emit('select', fieldId, fieldLabel)
  emit('update:modelValue', false)
}

// El-popover's own click/Escape/outside-click handling only engages while it's left
// "uncontrolled" (a plain two-way v-model) — but that also re-enables its own click
// listener on virtual-ref, which races with the click handler elsewhere that opens this in
// the first place (particularly re-clicking a trigger that's already the current one).
// Passing `visible` as a one-way prop (no `update:visible` listener) keeps it fully
// controlled and sidesteps that, at the cost of having to close it ourselves — done here
// for a click outside the panel and the trigger, and for Escape.
const popoverPanelRef = ref<HTMLElement | null>(null)

useDismissOnOutside({
  // 只有錨定下拉需要：置中彈窗沒有 popoverPanelRef，彈窗裡的每一下點擊都會被當成「點在外面」而關掉它
  // （2026-10-06 實測：點中分類，彈窗就關了）。el-dialog 自己處理遮罩點擊與 Esc。
  active: () => props.modelValue && isDesktop.value && !props.centered,
  panel: popoverPanelRef,
  trigger: () => props.triggerEl,
  dismiss: () => emit('update:modelValue', false)
})
</script>

<template>
  <el-popover
    v-if="isDesktop && !centered"
    :visible="modelValue"
    virtual-triggering
    :virtual-ref="triggerEl ?? undefined"
    placement="bottom-start"
    :width="600"
    popper-class="indicator-popover"
  >
    <div ref="popoverPanelRef">
      <ScreenerIndicatorPickerBody
        :categories="categories"
        :current-field-id="currentFieldId"
        :active="modelValue"
        :hide-period="hidePeriod"
        @select="handleSelect"
      />
    </div>
  </el-popover>

  <!-- Fullscreen rather than a content-sized floating box: the dialog's own outer frame
       is then always exactly the viewport, so nothing about it (search results narrowing
       the field list, switching category/metric, an empty-state showing up) can ever
       change ITS size and cause a jump — only the fixed-height columns inside it scroll. -->
  <el-dialog
    v-else
    :model-value="modelValue"
    :title="title ?? '請選擇篩選項目'"
    :fullscreen="!isDesktop"
    :width="isDesktop ? 'min(960px, 92vw)' : undefined"
    lock-scroll
    class="indicator-dialog-modal"
    :class="{ 'indicator-dialog-modal--centered': isDesktop }"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <ScreenerIndicatorPickerBody
      :categories="categories"
      :current-field-id="currentFieldId"
      :active="modelValue"
      :hide-period="hidePeriod"
      @select="handleSelect"
    />
  </el-dialog>
</template>

<style>
/* Both blocks below are unscoped (:deep() can't reach either el-dialog's or el-popover's
   own root, which render outside this component's DOM subtree via teleport). */

/* Matches AppFeatureMenu's fullscreen dialog, which pads its body the same way for the same
   reason (the safe-area inset only matters once content can reach the very bottom edge,
   which fullscreen does and a floating centered dialog never did). */
.indicator-dialog-modal .el-dialog__body {
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}

.indicator-popover.el-popper {
  padding: 8px;
}

/* 置中大彈窗：拿掉挑選器本體的 720px 上限，每一欄從 5.5 列拉高到 9.5 列。三個 class 的特異性是為了
   蓋過本體 scoped 的 .indicator-dialog（含它的 min-width:768px 那一條）。 */
.el-dialog.indicator-dialog-modal--centered .indicator-dialog {
  max-width: none;
  --indicator-rows: 9.5;
}
</style>
