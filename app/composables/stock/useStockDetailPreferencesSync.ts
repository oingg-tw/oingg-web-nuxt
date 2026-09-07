// Syncs useStockExperienceMode's `mode` and useStockCards's `visibleCardIds` against bff-ts's
// GET/PUT /users/me/stock-detail-preferences (confirmed live 2026-09-07 — see
// useUserStockDetailPreferences.ts's own comment for the contract), same GET-on-sign-in/
// PUT-on-change pattern as useDashboardCards.ts. Unlike useAppTheme.ts's per-field PUT setters
// (setMode/setColor/...), this endpoint has no per-field PUT — it always overwrites mode AND
// visibleCardIds together — so there's no setter to intercept: both v-models
// (StockDetailActions.vue's el-radio-group and el-checkbox-group) write straight to the
// underlying refs, and this watches both together instead, sending the combined current state
// on any change to either.
//
// Call once, from stock/[code].vue's own script setup (which already calls both
// useStockCards() and useStockExperienceMode()) — guarded the same "once per app lifetime, not
// once per call site" way as useAppTheme.ts's own applying flag, so calling this again from
// StockDetailActions.vue too (if it ever needs to) would just no-op rather than double-register
// the watchers.
export function useStockDetailPreferencesSync() {
  const { mode } = useStockExperienceMode()
  const { visibleCardIds } = useStockCards()

  const currentUser = useCurrentUser()
  const { fetchStockDetailPreferences, putStockDetailPreferences } = useUserStockDetailPreferences()

  const syncedFromServer = useState('stock-detail-preferences-synced-from-server', () => false)
  const applying = useState('stock-detail-preferences-applying-started', () => false)
  // Registered with usePostLoginLoader() below — same "genuinely gated on currentUser"
  // reasoning as useAppTheme.ts's own themeSyncPending and useDashboardCards.ts's own
  // cardsSyncPending.
  const preferencesSyncPending = useState('stock-detail-preferences-sync-pending', () => false)

  onMounted(() => {
    if (applying.value) return
    applying.value = true
    usePostLoginLoader().registerPending(preferencesSyncPending)

    // Set synchronously around the GET-driven assignment below, read by the flush:'sync'
    // watcher right after it — brackets exactly that assignment so it's never mistaken for a
    // real local change and PUT straight back to the server it just came from.
    let applyingRemote = false

    watch(
      currentUser,
      async user => {
        if (!user || syncedFromServer.value) return
        syncedFromServer.value = true
        preferencesSyncPending.value = true
        const remote = await fetchStockDetailPreferences()
        preferencesSyncPending.value = false
        // undefined: fetch failed or genuinely not signed in — leave local state alone.
        if (remote === undefined) return
        applyingRemote = true
        // null on either field = confirmed never saved — bff-ts's own "apply your default"
        // signal, and the local useState defaults are already exactly that.
        if (remote.mode !== null) mode.value = remote.mode
        if (remote.visibleCardIds !== null) visibleCardIds.value = remote.visibleCardIds
        applyingRemote = false
      },
      { immediate: true }
    )

    watch(
      [mode, visibleCardIds],
      () => {
        if (applyingRemote) return
        if (currentUser.value) putStockDetailPreferences({ mode: mode.value, visibleCardIds: visibleCardIds.value })
      },
      { deep: true, flush: 'sync' }
    )
  })
}
