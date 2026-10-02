// 「資料夾式預設」三份清單共用的 CRUD（ETF 的欄位預設與條件預設、特別股的欄位預設）。
//
// 2026-10-02 抽出來。原本三份各寫一次，而在同日修掉 reorder 會靜默丟掉預設、remove 會跳回第一個
// 這兩個 bug 之後，三份的 `removePreset` 與 `reorderPresets` 變成**一字不差，連三十行註解都一樣**
// ——那兩段註解記錄的是踩過的坑，複製三份等於把坑也複製三份，而第四個預設清單就是第四份。
//
// 只管 id／name／順序／哪一個作用中這四件事。payload 本身（`columns`、`filters`）留給各自的
// wrapper 用 `patchPreset` 塞回去：三份的欄位名不同，硬要泛型化只會多一層欄位對映，比省下來的多。
//
// 全部是 `useState`、沒有後端也沒有 localStorage（三份原本的註解都寫著「等 bff-ts 有
// /etf-screener/presets 之類的資源再接」），所以換掉 id 的產生方式不影響任何已存的資料。
export interface LocalPreset {
  id: string
  name: string
}

// `crypto.randomUUID()` 而不是 `Math.random().toString(36)`：ETF 那兩份原本用後者取 8 碼
// base36（約 41 bits），對五個預設當然夠，但兩種寫法長度一樣，就取不會碰撞的那個。
// fallback 是給沒有 crypto 的環境（實務上只有很舊的瀏覽器與某些測試環境）。
export function makePresetId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `preset-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useLocalPresets<P extends LocalPreset>(stateKey: string, activeKey: string, seed: () => P[]) {
  const presets = useState<P[]>(stateKey, seed)
  const activePresetId = useState<string>(activeKey, () => presets.value[0]!.id)

  const activePreset = computed(() => presets.value.find(preset => preset.id === activePresetId.value) ?? presets.value[0]!)

  function addPreset(preset: P): P {
    presets.value = [...presets.value, preset]
    activePresetId.value = preset.id
    return preset
  }

  function renamePreset(id: string, name: string) {
    patchPreset(id, { name } as Partial<P>)
  }

  // 永遠保留至少一個：刪掉最後一個會重新播種預設值，而不是留下一個空資料夾
  // （PresetFolder.vue 本身假設至少有一項，也沒有為零個預設設計的空狀態）。
  function removePreset(id: string) {
    const index = presets.value.findIndex(preset => preset.id === id)
    if (index === -1) return
    const remaining = presets.value.filter(preset => preset.id !== id)
    presets.value = remaining.length ? remaining : seed()
    // 刪掉作用中的那個時，跳到**原本位置**的鄰居而不是跳回第一個。刪第五個卻跳到第一個，
    // 對讀者是毫無理由的位置跳動。
    if (activePresetId.value === id) {
      const fallbackIndex = Math.min(index, presets.value.length - 1)
      activePresetId.value = presets.value[fallbackIndex]!.id
    }
  }

  function reorderPresets(ids: string[]) {
    const byId = new Map(presets.value.map(preset => [preset.id, preset]))
    const reordered = ids.map(id => byId.get(id)).filter((preset): preset is P => preset !== undefined)
    // `ids` 沒涵蓋到的預設要留在最後，不能靜默丟掉。ETF 那兩份原本寫
    // `ids.map(id => byId.get(id)!).filter(Boolean)`——那個 `!` 騙過 TypeScript，`filter(Boolean)`
    // 再把 undefined 刪掉，所以**任何不在 ids 裡的預設就消失了**（2026-10-02 修）。
    // PresetFolder 的 reorder 本來會送出完整的 id 清單，所以這是防守而不是現行路徑。
    const missing = presets.value.filter(preset => !ids.includes(preset.id))
    presets.value = [...reordered, ...missing]
  }

  function patchPreset(id: string, patch: Partial<P>) {
    presets.value = presets.value.map(preset => (preset.id === id ? { ...preset, ...patch } : preset))
  }

  return { presets, activePresetId, activePreset, addPreset, renamePreset, removePreset, reorderPresets, patchPreset }
}
