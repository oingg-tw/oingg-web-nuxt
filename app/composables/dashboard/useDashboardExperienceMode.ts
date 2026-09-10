export type DashboardExperienceMode = 'novice' | 'pro'

// dashboard.vue's own 簡易/專家模式 toggle (which this was originally built for, 2026-09-04) was
// REMOVED 2026-09-10 per direct request ("總覽 dashboard 不再區分 簡易模式 與 專家模式") — see
// dashboard.vue's own comment for why. This composable is NOT deleted alongside it:
// preferred-stocks/[code].vue independently reads/writes the exact same shared state for its own
// unrelated pro-gated content (bond-market terminology sections), so it's still live there.
// Defaults to 'pro' since that's the fuller-detail layout — unchanged from the original reasoning.
export function useDashboardExperienceMode() {
  const mode = useState<DashboardExperienceMode>('dashboard-experience-mode', () => 'pro')
  return { mode }
}
