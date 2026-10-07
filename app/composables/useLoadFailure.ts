// 全站的「讀取失敗」狀態（2026-10-08，使用者：「"數值暫時讀不到，請稍後再看" 這種錯誤訊息請做成全域統一彈窗
// Loader 阻斷瀏覽，而非個別畫面各自出現訊息」）。各頁只回報「哪一份資料讀不到、怎麼重讀」，彈窗
// （AppLoadFailureDialog.vue，掛在 app.vue）負責說明、倒數、自動重試；全部重讀成功才關。
//
// 只收「讀取」失敗。不收：
//   - 整頁 503 的 createError（搜尋引擎要拿到 503，見各 hub 頁）
//   - 「儲存失敗」這類操作回饋（回應的是使用者剛做的動作，而且不能蓋住他正在打的字）
//
// 重試函式放在模組層的 Map、不放 useState：函式進不了 SSR payload。回報只會在瀏覽器發生（watchLoadFailure 在
// 伺服器端直接返回），所以這份 Map 永遠是單一分頁自己的。

export interface LoadFailureEntry extends ClassifiedFailure {
  key: string
}

const retries = new Map<string, () => Promise<unknown>>()

export function useLoadFailureState() {
  const failures = useState<LoadFailureEntry[]>('load-failures', () => [])
  // 這一輪失敗從什麼時候開始（全部恢復後歸零）
  const startedAt = useState<number | null>('load-failures-started-at', () => null)
  return { failures, startedAt }
}

export function reportLoadFailure(key: string, error: unknown, retry: () => Promise<unknown>) {
  const { failures, startedAt } = useLoadFailureState()
  // 只知道「讀不到」、沒有錯誤物件（例如伺服器路由已經把錯誤吃成 null）時，當成暫時連不上
  const classified = error instanceof Object ? classifyApiError(error) : { kind: 'unavailable' as const, status: null, retryAfter: null, requestId: null }
  retries.set(key, retry)
  failures.value = [...failures.value.filter(entry => entry.key !== key), { key, ...classified }]
  startedAt.value ??= Date.now()
}

export function clearLoadFailure(key: string) {
  const { failures, startedAt } = useLoadFailureState()
  retries.delete(key)
  if (!failures.value.some(entry => entry.key === key)) return
  failures.value = failures.value.filter(entry => entry.key !== key)
  if (!failures.value.length) startedAt.value = null
}

// 重讀目前所有失敗的資料。成功與否由各呼叫端自己的 watchLoadFailure 回報（清掉或再報一次）。
export async function retryLoadFailures() {
  await Promise.allSettled([...retries.values()].map(retry => retry()))
}

// 呼叫端的一行接法：`failure` 回傳錯誤物件（或 true＝失敗但沒有錯誤物件；falsy＝沒事）。
// 元件卸載時自動清掉——例如按「回首頁」離開，那一頁的失敗不會留著把彈窗卡住。
export function watchLoadFailure(key: MaybeRefOrGetter<string>, failure: () => unknown, retry: () => Promise<unknown>) {
  if (import.meta.server) return
  watch([() => toValue(key), failure], ([currentKey, current], previous) => {
    const previousKey = previous?.[0]
    if (previousKey && previousKey !== currentKey) clearLoadFailure(previousKey)
    if (current) reportLoadFailure(currentKey, current === true ? null : current, retry)
    else clearLoadFailure(currentKey)
  }, { immediate: true })
  onScopeDispose(() => clearLoadFailure(toValue(key)))
}
