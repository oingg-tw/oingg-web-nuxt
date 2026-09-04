export type DashboardExperienceMode = 'novice' | 'pro'

// Shell only, per explicit user direction (2026-09-04, see project_dashboard_novice_pro_modes
// memory): dashboard.vue must eventually offer two distinct presentation styles — 新手小白
// (simplified) vs 專業大神 (full density) — not one layout for everyone. Nothing downstream
// actually reads this yet (every card still renders the same regardless of mode); this only
// exists so the toggle itself has somewhere to live before the real per-card behavior is
// designed. Defaults to 'pro' since that's what the current single layout already is — picking
// 'novice' as the default would silently change today's behavior for existing users the moment
// this ships, which isn't the point of a placeholder.
export function useDashboardExperienceMode() {
  const mode = useState<DashboardExperienceMode>('dashboard-experience-mode', () => 'pro')
  return { mode }
}
