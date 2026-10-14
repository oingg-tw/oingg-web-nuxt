import type { ComputedRef, MaybeRefOrGetter, Ref, WritableComputedRef } from 'vue'
// 圖表的自訂期間（2026-09-25「如果要納入可以自選時間日期區間」；2026-10-14 抽成共用，同日改成範圍滑桿，使用者：「客製化時間
// 操作那邊有點不順」——原本是從／到兩個 40 項的下拉出現在圖例下方，每改一次都要點開再捲）。
//
// 入口是右上角近N年選單裡的「自訂區間…」（使用者：「希望滑桿是在右上角選擇自訂時間區間再出現」）：選了才出現滑桿，兩端預填正在看的
// 那一段，圖不會在切換的瞬間變空；選回某個近N年就收起來。兩個控制項不能同時說自己在生效（2026-09-26「角落寫近5年、圖畫的是 18 季」）。
//
// 用期別而不是日期：資料本身是季、月或年，日期挑選器會給出不存在的精度。刻度只有這檔真的有的期別，倒過來的區間選不出來。
//
// 內部記 key 不記索引：切換單季↔年度時索引會變、key 不會；兩端不在新清單裡就收起來。key 必須可以直接用字串比大小
//（'2024Q1'、'2024-01'、'2024'），呼叫端給同一種格式。windowed 必須是 all 的尾段（sliceToLookbackWindow 切出來的就是）。
// 近N年選單（SharedLookbackWindowSelect）與範圍滑桿（SharedPeriodRangeSlider）都**必填**這個物件（2026-10-14，使用者：「我前面多次說過
// 要統一改，還是漏掉…怎麼改可以不要漏掉？」——自訂原本是選單的選填屬性，河流圖只放了選單就沒有自訂，型別檢查與頁面檢查都看不出來）。
// 現在少了它 typecheck 會失敗；有選單沒滑桿，scripts/check-period-controls.mjs 會失敗。
export interface CustomPeriodRange {
  keys: ComputedRef<string[]>
  active: ComputedRef<boolean>
  range: WritableComputedRef<[number, number]>
  summary: ComputedRef<string | null>
  labelOf: (key: string) => string
  start: () => void
  stop: () => void
}

export function useCustomPeriodRange<T>(options: {
  // 全部期別（由舊到新）與目前近N年視窗切出來的那一段
  all: Ref<T[]>
  windowed: Ref<T[]>
  keyOf: (item: T) => string
  // 摘要用：key 的顯示文字與計數單位（「季」「個月」）
  labelOf?: (key: string) => string
  unit: MaybeRefOrGetter<string>
}) {
  const labelOf = options.labelOf ?? ((key: string) => key)
  const from = ref<string | null>(null)
  const to = ref<string | null>(null)

  const keys = computed(() => options.all.value.map(options.keyOf))
  const active = computed(() => from.value !== null && to.value !== null)

  // 打開：預填近N年正在畫的那一段
  function start() {
    const shown = options.windowed.value
    from.value = shown.length ? options.keyOf(shown[0]!) : (keys.value[0] ?? null)
    to.value = shown.length ? options.keyOf(shown.at(-1)!) : (keys.value.at(-1) ?? null)
  }
  // 選了固定的近N年就收起來
  function stop() {
    from.value = null
    to.value = null
  }

  // 期別換了（單季↔年度、TTM↔單季），選好的兩端不在新的清單裡就離開自訂，不留一個對不上的區間
  // 空清單是還在讀取（河流圖打開自訂時會改抓更長的一段），不算換了期別
  watch(keys, (list) => {
    if (active.value && list.length && (!list.includes(from.value!) || !list.includes(to.value!))) stop()
  })

  const windowedRange = computed<[number, number]>(() => {
    const last = keys.value.length - 1
    return [Math.max(0, last - options.windowed.value.length + 1), last]
  })

  const range = computed<[number, number]>({
    get: (): [number, number] => (active.value ? [keys.value.indexOf(from.value!), keys.value.indexOf(to.value!)] : windowedRange.value),
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
    if (!active.value) return options.windowed.value
    return options.all.value.filter((item) => {
      const key = options.keyOf(item)
      return key >= from.value! && key <= to.value!
    })
  })

  // 一行就好：顯示哪一段、幾期、這檔總共幾期
  const summary = computed(() => {
    const list = keys.value
    const [start, end] = range.value
    if (list.length < 2 || start < 0 || end < start) return null
    // 數字與單位之間用不斷行空白：窄螢幕上只在「–」兩側、「，」之後或「（」之前換行，不會斷成「（共 / 129 個月）」
    const unit = toValue(options.unit)
    return `${labelOf(list[start]!)} – ${labelOf(list[end]!)}，${end - start + 1}\u00a0${unit}（共\u00a0${list.length}\u00a0${unit}）`
  })

  const period: CustomPeriodRange = { keys, active, range, summary, labelOf, start, stop }
  return { ...period, shown, period }
}
