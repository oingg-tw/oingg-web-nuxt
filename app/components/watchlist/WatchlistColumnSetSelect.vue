<script setup lang="ts">
import type { ColumnPresetTemplate } from '~/composables/screener/useScreenerColumnPresets'
import type { WatchlistKind } from '~/composables/watchlist/useWatchlistStocks'
import type { PresetChanges } from '~/utils/preset-changes'

// 觀察清單與持股「指標」每一類的顯示欄位，同篩選結果的「顯示欄位」：下拉、＋新增（官方範本或空白）、管理（改名、複製、刪除、排序）
// （2026-11-14，使用者：「以此類推 持股管理 指標的表格 電腦版 也比照 普通股篩選的作法」「欄位組合也比照確保ux一致性」）。
// 取代原本只能切換的「欄位：組合名」選單。用的那一組＝這一類的預設（useWatchlistColumns）
const props = defineProps<{ kind: WatchlistKind }>()
const columns = useWatchlistColumns()

// 對話框第一次打開才建立：關著的 el-dialog 在伺服器也配一個 z-index，hydration 不一致（同 ScreenerPresetSelect 的管理）
const dialogOpen = ref(false)
const dialogCreated = ref(false)
const templates = ref<ColumnPresetTemplate[]>([])
const templatesLoading = ref(false)
async function openAdd() {
  dialogOpen.value = dialogCreated.value = true
  if (templates.value.length || templatesLoading.value) return
  templatesLoading.value = true
  templates.value = await columns.templatesOf(props.kind)
  templatesLoading.value = false
}

const applyChanges = (changes: PresetChanges) => runPresetChanges(changes, {
  rename: (id, name) => columns.rename(props.kind, id, name),
  remove: id => columns.remove(props.kind, id),
  reorder: ids => columns.reorder(props.kind, ids),
  copy: (id, name) => columns.copy(props.kind, id, name),
  select: id => columns.select(props.kind, id)
})
</script>

<template>
  <ScreenerPresetSelect
    class="watchlist-column-set"
    compact-label="欄位"
    label="顯示欄位"
    add-label="新增欄位組合"
    :items="columns.setItemsOf(kind)"
    :active-id="columns.activeIdOf(kind)"
    @update:active-id="(id: string) => columns.select(kind, id)"
    @add="openAdd"
    @manage="applyChanges"
  />
  <ScreenerNewColumnPresetDialog
    v-if="dialogCreated"
    v-model="dialogOpen"
    :templates="templates"
    :templates-loading="templatesLoading"
    @custom="columns.add(kind)"
    @template="(key: string) => columns.add(kind, key)"
  />
</template>

<style scoped>
/* 靠右（連同後面表格自己的「欄位設定」）：分段標題在左邊，第一次造訪時資料到了才出現，靠左的話這一組會被往右推（2026-11-14
   check-share-links 量到 CLS 0.0012）。手機上這一組照樣撐滿那一行（ScreenerPresetSelect 的 compact） */
.watchlist-column-set {
  margin-left: auto;
}
</style>
