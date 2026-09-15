<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue'
import type { StockCardDef } from '~/composables/stock/useStockCards'

defineProps<{
  cardDefs: StockCardDef[]
  categories: readonly string[]
}>()

const visibleCardIds = defineModel<string[]>('visibleCardIds', { required: true })

// Moved back out to its own always-visible control row 2026-09-12 per direct request ("顯示模式
// 卡片 會計 拉到外層呈現 不要在彈窗裡面") — reversing the 2026-09-10 tuck-into-the-gear-dialog
// call above. Applies immediately (no draft/確認 step) since it's no longer part of the settings
// dialog's own confirm flow.
const { mode: experienceMode } = useStockExperienceMode()

// Real bug fixed 2026-09-10 (reported live: "這裡選項多到不能單純用下拉了，要改成彈窗") — this
// used to be a fixed 280px-wide el-popover, sized fine back when 顯示卡片 only had a handful of
// cards. After today's build-out (30+ cards across 8 categories, see useStockCards.ts's own
// STOCK_CARD_DEFS) the same content in that same small anchored popover was cramped and required
// its own internal scroll inside an already-small box. Promoted to a real el-dialog instead —
// same gear-icon trigger, just opens a properly-sized modal with room to breathe, matching how
// this app already escalates other overflowing pickers from popover to dialog once their content
// outgrows a small anchored box.
const settingsVisible = ref(false)

// Real bug fixed 2026-09-11 (reported live: "顯示設定 要改成 按下 確認 才作用") — every checkbox/
// mode toggle used to write straight through to the live `visibleCardIds`/`experienceMode`
// models via v-model, applying instantly. Now edits a local draft copy instead; the real models
// only get written on 確認. `openSettings` re-seeds the draft from the current live values every
// time the dialog opens (not just once at component creation) so a previous confirm/cancel is
// always the real starting point, not a stale first-mount snapshot. Closing via 取消, the X, or
// the backdrop all discard the draft the same way — none of them touch the real models, so
// there's exactly one path (確認) that ever does.
const draftVisibleCardIds = ref<string[]>([...visibleCardIds.value])

function openSettings() {
  draftVisibleCardIds.value = [...visibleCardIds.value]
  discardConfirmOpen.value = false
  settingsVisible.value = true
}

function confirmSettings() {
  visibleCardIds.value = draftVisibleCardIds.value
  settingsVisible.value = false
}

// Real gap fixed 2026-09-11 per docs/1_extracted/彈窗與對話框 UIUX 設計架構與工程規範研究報告.md
// ("使用者已輸入尚未儲存的表單資料時，必須攔截點擊外部操作並跳出二級確認，避免意外遺失輸入進
// 度") — this dialog is exactly that case (a draft copy that only writes through on 確認, see
// above), but closing via the backdrop/Esc/X used to discard the draft silently, with zero
// warning, same as 取消 always has. Order-independent set comparison (not array equality) since
// draftVisibleCardIds can end up in a different order than visibleCardIds purely from the
// sequence checkboxes were (un)checked in, without that meaning anything actually changed.
const hasUnsavedChanges = computed(
  () =>
    draftVisibleCardIds.value.length !== visibleCardIds.value.length ||
    draftVisibleCardIds.value.some(id => !visibleCardIds.value.includes(id))
)

// Confirms in-place instead of stacking a second dialog (ElMessageBox.confirm on top of this
// already-open one) — this app has a standing rule against popup-on-popup (feedback_no_stacked_
// dialogs memory, 2026-08-30: "永遠避免彈窗再彈窗的設計"), and per direct follow-up here
// ("那個我可以接受...但若是有更好做法我也想聽聽"), swapping THIS dialog's own body/footer to a
// confirm view is the better fit — same single dialog surface throughout, no second overlay ever
// exists. discardConfirmOpen gates which view renders; shared by every dismiss path (X/Esc/
// backdrop via before-close, and the explicit 取消 button) so there's exactly one place that
// decides whether discarding needs a stop first.
const discardConfirmOpen = ref(false)

function requestClose() {
  if (hasUnsavedChanges.value) {
    discardConfirmOpen.value = true
    return
  }
  settingsVisible.value = false
}

function confirmDiscard() {
  discardConfirmOpen.value = false
  settingsVisible.value = false
}

function keepEditing() {
  discardConfirmOpen.value = false
}

function handleBeforeClose(done: () => void) {
  if (hasUnsavedChanges.value) {
    discardConfirmOpen.value = true
    return
  }
  done()
}
</script>

