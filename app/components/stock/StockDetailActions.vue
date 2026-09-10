<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue'
import type { StockCardDef } from '~/composables/stock/useStockCards'

defineProps<{
  cardDefs: StockCardDef[]
  categories: readonly string[]
}>()

const visibleCardIds = defineModel<string[]>('visibleCardIds', { required: true })

// Tucked in here (behind the same gear icon), not its own always-visible control row — per
// direct request ("把模式選擇 塞進顯示卡片中") after the inline radio-group crowded the summary
// card's header at narrow widths. Both options show real, differentiated content now (see
// [code].vue's `experienceMode === 'ACCOUNTING'` branch) — no "開發中" placeholder needed.
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
const draftMode = ref(experienceMode.value)
const draftVisibleCardIds = ref<string[]>([...visibleCardIds.value])

function openSettings() {
  draftMode.value = experienceMode.value
  draftVisibleCardIds.value = [...visibleCardIds.value]
  settingsVisible.value = true
}

function confirmSettings() {
  experienceMode.value = draftMode.value
  visibleCardIds.value = draftVisibleCardIds.value
  settingsVisible.value = false
}
</script>

<template>
  <el-button :icon="Setting" circle title="顯示設定" @click="openSettings" />

  <el-dialog v-model="settingsVisible" title="顯示設定" width="min(480px, 92vw)" align-center>
    <div class="stock-detail-actions__picker">
      <p class="stock-detail-actions__picker-title">顯示模式</p>
      <el-radio-group v-model="draftMode" size="small" class="stock-detail-actions__mode">
        <el-radio-button value="CARD">卡片</el-radio-button>
        <el-radio-button value="ACCOUNTING">會計</el-radio-button>
      </el-radio-group>

      <!-- Hidden (not disabled) in 會計模式 per direct request ("圖示設定的顯示模式只有卡片才
           有底下超多選項，切到會計的時候就不會有") — [code].vue's own ACCOUNTING branch renders
           the raw statement tables instead of any of these 30+ toggleable cards, so this whole
           section has literally nothing to act on until switching back to 卡片. A greyed-out
           block of 30+ disabled checkboxes would still be the dialog's dominant visual weight
           for no reason; hiding it outright keeps the dialog to just the one relevant control.
           Checks the DRAFT mode, not the live one — otherwise unconfirmed changes to 顯示模式
           would immediately show/hide this whole section before 確認 is even pressed. -->
      <template v-if="draftMode === 'CARD'">
        <el-divider class="stock-detail-actions__divider" />

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
      </template>
    </div>

    <template #footer>
      <el-button @click="settingsVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmSettings">確認</el-button>
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

.stock-detail-actions__mode {
  display: flex;
  flex-wrap: wrap;
}

.stock-detail-actions__divider {
  margin: 12px 0;
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

.stock-detail-actions__picker :deep(.el-checkbox) {
  height: 32px;
}
</style>
