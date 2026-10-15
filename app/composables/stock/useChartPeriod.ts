import type { ComputedRef, MaybeRefOrGetter, Ref, WritableComputedRef } from 'vue'
import type { LookbackWindow } from '~/utils/lookback-window'
// 一張圖要畫哪一段期間：右上角的近N年，加上自訂區間的範圍滑桿，合成一份狀態（2026-10-14）。畫面只由 SharedChartCard 負責：
// 圖元件呼叫這支、把回傳值交給 SharedChartCard 的 `period`，自己只拿 `shown` 去畫。
//
// 為什麼合成一支（使用者：「我前面多次說過要統一改，還是漏掉…怎麼改可以不要漏掉？」、「這種東西只能從架構上去優化」）：
// 原本每張圖自己接近N年的收斂／停用／切片，再自己接自訂區間與滑桿，杜邦還有自己一套算法；漏接一塊畫面上看不出來。現在近N年與
// 自訂只有這一份實作，選單與滑桿只寫在 SharedChartCard 裡，沒有「有近N年卻沒自訂」的寫法。
//
// 近N年：讀者的選擇存在 `window`，**每張圖自己一份**（2026-10-15，使用者：「每個圖表的右上角狀態請分開不要共用。禁止一個圖表改變以後，
// 其他圖表連動」——原本預設是跨頁共用的 useState，指標速覽的四張圖會一起變）。畫的時候收斂成這一檔填得滿的最大區間
//（fitLookbackWindow；不覆寫選擇，見 lookback-window.ts）。
// 自訂：右上角選「自訂區間…」才出現滑桿（「希望滑桿是在右上角選擇自訂時間區間再出現」），兩端預填正在看的那一段；選回某個近N年就
// 收起。用期別不用日期：刻度只有這檔真的有的期別。內部記 key 不記索引——切換單季↔年度時索引會變、key 不會；兩端不在新清單裡就收起。
// key 必須可以直接用字串比大小（'2024Q1'、'2024-01'、'2024'），同一張圖給同一種格式。

// SharedChartCard 需要的那一半
export interface ChartPeriod {
  // 選單顯示的近N年（收斂後；連一年都沒有時是讀者的選擇）
  window: ComputedRef<LookbackWindow>
  insufficientYears: ComputedRef<number[]>
  setWindow: (value: LookbackWindow) => void
  active: ComputedRef<boolean>
  start: () => void
  keys: ComputedRef<string[]>
  range: WritableComputedRef<[number, number]>
  summary: ComputedRef<string | null>
  labelOf: (key: string) => string
}

export function useChartPeriod<T>(options: {
  // 這張圖拿得到的全部期別，由舊到新
  all: Ref<T[]>
  keyOf: (item: T) => string
  // 滑桿與摘要用：key 的顯示文字
  labelOf?: (key: string) => string
  // 每年幾期（季 4、月 12、年度 1）
  perYear?: MaybeRefOrGetter<number>
  // 這一檔總共幾期，決定哪些近N年填不滿；預設就是 all 的長度。端點只回傳一段時（指標圖、河流圖）由呼叫端給真正的總數
  total?: MaybeRefOrGetter<number | null>
  // 讀者的近N年選擇。不給就是這張圖自己的一份（預設近5年）；河流圖要在讀資料之前就用到它，所以自己建好傳進來
  window?: Ref<LookbackWindow>
}) {
  const chosen = options.window ?? ref<LookbackWindow>('近5年')
  const perYear = () => toValue(options.perYear) ?? 4
  const total = () => (options.total === undefined ? options.all.value.length : toValue(options.total))
  const labelOf = options.labelOf ?? ((key: string) => key)

  const insufficientYears = computed(() => insufficientLookbackYears(total(), perYear()))
  // null＝連一年都沒有，呼叫端改說「未滿一年」
  const fittedWindow = computed(() => fitLookbackWindow(chosen.value, total(), perYear()))
  const windowed = computed(() => sliceToLookbackWindow(options.all.value, fittedWindow.value, perYear()))

  const from = ref<string | null>(null)
  const to = ref<string | null>(null)
  const keys = computed(() => options.all.value.map(options.keyOf))
  const active = computed(() => from.value !== null && to.value !== null)

  function start() {
    const shown = windowed.value
    from.value = shown.length ? options.keyOf(shown[0]!) : (keys.value[0] ?? null)
    to.value = shown.length ? options.keyOf(shown.at(-1)!) : (keys.value.at(-1) ?? null)
  }
  function stop() {
    from.value = null
    to.value = null
  }
  function setWindow(value: LookbackWindow) {
    stop()
    chosen.value = value
  }

  // 期別換了，選好的兩端不在新清單裡就收起。空清單是還在讀取（河流圖打開自訂時會改抓更長的一段），不算換了期別
  watch(keys, (list) => {
    if (active.value && list.length && (!list.includes(from.value!) || !list.includes(to.value!))) stop()
  })

  const range = computed<[number, number]>({
    get: (): [number, number] => {
      if (active.value) return [keys.value.indexOf(from.value!), keys.value.indexOf(to.value!)]
      const last = keys.value.length - 1
      return [Math.max(0, last - windowed.value.length + 1), last]
    },
    set: ([start, end]: [number, number]) => {
      // 圖要兩點以上才畫得出來：兩個把手疊在一起時撐開一期
      if (end - start < 1) {
        if (end < keys.value.length - 1) end = start + 1
        else start = end - 1
      }
      from.value = keys.value[start] ?? null
      to.value = keys.value[end] ?? null
    }
  })

  const shown = computed(() => {
    if (!active.value) return windowed.value
    return options.all.value.filter((item) => {
      const key = options.keyOf(item)
      return key >= from.value! && key <= to.value!
    })
  })

  const summary = computed(() => {
    const list = keys.value
    const [first, last] = range.value
    if (list.length < 2 || first < 0 || last < first) return null
    // 只寫選到的起訖：總期數與選到的期數 2026-10-15 依直接指示拿掉（「右下角共多少季的資訊全面移除」「滑桿摘要裡的『20 季』也拿掉」）
    return `${labelOf(list[first]!)} – ${labelOf(list[last]!)}`
  })

  const period: ChartPeriod = {
    window: computed(() => fittedWindow.value ?? chosen.value),
    insufficientYears,
    setWindow,
    active,
    start,
    keys,
    range,
    summary,
    labelOf
  }
  return { period, shown, fittedWindow, active }
}