<template>
  <!-- 顯示模式 (卡片/表格/會計) lives here now, outside the 顯示設定 dialog — see experienceMode's
       own script-side comment for why. Applies immediately, unlike the dialog's draft/確認 flow.
       Extracted into StockExperienceModeSelect.vue 2026-09-14 so StockSummaryCard.vue's sticky
       bar can mount the exact same control instead of a second hand-copied radio-group. -->
  <StockExperienceModeSelect size="small" />

  <!-- Disabled (not hidden) outside 卡片模式 per direct request ("會計模式時 顯示設定 要
       disabled") — [code].vue's ACCOUNTING branch renders the raw statement tables and its TABLE
       branch renders StockHistoricalStatisticsTable.vue, neither of which reads from the 30+ toggleable
       cards this dialog picks from, so there is nothing left for it to configure until switching
       back to 卡片. -->
  <el-button :icon="Setting" circle title="顯示設定" :disabled="experienceMode !== 'CARD'" @click="openSettings" />

  <el-dialog v-model="settingsVisible" title="顯示設定" width="min(480px, 92vw)" align-center :before-close="handleBeforeClose">
    <!-- Confirm-discard view — replaces this SAME dialog's own body/footer in place rather than
         stacking a second dialog on top (see discardConfirmOpen's own script-side comment for
         why: this app has a standing rule against popup-on-popup). -->
    <p v-if="discardConfirmOpen" class="stock-detail-actions__discard-message">目前的顯示設定變更尚未確認，關閉後將會遺失。</p>
    <div v-else class="stock-detail-actions__picker">
      <p class="stock-detail-actions__picker-title">顯示卡片</p>
      <el-checkbox-group v-model="draftVisibleCardIds">
        <div v-for="category in categories" :key="category" class="stock-detail-actions__group">
          <p class="stock-detail-actions__group-title">{{ category }}</p>
          <el-checkbox
            v-for="card in cardDefs.filter(c => c.category === category)"
            :key="card.id"
            :value="card.id"
            :label="card.required ? `${card.label}（必要）` : card.label"
            :disabled="card.required"
          />
        </div>
      </el-checkbox-group>
    </div>

    <template #footer>
      <template v-if="discardConfirmOpen">
        <el-button @click="keepEditing">繼續編輯</el-button>
        <el-button type="danger" @click="confirmDiscard">放棄變更</el-button>
      </template>
      <template v-else>
        <el-button @click="requestClose">取消</el-button>
        <el-button type="primary" @click="confirmSettings">確認</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<style scoped>
/* Content now genuinely tall (30+ checkboxes across 8 categories) now that this is a real
   dialog instead of a small anchored popover — caps its own height and scrolls internally
   rather than letting the dialog grow taller than the viewport. Real bug fixed 2026-09-11
   (reported live: "顯示設定的body要可以scroll才可以裝下這麼多卡片的checkboxes") — the
   overflow-y:auto here was already technically in effect (confirmed live: scrollHeight
   genuinely exceeded clientHeight), but with no footer to visually anchor the dialog's own
   bottom edge, the cut-off content at 60vh read as the dialog simply ending, not as "more
   below, scroll for it" — nothing signaled a scrollable region was even there. Adding the
   confirm/cancel footer (see #footer below) gives the dialog a fixed bottom edge to scroll
   inside of, and the extra right padding here keeps the now-more-visible scrollbar from
   overlapping the checkbox labels. */
.stock-detail-actions__picker {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 8px;
}

/* Per direct follow-up 2026-09-11 ("顯示卡片 這附近間距再抓下") — measured live: only 8px
   separated this section title from 市場評價 (the first category's own sub-heading right below
   it), the same gap as a label sitting above its own checkbox — reading as if 顯示卡片 and
   市場評價 were the same rank of heading instead of section title → subsection. */
.stock-detail-actions__picker-title {
  margin: 0 0 14px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.stock-detail-actions__discard-message {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

/* Redesigned 2026-09-11 per direct request ("顯示卡片 請妥善排版 他現在有點擠") — each
   category used to just be a plain inline-flow wrap of checkboxes directly below its title
   (Element Plus's own default el-checkbox display), which packed differently-lengthed labels
   into ragged, inconsistent rows with barely any breathing room between them. A real grid per
   category instead — checkboxes land in clean, aligned columns regardless of label length, with
   deliberate row/column gaps instead of relying on inline whitespace. The title becomes a grid
   item too (spans the full row via grid-column) rather than a sibling block above a separately-
   laid-out flow, so it's one coherent grid per category, not two stacked layout systems. */
.stock-detail-actions__group {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px 16px;
}

.stock-detail-actions__group + .stock-detail-actions__group {
  margin-top: 20px;
}

.stock-detail-actions__group-title {
  grid-column: 1 / -1;
  margin: 0 0 2px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* .el-checkbox-group is the single outer wrapper around every category's own .group div (Vue's
   v-model group binding only needs one shared ancestor, not a direct parent per checkbox) — its
   own children need to stack vertically, one category block per row, independent of the grid
   each individual .group now lays its own checkboxes out in above. */
.stock-detail-actions__picker :deep(.el-checkbox-group) {
  display: flex;
  flex-direction: column;
}

/* Real bug fixed 2026-09-14 (reported live: "顯示設定 不要有左右的scrollbar") — Element Plus's
   own .el-checkbox__label defaults to white-space:nowrap with no min-width override, so any
   category with a longer card label (e.g. one ending in "（必要）") had a min-content width wider
   than its 160px grid track; CSS Grid items default to min-width:auto (a content-based floor),
   so that one long label forced its whole track — and with it the grid, the dialog body, and the
   dialog itself — wider than intended, producing a horizontal scrollbar nothing else in this
   dialog needed. min-width: 0 here lets the grid actually shrink the item below its content's
   natural width; allowing the label to wrap (rather than truncating with an ellipsis) means no
   label text is ever hidden, at the minor cost of a taller row on the rare label that wraps —
   min-height instead of a fixed height accommodates that without clipping.
   */
.stock-detail-actions__picker :deep(.el-checkbox) {
  min-height: 32px;
  min-width: 0;
  align-items: flex-start;
}

.stock-detail-actions__picker :deep(.el-checkbox__label) {
  white-space: normal;
  overflow-wrap: break-word;
  line-height: 1.4;
}
</style>
