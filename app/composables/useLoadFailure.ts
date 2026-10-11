// 全站的「讀取失敗」狀態（2026-10-08，使用者：「"數值暫時讀不到，請稍後再看" 這種錯誤訊息請做成全域統一彈窗
// Loader 阻斷瀏覽，而非個別畫面各自出現訊息」）。各處只回報「哪一份資料讀不到、怎麼重讀」，AppLoadFailureDialog
// （掛在 app.vue）負責說明、倒數、自動重試。
//
// 2026-10-11 重做（使用者：「太容易跳出來了，而且也不會自關掉」）：
//   - **寬限期**：回報後先在背景默默重試（GRACE_RETRIES_MS），8 秒內恢復就什麼都不顯示。本機上游冷快取常超過 10 秒逾時，
//     5 秒後再打通常就好——原本第一次失敗就開阻斷彈窗，使用者看到的是閃一下。
//   - **scope**：'page'＝頁面的主要內容，撐過寬限期才開阻斷彈窗；'section'＝卡片、圖、型錄這類次要資料，只出右下角的
//     非阻斷提示。使用者選「主要資料阻斷、次要不阻斷」。
//   - **4xx 不登記**：4xx 是這個請求的正常答案（不存在、條件不合法），由頁面自己說。原本會疊一個重試不會好的彈窗。
//   - **擁有者計數**：同一個鍵可能有很多呼叫端（指標型錄約 20 處）。原本其中一處卸載或恢復就清掉整個鍵。
//
// 只收「讀取」失敗。不收：整頁 503 的 createError（搜尋引擎要拿到 503，見各 hub 頁）；「儲存失敗」這類操作回饋。
// 重試函式放在模組層的 Map、不放 useState：函式進不了 SSR payload。回報只會在瀏覽器發生，所以這些 Map 是單一分頁自己的。

export type LoadFailureScope = 'page' | 'section'

export interface LoadFailureEntry extends ClassifiedFailure {
  key: string
  scope: LoadFailureScope
  // 這個鍵第一次失敗的時間；寬限期從這裡算
  since: number
}

export const LOAD_FAILURE_GRACE_MS = 8_000
// 寬限期內的背景重試時間點（從第一次失敗起算）
const GRACE_RETRIES_MS = [1_500, 4_000]

const retries = new Map<string, () => Promise<unknown>>()
// 鍵 → 目前回報失敗的擁有者
const owners = new Map<string, Set<number>>()
const graceTimers = new Map<string, ReturnType<typeof setTimeout>[]>()
// 正在重試的鍵：重試一開始，大部分來源的失敗狀態會暫時變成「沒事」（load() 先清 failure、useAsyncData 進 pending），
// 這時移除條目會讓寬限期重算、寬限重試被取消、「先關閉」的記錄被清掉。所以重試期間只記下擁有者走了，等重試結束再看
const inFlight = new Set<string>()
let ownerSeq = 0

export function useLoadFailureState() {
  const failures = useState<LoadFailureEntry[]>('load-failures', () => [])
  // 這一輪失敗從什麼時候開始（全部恢復後歸零）
  const startedAt = useState<number | null>('load-failures-started-at', () => null)
  return { failures, startedAt }
}

function removeEntry(key: string) {
  retries.delete(key)
  for (const timer of graceTimers.get(key) ?? []) clearTimeout(timer)
  graceTimers.delete(key)
  const { failures, startedAt } = useLoadFailureState()
  if (!failures.value.some(entry => entry.key === key)) return
  failures.value = failures.value.filter(entry => entry.key !== key)
  if (!failures.value.length) startedAt.value = null
}

async function runRetry(key: string) {
  const retry = retries.get(key)
  if (!retry || inFlight.has(key)) return
  inFlight.add(key)
  try {
    await retry()
  } catch {
    // 結果由呼叫端的 watchLoadFailure 回報
  } finally {
    // 等呼叫端的 watch 把重試結果回報完
    await nextTick()
    inFlight.delete(key)
    if (!owners.get(key)?.size) removeEntry(key)
  }
}

function reportLoadFailure(key: string, error: unknown, retry: () => Promise<unknown>, scope: LoadFailureScope, owner: number) {
  // 只知道「讀不到」、沒有錯誤物件（例如伺服器路由已經把錯誤吃成 null）時，當成暫時連不上
  const classified = error instanceof Object ? classifyApiError(error) : { kind: 'unavailable' as const, status: null, retryAfter: null, requestId: null }
  if (classified.kind === 'client') {
    clearLoadFailure(key, owner)
    return
  }
  const { failures, startedAt } = useLoadFailureState()
  retries.set(key, retry)
  owners.set(key, (owners.get(key) ?? new Set<number>()).add(owner))
  const existing = failures.value.find(entry => entry.key === key)
  // 同一個鍵有一處是 page 就算 page
  const mergedScope: LoadFailureScope = existing?.scope === 'page' || scope === 'page' ? 'page' : 'section'
  const since = existing?.since ?? Date.now()
  failures.value = [...failures.value.filter(entry => entry.key !== key), { key, scope: mergedScope, since, ...classified }]
  startedAt.value ??= Date.now()
  if (!existing) graceTimers.set(key, GRACE_RETRIES_MS.map(delay => setTimeout(() => runRetry(key), delay)))
}

function clearLoadFailure(key: string, owner: number) {
  const set = owners.get(key)
  set?.delete(owner)
  if (set?.size) return
  owners.delete(key)
  if (!inFlight.has(key)) removeEntry(key)
}

// 重讀目前所有失敗的資料。成功與否由各呼叫端自己的 watchLoadFailure 回報（清掉或再報一次）。
export async function retryLoadFailures() {
  await Promise.all([...retries.keys()].map(runRetry))
}

// 呼叫端的一行接法：`failure` 回傳錯誤物件（或 true＝失敗但沒有錯誤物件；falsy＝沒事）。
// 元件卸載時只清掉自己那一份——同一個鍵別人還在失敗就保留。
export function watchLoadFailure(
  key: MaybeRefOrGetter<string>,
  failure: () => unknown,
  retry: () => Promise<unknown>,
  options: { scope?: LoadFailureScope } = {}
) {
  if (import.meta.server) return
  const owner = ++ownerSeq
  watch([() => toValue(key), failure], ([currentKey, current], previous) => {
    const previousKey = previous?.[0]
    if (previousKey && previousKey !== currentKey) clearLoadFailure(previousKey, owner)
    if (current) reportLoadFailure(currentKey, current === true ? null : current, retry, options.scope ?? 'page', owner)
    else clearLoadFailure(currentKey, owner)
  }, { immediate: true })
  onScopeDispose(() => clearLoadFailure(toValue(key), owner))
}
