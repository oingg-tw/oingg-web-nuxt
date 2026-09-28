// 組成段挑期別的規則（StockMetricCompositionSection.vue 的唯一一段非顯而易見的邏輯）。
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
