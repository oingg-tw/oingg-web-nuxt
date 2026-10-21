// 個別頁側欄的面向順序（拖曳排序）：ETF 個別頁（2026-10-18，使用者：「這邊的 sidebar 要跟個股瀏覽那邊的 sidebar 一樣可以拖曳排序」）
// 與類股個別頁（2026-10-21）共用。側欄（拖曳）與速覽首頁的卡片照同一份順序；「指標速覽」本身固定在最上面，不傳進來、不參與排序。
// 存在這個瀏覽器（localStorage），不進帳號：個股的自選指標有 /users/me/pinned-metrics，這兩區還沒有對應的端點。伺服器端與第一次渲染
// 用預設順序，掛載後才讀存的順序（不會 hydration 不一致）；讀寫失敗（無痕、封鎖儲存）就照預設。
// ponytail: 只存本機；要跨裝置時請業務中台開一支像 pinned-metrics 的端點，再照 useStockPinnedMetricsSync 接
export function useFacetOrder<F extends { key: string }>(storageKey: string, all: readonly F[]) {
  type Key = F['key']
  const defaults: Key[] = all.map(facet => facet.key)
  const order = useState<Key[]>(storageKey, () => [...defaults])

  onMounted(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
      if (!Array.isArray(saved)) return
      // 存的順序裡下架的面向濾掉，新加的面向接在最後
      const known = saved.filter((key): key is Key => defaults.includes(key))
      order.value = [...known, ...defaults.filter(key => !known.includes(key))]
    } catch {
      // 讀不到就用預設順序
    }
  })

  function move(oldIndex: number, newIndex: number) {
    const next = [...order.value]
    const [moved] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, moved!)
    order.value = next
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // 存不了（無痕、封鎖儲存）：這一頁照新順序，重新整理後回到預設
    }
  }

  const facets = computed(() => order.value.map(key => all.find(facet => facet.key === key)!))
  return { order, facets, move }
}
