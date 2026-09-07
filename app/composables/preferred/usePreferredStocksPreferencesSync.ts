// Syncs usePreferredStocksColumnPreferences's `activeColumnPresetId` and `columnOrder` against
// bff-ts's GET/PUT /users/me/preferred-stocks-preferences (confirmed live 2026-09-07 — see
// useUserPreferredStocksPreferences.ts's own comment for the contract), same GET-on-sign-in/
// PUT-on-change pattern as useStockDetailPreferencesSync.ts. Same reasoning as that file: no
// per-field PUT here either — it always overwrites columnPresetId AND columnOrder together —
// so this watches both refs together and sends the combined current state on any change.
//
// Call once, from preferred-stocks/index.vue's own script setup (which already calls
// usePreferredStocksColumnPreferences()) — guarded the same "once per app lifetime, not once
// per call site" way as useStockDetailPreferencesSync.ts's own applying flag.
export function usePreferredStocksPreferencesSync() {
  const { activeColumnPresetId, columnOrder } = usePreferredStocksColumnPreferences()

  const currentUser = useCurrentUser()
  const { fetchPreferredStocksPreferences, putPreferredStocksPreferences } = useUserPreferredStocksPreferences()

  const syncedFromServer = useState('preferred-stocks-preferences-synced-from-server', () => false)
  const applying = useState('preferred-stocks-preferences-applying-started', () => false)
  // Registered with usePostLoginLoader() below — same "genuinely gated on currentUser"
  // reasoning as useStockDetailPreferencesSync.ts's own preferencesSyncPending.
  const preferencesSyncPending = useState('preferred-stocks-preferences-sync-pending', () => false)

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
        const remote = await fetchPreferredStocksPreferences()
        preferencesSyncPending.value = false
        // undefined: fetch failed or genuinely not signed in — leave local state alone.
        if (remote === undefined) return
        applyingRemote = true
        // null on either field = confirmed never saved — bff-ts's own "apply your default"
        // signal, and the local useState defaults are already exactly that.
        if (remote.columnPresetId !== null) activeColumnPresetId.value = remote.columnPresetId
        if (remote.columnOrder !== null) columnOrder.value = backfillColumnOrder(remote.columnOrder)
        applyingRemote = false
      },
      { immediate: true }
    )

    watch(
      [activeColumnPresetId, columnOrder],
      () => {
        if (applyingRemote) return
        if (currentUser.value) {
          putPreferredStocksPreferences({ columnPresetId: activeColumnPresetId.value, columnOrder: columnOrder.value })
        }
      },
      { deep: true, flush: 'sync' }
    )
  })
}
