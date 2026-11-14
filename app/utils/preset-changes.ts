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
  // 按了「複製」、還沒儲存的那一列：複製哪一組（id 是暫時的，儲存時才建立）
  copyOf?: string
}

export interface PresetChanges {
  renames: [id: string, name: string][]
  // 要建立的副本：id 是草稿裡的暫時 id，order 裡也是它，建好之後換成真的 id
  copies: { id: string, from: string, name: string }[]
  removals: string[]
  // 留下來的那幾組的新順序；沒動是 null（業務中台 的排序要全部已存的 id，刪除做完才排）。有副本就一定排：副本要排在原本那一組後面
  order: string[] | null
}

export function presetChanges(originalIds: string[], rows: PresetDraftRow[]): PresetChanges {
  const kept = rows.filter(row => !row.removed)
  const order = kept.map(row => row.id)
  const copies = kept.filter(row => row.copyOf).map(row => ({ id: row.id, from: row.copyOf!, name: row.name.trim() }))
  const before = originalIds.filter(id => order.includes(id))
  const moved = copies.length > 0 || order.some((id, index) => id !== before[index])
  return {
    renames: kept.filter(row => row.editable && !row.copyOf && row.name.trim() !== row.original).map(row => [row.id, row.name.trim()]),
    copies,
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

// 管理彈窗按「儲存」之後的套用（篩選頁的我的篩選、顯示欄位，觀察清單與持股的顯示欄位）：一項做完再做下一項。改名 → 複製 → 刪除 →
// 排序：複製要在刪除前（原本那一組可能也要刪），刪除要先做完才排序——業務中台 的排序要「全部已存的 id」，還沒刪掉的那一組不能少；
// 刪到目前這一組時，換選哪一組由各自的 remove 決定。排序裡副本的暫時 id 換成建好的 id，沒建成的拿掉
export interface PresetOps {
  rename(id: string, name: string): Promise<void> | void
  remove(id: string): Promise<void> | void
  reorder(ids: string[]): Promise<void> | void
  copy(id: string, name: string): Promise<string | null>
  select(id: string): void
}
export async function runPresetChanges({ renames, copies, removals, order }: PresetChanges, ops: PresetOps) {
  for (const [id, name] of renames) await ops.rename(id, name)
  const created = new Map<string, string | null>()
  for (const { id, from, name } of copies) created.set(id, await ops.copy(from, name))
  for (const id of removals) await ops.remove(id)
  if (order) await ops.reorder(order.flatMap(id => (created.has(id) ? created.get(id) ?? [] : [id])))
  // 複製出來的那一組，儲存後立刻切過去（2026-11-04，使用者：「藉由複製新增 條件組合以後 確認以後 要立刻切換到該條件組合」）；
  // 一次複製好幾組就切到最後一組
  const lastCopy = [...created.values()].filter(id => id !== null).at(-1)
  if (lastCopy) ops.select(lastCopy)
}
