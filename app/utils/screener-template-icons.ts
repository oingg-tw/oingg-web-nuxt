import { CircleCheck, Collection, Coin, DataAnalysis, Histogram, Lock, Money, Odometer, PieChart, Refresh, TrendCharts, Trophy, Umbrella } from '@element-plus/icons-vue'
import type { Component } from 'vue'
import type { ScreenerTemplate } from '~/composables/screener/useScreenerTemplates'
import type { ColumnPresetTemplate } from '~/composables/screener/useScreenerColumnPresets'

// Extracted 2026-09-11 from OrganismNewPresetDialog.vue/OrganismNewColumnPresetDialog.vue once
// OrganismGuestOnboardingDialog.vue needed the exact same icon-per-template lookups for its own
// icon-tile grid — one shared home instead of 3 copies that could drift (2 already had, one now
// added, of the same "match by stable key first, fall back to a Chinese-name keyword regex"
// pattern this app already established for MoleculeIndicatorPickerBody's own iconForCategory).

// GET /screener/templates' own `category` field (大師策略/量化因子/台股籌碼面/存股主題 as of
// writing) — a new category added server-side just falls back to the generic Collection default
// below, no code change needed.
const FILTER_TEMPLATE_CATEGORY_ICONS: Record<string, Component> = {
  大師策略: Trophy,
  量化因子: DataAnalysis,
  台股籌碼面: Histogram,
  存股主題: Coin
}

export function filterTemplateCategoryIcon(category: string): Component {
  return FILTER_TEMPLATE_CATEGORY_ICONS[category] ?? Collection
}

// Per-template icon, distinct from the category grid above — real design gap fixed 2026-09-11
// (reported live: most of GET /screener/templates' 7 free entries share the same 大師策略
// category, so keying off category alone painted almost every tile in the guest onboarding
// dialog's own grid with the identical Trophy icon, defeating the point of an icon grid).
// Matched by the template's own NAME against this app's already-established financial-dimension
// icon vocabulary (guru-badges.ts's own GURU_CATEGORY_ICON) — each strategy's real subject
// (value/volatility/dividend stability/resilience/earnings quality/turnaround/growth) already
// maps cleanly onto one of those 8 dimensions, a much more meaningful signal than which internal
// catalog bucket analysis-ts happened to file it under. Falls back to the category icon (never a
// bare unmatched default) so a future template this list hasn't been updated for still gets a
// reasonable icon instead of none.
const FILTER_TEMPLATE_NAME_KEYWORDS: { pattern: RegExp; icon: Component }[] = [
  { pattern: /價值|安全邊際|低估/, icon: Money },
  { pattern: /波動|穩定|防禦/, icon: Umbrella },
  { pattern: /股利|殖利率|存股|配息/, icon: Coin },
  { pattern: /韌性|風險|預警|地雷|危機/, icon: Lock },
  { pattern: /品質|操縱|保守|真實/, icon: CircleCheck },
  { pattern: /轉機|反轉|困境|翻身/, icon: Refresh },
  { pattern: /成長|動能/, icon: TrendCharts }
]

export function filterTemplateIcon(template: ScreenerTemplate): Component {
  const byName = FILTER_TEMPLATE_NAME_KEYWORDS.find(({ pattern }) => pattern.test(template.name))
  if (byName) return byName.icon
  return filterTemplateCategoryIcon(template.category)
}

// Real bug fixed 2026-09-11 (see OrganismNewColumnPresetDialog.vue's own git history) — rewritten
// against GET /screener/column-preset-templates' real 9 keys (overview/valuation/dividendIncome/
// profitability/dupont/balanceSheetHealth/operatingEfficiency/growth/cashFlowQuality), reusing
// this app's own already-established icon vocabulary for the same financial-analysis dimensions
// (guru-badges.ts's own GURU_CATEGORY_ICON) rather than inventing a second, competing icon set.
const COLUMN_TEMPLATE_ICONS_BY_KEY: Record<string, Component> = {
  overview: Odometer,
  valuation: Money,
  dividendIncome: Coin,
  profitability: PieChart,
  dupont: Histogram,
  balanceSheetHealth: Lock,
  operatingEfficiency: Refresh,
  growth: TrendCharts,
  cashFlowQuality: CircleCheck
}

// Keyword fallback kept for a template bff-ts adds or renames later without this file being
// updated in lockstep — same pattern as MoleculeIndicatorPickerBody's iconForCategory.
const COLUMN_TEMPLATE_ICON_KEYWORDS: { pattern: RegExp; icon: Component }[] = [
  { pattern: /總覽/, icon: Odometer },
  { pattern: /估值|價值|估價|安全邊際/, icon: Money },
  { pattern: /領息|股息|殖利率|存股/, icon: Coin },
  { pattern: /獲利能力/, icon: PieChart },
  { pattern: /拆解|杜邦/, icon: Histogram },
  { pattern: /體質|排雷|風險/, icon: Lock },
  { pattern: /效率|周轉|循環/, icon: Refresh },
  { pattern: /成長/, icon: TrendCharts },
  { pattern: /現金流|品質/, icon: CircleCheck }
]

export function columnPresetTemplateIcon(template: ColumnPresetTemplate): Component {
  const byKey = COLUMN_TEMPLATE_ICONS_BY_KEY[template.key]
  if (byKey) return byKey
  const byKeyword = COLUMN_TEMPLATE_ICON_KEYWORDS.find(({ pattern }) => pattern.test(template.name))
  if (byKeyword) return byKeyword.icon
  if (import.meta.dev) {
    console.warn(`[column-preset-templates] no icon mapped for "${template.name}" (key: ${template.key}) — add one in screener-template-icons.ts`)
  }
  return Trophy
}
