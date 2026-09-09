export interface DashboardCardDef {
  id: string
  label: string
  category: string
}

export const DASHBOARD_CARD_CATEGORIES = ['排行', '查詢', '追蹤'] as const

// Trimmed 2026-09-02 from 6 to 1 — 券資比排行/成交量前20/漲跌幅排行/今日注意股票/處置股清單
// moved to the new /day-trading page (short-term-trading signals, demoted per the retirement-
// investor repositioning — see dashboard.vue's own comment). A stale id from one of those in
// an existing user's saved visibleCardIds is harmless: dashboard.vue no longer references it
// in its template at all, so it's just an unused string sitting in their preference array —
// no migration needed given bff-ts's own unvalidated-string-array PUT contract.
//
// '追蹤' category added 2026-09-04 for watchlist-ex-dividend — unlike '排行' (cross-market) or
// '查詢' (search-driven, one stock at a time), this card is always scoped to the signed-in
// user's own watchlist with nothing to search or rank against.
export const DASHBOARD_CARD_DEFS: DashboardCardDef[] = [
  { id: 'valuation-ranking', label: '估值排行', category: '排行' },
  { id: 'revenue-ranking', label: '月營收排行', category: '排行' },
  { id: 'stock-health-check', label: '個股健檢', category: '查詢' },
  { id: 'watchlist-ex-dividend', label: '觀察清單近期除權息', category: '追蹤' }
]

// Backend-synced as of 2026-09-02 (bff-ts's GET/PUT /users/me/dashboard-cards, confirmed
// live — see useUserDashboardCards.ts's own comment for the contract). useState is still the
// source of truth the UI reads/writes moment-to-moment (so the picker keeps working instantly
// offline/signed-out, same as before), but a signed-in session now syncs it against the
// account's saved preference once, and persists every local change back — same
// GET-on-sign-in/PUT-on-change pattern as useAppTheme.ts, minus the SSR cookie (a dashboard
// card list flashing to defaults for a moment on load is a much smaller deal than the theme
// flash that justified that machinery there).
//
// State-only now — the sync watchers moved to useDashboardCardsSync() (2026-09-09, see that
// composable's own comment for why: this used to register them here, in an onMounted only ever
// called from dashboard.vue, which unmounts every time the user navigates away from
// /dashboard — Vue auto-stops watchers registered inside a lifecycle hook when their owning
// component instance unmounts, so the very first time a user left the dashboard page, the
// PUT-on-change watcher was silently gone for the rest of the session: every card toggle after
// that point updated the local ref but was never persisted, confirmed live as the reported
// "儲存功能並未生效 也可能每次都被reset" bug). This function itself no longer touches onMounted
// at all.
export function useDashboardCards() {
  const visibleCardIds = useState<string[]>('dashboard-visible-cards', () =>
    DASHBOARD_CARD_DEFS.map(card => card.id)
  )

  // Backfill any def id missing from an already-created list (existing session, or an HMR
  // reload in dev) so a newly-added card defaults to visible instead of reading as "the user
  // turned it off" when they never had the chance to.
  //
  // Real bug fixed 2026-09-09, same root cause as the identical loop in useStockCards.ts (see
  // that file's own comment — found while investigating a live report: "我注意到你每次更新卡片，
  // 我這邊關掉的 ROE ROA 卡片就會自己又打開"): this loop runs on EVERY call to
  // useDashboardCards(), not just once, and the old version had NO way to tell "a genuinely new
  // DASHBOARD_CARD_DEFS entry" apart from "an existing card the user unchecked" — every call
  // just pushed back any def id missing from visibleCardIds, full stop. The comment here used to
  // claim this was "Deliberately NOT applied to a list fetched from the server below," but that
  // was aspirational, not actually true: useDashboardCardsSync() calls useDashboardCards() to
  // get `visibleCardIds`, so this same loop runs again on the very next unrelated component's
  // own call to useDashboardCards() AFTER the remote list has been applied, silently re-adding
  // anything the user had deliberately hidden — then the sync watcher PUT that corrupted list
  // straight back to bff-ts. Same fix as useStockCards.ts: track every id this session has ever
  // known about, separately from visibleCardIds, so only a truly new DASHBOARD_CARD_DEFS entry
  // (unknown as of when this session's knownCardIds was first created) gets auto-added.
  const knownCardIds = useState<string[]>('dashboard-known-cards', () => DASHBOARD_CARD_DEFS.map(card => card.id))

  for (const def of DASHBOARD_CARD_DEFS) {
    if (knownCardIds.value.includes(def.id)) continue
    knownCardIds.value.push(def.id)
    if (!visibleCardIds.value.includes(def.id)) visibleCardIds.value.push(def.id)
  }

  function isVisible(id: string) {
    return visibleCardIds.value.includes(id)
  }

  return { cardDefs: DASHBOARD_CARD_DEFS, categories: DASHBOARD_CARD_CATEGORIES, visibleCardIds, isVisible }
}
