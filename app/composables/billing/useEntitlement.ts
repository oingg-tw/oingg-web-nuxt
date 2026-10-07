// 這個帳號目前的方案與額度（GET /billing/entitlement，bff-ts）。2026-10-06「完善付費方案」：使用者決定只有
// 免費＋專業版、價格等定價研究、這一輪不收款。
//
// 方案只能差在「能追蹤／儲存多少」（＋之後的歷史深度、匯出推播）——個股分析、篩選結果、資料來源永遠不鎖
// （投信投顧法，conductor docs 09 與 Preset §2.2；bff-ts 的 quota.ts 就是照這條做的）。這裡只讀額度，不鎖內容。
//
// null ＝ 還沒問到或未登入；quotas 裡的 null ＝ 不限。

export type QuotaResource = 'watchlistItems' | 'watchlistColumns' | 'customHoldingColumns' | 'screenerPresets' | 'columnPresets'

export interface Entitlement {
  tier: 'FREE' | 'PRO'
  // subscription：付費中；trial：註冊後 14 天的專業版反向試用；allowlist：開發用；none：免費版
  source: 'subscription' | 'trial' | 'allowlist' | 'none'
  status: string | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  renewalMode: 'AUTOMATIC' | 'MANUAL' | null
  quotas: Partial<Record<QuotaResource, number | null>>
  // 目前用量，跟額度檢查同一個算法（bff-ts 79b4d81）
  usage?: Partial<Record<QuotaResource, number>>
}

export function useEntitlement() {
  const entitlement = useState<Entitlement | null>('billing-entitlement', () => null)
  const authHeader = useAuthHeader()

  async function refresh(): Promise<void> {
    const headers = await authHeader()
    if (!headers) {
      entitlement.value = null
      return
    }
    try {
      entitlement.value = await $fetch<Entitlement>('/billing/entitlement', {
        baseURL: BFF_BASE,
        headers,
        timeout: BFF_REQUEST_TIMEOUT_MS,
        cache: 'no-store'
      })
    } catch (error) {
      // 問不到就當不知道（null）：不擋使用者，伺服器的 403 仍是最後一道
      devWarn('entitlement', 'GET /billing/entitlement unavailable', error)
    }
  }

  const isTrial = computed(() => entitlement.value?.source === 'trial')
  // 試用剩幾天：以台北的日曆日計（到期那天算 0 天＝今天最後一天）
  const trialDaysLeft = computed(() => {
    const end = entitlement.value?.trialEndsAt
    if (!end) return null
    return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000))
  })
  // undefined ＝ 不知道（沒問到）；null ＝ 不限；數字 ＝ 上限
  const quotaOf = (resource: QuotaResource): number | null | undefined =>
    entitlement.value ? entitlement.value.quotas[resource] ?? null : undefined

  return { entitlement, refresh, isTrial, trialDaysLeft, quotaOf }
}

// 登入時：先 GET /users/me，再 GET /billing/entitlement。
//
// **GET /users/me 是建立 User 列的唯一入口**，而 14 天專業版試用是從 User.createdAt 起算——前端在
// 2026-10-06 之前從沒呼叫過它（只打 /users/me/* 子路徑），bff-ts 實測新帳號因此一直是免費版，等於沒有人
// 拿得到試用。這支同時修好那件事。
//
// 跟其他同步一樣必須從 app.vue 呼叫（watcher 綁在註冊它的元件上，頁面離開就被停掉）。
export function useEntitlementSync() {
  const { entitlement, refresh } = useEntitlement()
  const authHeader = useAuthHeader()
  const currentUser = useCurrentUser()
  const authResolved = useAuthResolved()
  const applying = useState('entitlement-sync-applying-started', () => false)
  const pending = useState('entitlement-sync-pending', () => false)

  onMounted(() => {
    if (applying.value) return
    applying.value = true
    usePostLoginLoader().registerPending(pending)

    watch(
      [authResolved, () => currentUser.value?.uid ?? null],
      async ([resolved, uid]) => {
        if (!resolved) return
        if (!uid) {
          entitlement.value = null
          return
        }
        pending.value = true
        const headers = await authHeader()
        if (headers) {
          try {
            await $fetch('/users/me', { baseURL: BFF_BASE, headers, timeout: BFF_REQUEST_TIMEOUT_MS, cache: 'no-store' })
          } catch (error) {
            devWarn('entitlement', 'GET /users/me (provisioning) failed', error)
          }
        }
        await refresh()
        pending.value = false
      },
      { immediate: true }
    )
  })
}
