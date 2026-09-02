export interface DashboardCardDef {
  id: string
  label: string
  category: string
}

export const DASHBOARD_CARD_CATEGORIES = ['排行', '警示'] as const

export const DASHBOARD_CARD_DEFS: DashboardCardDef[] = [
  { id: 'margin-short-ratio', label: '券資比排行前20', category: '排行' },
  { id: 'revenue-ranking', label: '月營收排行', category: '排行' },
  { id: 'volume-top20', label: '成交量前20', category: '排行' },
  { id: 'price-change-ranking', label: '漲跌幅排行', category: '排行' },
  { id: 'attention-stock', label: '今日注意股票', category: '警示' },
  { id: 'disposed-stocks', label: '處置股清單', category: '警示' }
]

// Backend-synced as of 2026-09-02 (bff-ts's GET/PUT /users/me/dashboard-cards, confirmed
// live — see useUserDashboardCards.ts's own comment for the contract). useState is still the
// source of truth the UI reads/writes moment-to-moment (so the picker keeps working instantly
// offline/signed-out, same as before), but a signed-in session now syncs it against the
// account's saved preference once, and persists every local change back — same
// GET-on-sign-in/PUT-on-change pattern as useAppTheme.ts, minus the SSR cookie (a dashboard
// card list flashing to defaults for a moment on load is a much smaller deal than the theme
// flash that justified that machinery there).
export function useDashboardCards() {
  const visibleCardIds = useState<string[]>('dashboard-visible-cards', () =>
    DASHBOARD_CARD_DEFS.map(card => card.id)
  )

  // Backfill any def id missing from an already-created list (existing session, or an HMR
  // reload in dev) so a newly-added card defaults to visible instead of reading as "the user
  // turned it off" when they never had the chance to. Deliberately NOT applied to a list
  // fetched from the server below — see that watcher's own comment for why a saved list is
  // trusted exactly as-is instead.
  for (const def of DASHBOARD_CARD_DEFS) {
    if (!visibleCardIds.value.includes(def.id)) visibleCardIds.value.push(def.id)
  }

  const currentUser = useCurrentUser()
  const { fetchDashboardCards, putDashboardCards } = useUserDashboardCards()
  // Guards the server-preference fetch the same way useAppTheme.ts's syncedFromServer does —
  // once per session, not once per component, never re-fetched just because currentUser
  // happens to re-emit.
  const syncedFromServer = useState('dashboard-cards-synced-from-server', () => false)
  const applying = useState('dashboard-cards-applying-started', () => false)

  onMounted(() => {
    if (applying.value) return
    applying.value = true

    // Set synchronously around the GET-driven assignment below, read by the flush:'sync'
    // watcher right after it — brackets exactly that one assignment so it's never mistaken
    // for a real local change and PUT straight back to the server it just came from.
    let applyingRemote = false

    watch(
      currentUser,
      async user => {
        if (!user || syncedFromServer.value) return
        syncedFromServer.value = true
        const remote = await fetchDashboardCards()
        // undefined: fetch failed or genuinely not signed in — leave local state alone.
        if (remote === undefined) return
        // null: confirmed never saved — bff-ts's own "apply your default" signal. The local
        // useState default is already exactly that, so there's nothing to change.
        if (remote === null) return
        // A real saved list (possibly []) — trust it exactly as given, no backfill. bff-ts
        // stores this as a plain, unvalidated string array (see useUserDashboardCards.ts's
        // own comment), so a card id missing from an old saved list just means "not
        // selected," same as if the user had unchecked it themselves — a card added after
        // their last save stays hidden until they open the picker and turn it on. Mirrors
        // how a customized layout elsewhere wouldn't silently sprout new widgets on its own.
        applyingRemote = true
        visibleCardIds.value = remote
        applyingRemote = false
      },
      { immediate: true }
    )

    watch(
      visibleCardIds,
      next => {
        if (applyingRemote) return
        if (currentUser.value) putDashboardCards(next)
      },
      { deep: true, flush: 'sync' }
    )
  })

  function isVisible(id: string) {
    return visibleCardIds.value.includes(id)
  }

  return { cardDefs: DASHBOARD_CARD_DEFS, categories: DASHBOARD_CARD_CATEGORIES, visibleCardIds, isVisible }
}
