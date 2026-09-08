// Split out of useDashboardCards.ts 2026-09-09 — root cause of a real reported bug
// ("儲存功能並未生效 也可能每次都被reset"). This composable's onMounted watchers used to live
// inside useDashboardCards() itself, called only from dashboard.vue's own script setup — a PAGE
// component that unmounts every time the user navigates away from /dashboard. Vue automatically
// stops a watcher that was registered synchronously inside a lifecycle hook when its owning
// component instance unmounts. Confirmed live: the very FIRST time a user left the dashboard
// page after visiting it, both the GET-on-signin watcher (harmless, already one-shot via
// syncedFromServer) AND the PUT-on-change watcher (not harmless) were silently torn down — and
// because the `applying` useState flag persists for the rest of the browser session, no later
// visit to /dashboard ever re-registered them (onMounted's own guard saw applying===true and
// no-opped). Every card-visibility toggle after that first departure updated the local
// visibleCardIds ref but was never PUT to bff-ts — indistinguishable from the toggle silently
// not saving, and a later hard reload would re-fetch the stale last-saved snapshot, reading as
// the preference having been "reset."
//
// Fix: call this composable exactly once, from app.vue (see that file's own useAppTheme() call
// for the identical established pattern) — a component that is mounted for the entire app
// session and never unmounts during SPA navigation, so the watchers it registers live for as
// long as the tab is open. dashboard.vue keeps calling the plain useDashboardCards() for its own
// template bindings (cardDefs/visibleCardIds/isVisible) — that composable no longer touches
// onMounted at all, so calling it from a page component is safe again.
export function useDashboardCardsSync() {
  const { visibleCardIds } = useDashboardCards()

  const currentUser = useCurrentUser()
  const { fetchDashboardCards, putDashboardCards } = useUserDashboardCards()
  const syncedFromServer = useState('dashboard-cards-synced-from-server', () => false)
  const applying = useState('dashboard-cards-applying-started', () => false)
  const cardsSyncPending = useState('dashboard-cards-sync-pending', () => false)

  onMounted(() => {
    if (applying.value) return
    applying.value = true
    usePostLoginLoader().registerPending(cardsSyncPending)

    let applyingRemote = false

    watch(
      currentUser,
      async user => {
        if (!user || syncedFromServer.value) return
        syncedFromServer.value = true
        cardsSyncPending.value = true
        const remote = await fetchDashboardCards()
        cardsSyncPending.value = false
        if (remote === undefined) return
        if (remote === null) return
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
}
