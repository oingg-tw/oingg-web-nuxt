import type { MaybeRefOrGetter, Ref } from 'vue'
// 自訂區間（2026-09-25「如果要納入可以自選時間日期區間」，原本只在 StockMetricHistoryChartInteractive；2026-10-14 抽成共用，使用者：
// 「為什麼月營收圖表右上角，沒有自訂時間選項? 之前不是已經統一過了嗎?」——統一過的是近N年選單，自訂只有指標圖有）。
//
// 用期別而不是日期：資料本身是季、月或年，日期挑選器會給出不存在的精度（挑 3/17 跟 3/1 結果一樣，長輩會以為自己點錯）。兩個下拉只列
// 這檔真的有的期別，而且「到」只列「從」之後的——「這段沒有資料」與倒過來的區間根本選不出來，靠結構而不是靠驗證。也不開日曆浮層
//（「看到兩層疊起來就卡住」）。
//
// key 必須可以直接用字串比大小（'2024Q1'、'2024-01'、'2024'），呼叫端給同一種格式。
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
  const open = ref(false)
  const from = ref<string | null>(null)
  const to = ref<string | null>(null)

  const keys = computed(() => options.all.value.map(options.keyOf))
  const toKeys = computed(() => (from.value === null ? keys.value : keys.value.filter(key => key >= from.value!)))
  const active = computed(() => open.value && from.value !== null && to.value !== null)

  // 打開時預填讀者正在看的那一段，圖不會在切換的瞬間變空
  function start() {
    open.value = true
    const shown = options.windowed.value
    from.value = shown.length ? options.keyOf(shown[0]!) : (keys.value[0] ?? null)
    to.value = shown.length ? options.keyOf(shown.at(-1)!) : (keys.value.at(-1) ?? null)
  }
  // 選了固定的近N年就離開自訂——兩個控制項不能同時說自己在生效（「角落寫近5年、圖畫的是 18 季」）
  function stop() {
    open.value = false
  }

  // 期別換了（單季↔年度、TTM↔單季），選好的兩端不在新的清單裡就離開自訂，不留一個對不上的區間
  watch(keys, (list) => {
    if (open.value && (!list.includes(from.value ?? '') || !list.includes(to.value ?? ''))) stop()
  })

  watch(from, (value) => {
    if (value !== null && to.value !== null && to.value < value) to.value = value
  })

  const shown = computed(() => {
    if (!active.value) return options.windowed.value
    return options.all.value.filter((item) => {
      const key = options.keyOf(item)
      return key >= from.value! && key <= to.value!
    })
  })

  const summary = computed(() => (active.value ? `已選 ${labelOf(from.value!)} 到 ${labelOf(to.value!)}，共 ${shown.value.length} ${toValue(options.unit)}` : null))

  return { open, from, to, keys, toKeys, active, shown, summary, labelOf, start, stop }
}
