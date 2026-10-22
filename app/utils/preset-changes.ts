// 「我的篩選」管理彈窗的草稿（ScreenerPresetManageDialog）：彈窗裡改的都只是草稿，按「儲存」才變成這幾項變更、由 ScreenerPageShell
// 依序套用。純函式、零 import：scripts/check-preset-changes.mjs 直接驗
export interface PresetDraftRow {
  id: string
  name: string
  // 打開彈窗時的名稱：比對有沒有改名，也是名稱輸入框的標籤
  original: string
  // false＝內建或未儲存的那幾組，不能改名、移動、刪除
  editable: boolean
  // 按了刪除、還沒儲存：那一列留在原位寫「儲存後刪除」
  removed: boolean
}

export interface PresetChanges {
  renames: [id: string, name: string][]
  removals: string[]
  // 留下來的那幾組的新順序；沒動是 null（業務中台 的排序要全部已存的 id，刪除做完才排）
  order: string[] | null
}

export function presetChanges(originalIds: string[], rows: PresetDraftRow[]): PresetChanges {
  const kept = rows.filter(row => !row.removed)
  const order = kept.map(row => row.id)
  const before = originalIds.filter(id => order.includes(id))
  const moved = order.some((id, index) => id !== before[index])
  return {
    renames: kept.filter(row => row.editable && row.name.trim() !== row.original).map(row => [row.id, row.name.trim()]),
    removals: rows.filter(row => row.removed).map(row => row.id),
    order: moved ? order : null
  }
}

// 名稱 1～20 字（同 promptPresetName）。刪掉的、不能改的不檢查。回傳 id → 錯誤訊息
export function presetNameErrors(rows: PresetDraftRow[]): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const row of rows) {
    const length = row.name.trim().length
    if (row.editable && !row.removed && (length < 1 || length > 20)) errors[row.id] = '名稱要 1 到 20 個字'
  }
  return errors
}
