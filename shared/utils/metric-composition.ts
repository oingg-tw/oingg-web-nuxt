// 組成段挑期別的規則（StockMetricCompositionSection.vue 的唯一一段非顯而易見的邏輯），以及組成圖的小項併進「其他」（檔尾，StockStackedBarChart 用）。
//
// 抽到 shared/utils 只為了一件事：它要有一個跑得起來的檢查（scripts/check-metric-composition.mjs），
// 而 .vue 裡的 computed 沒辦法從 node 呼叫。元件負責畫，這裡負責決定哪幾期可以畫。

// 母項與各成分各自四捨五入到小數第二位，最壞情況 5 × 0.005 = 0.025。取 0.03，跟
// scripts/check-metric-identities.mjs 同一個數。門檻是從誤差預算推導的，不是照觀測到的最大值訂的。
export const COMPOSITION_TOLERANCE = 0.03

export interface CompositionInput {
  parent: number | null
  parts: (number | null)[]
}

export interface CompositionResult {
  parent: number
  parts: number[]
}

// 通過的條件：母項有值，而且**現有的**成分加起來等於母項。通過之後才把缺的那幾項寫成 0——那是恆等式
// 的結論，不是把 null 當 0 的假設（先檢查再補，不是先補再不檢查）。加不起來、或成分全部缺值，就回 null，
// 呼叫端整期不畫。
export function compositionRow(input: CompositionInput): CompositionResult | null {
  const { parent, parts } = input
  if (parent === null) return null
  const present = parts.filter((value): value is number => value !== null)
  if (!present.length) return null
  const sum = present.reduce((total, value) => total + value, 0)
  // 減 1e-9 而不是直接比：差剛好等於容差時，IEEE754 會讓它變成「略大於」——10 − 9.97 是
  // 0.030000000000000693，於是一個正好用滿進位預算的期別會被浮點噪音擋掉。容差是預算，不是噪音。
  if (Math.abs(sum - parent) - COMPOSITION_TOLERANCE > 1e-9) return null
  return { parent, parts: parts.map(value => value ?? 0) }
}

// ---- 組成圖的小項併進「其他」（2026-11-20）----
// 使用者：「7767 流動資產組成 流動金融資產 在圖表上根本看不到。要盤點當項目的占比多小的時候，就讓它直接合併到其他流動資產。所有類似組成畫面
// 比照此規則」。門檻是量出來的：7767 那張圖每 1% 在手機最高的那根是 2.2px（矮的柱子 1.2px）、桌機 2.7px，每一段又有 1px 卡片底色的分隔線，
// 不到 2% 的段最多剩 3px 的顏色、多數期別 1px 上下，2% 以上才看得出一條。抽 190 檔 921 張組成圖（2026-11-20 DEV），預設區間裡每一期都
// 不到 2% 的項目有 604 個、在 459 張圖上，其中 336 個有同組的「其他」可以併（262 張圖），其餘的那一組沒有「其他」。只在圖上併：表格照列每一項，名字寫成「其他流動資產（含流動金融資產）」，所以圖上的數字跟表格的
// 「其他流動資產」那一欄不會同名不同數。
export const SMALL_LAYER_SHARE = 0.02

export interface StackLayer {
  name: string
  values: number[]
}

// 每一期都不到同方向合計（那一期正的層加總，或負的層加總）SMALL_LAYER_SHARE 的層，併進 others 指定的那一層；全是 0 的層不畫。
// 沒有指定、指定的那一層不在圖上，或它自己也要併到別層，就照畫。順序不變，數字照加，所以每一期的合計不變。
export function foldSmallLayers(layers: StackLayer[], others: Record<string, string> = {}): StackLayer[] {
  const side = (index: number, sign: number) => layers.reduce((sum, layer) => {
    const value = layer.values[index] ?? 0
    return Math.sign(value) === sign ? sum + Math.abs(value) : sum
  }, 0)
  const small = (layer: StackLayer) => layer.values.some(value => value !== 0)
    && layer.values.every((value, index) => value === 0 || Math.abs(value) < SMALL_LAYER_SHARE * side(index, Math.sign(value)))
  const names = new Set(layers.map(layer => layer.name))
  const folded = new Map<string, StackLayer[]>()
  for (const layer of layers) {
    const target = others[layer.name]
    if (!target || !names.has(target) || others[target] || !small(layer)) continue
    folded.set(target, [...(folded.get(target) ?? []), layer])
  }
  const gone = new Set([...folded.values()].flat())
  return layers
    .filter(layer => !gone.has(layer))
    .map((layer) => {
      const sources = folded.get(layer.name)
      if (!sources) return layer
      return {
        name: `${layer.name}（含${sources.map(source => source.name).join('、')}）`,
        values: layer.values.map((value, index) => sources.reduce((sum, source) => sum + (source.values[index] ?? 0), value))
      }
    })
    .filter(layer => layer.values.some(value => value !== 0))
}
