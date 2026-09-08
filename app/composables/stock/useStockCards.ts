export interface StockCardDef {
  id: string
  label: string
  category: string
  required?: boolean
}

// Order here drives both the "顯示卡片" picker's group order AND stock/[code].vue's section
// order. Split 2026-09-07 from the old 3-way (估值河流圖/財務數據/公司資訊) into 6 financial-
// analysis dimensions per direct request ("卡片分成六區 獲利能力 成長動能 財物安全 市場評價
// 獲利品質 股利與現金流") — 財務數據 had become a catch-all bucket for 8 unrelated cards
// (EPS/revenue/share-capital/ex-dividend/roe/roa/dupont×2), which told a user nothing about
// WHY those cards were grouped together. 公司資訊 stays a 7th category on its own — background
// info (industry/incorporation date/etc), not a financial-analysis dimension, doesn't fit any
// of the 6 and was never part of the 財務數據 bucket being split.
//
// Re-ordered and two renamed same day per direct follow-up ("順序變更 股東回饋獲利品質 獲利能力
// 成長動能 財務韌性 市場評價"): 股利與現金流 → 股東回饋, 財務安全 → 財務韌性 (same underlying
// card membership as before, only the category label text and this array's order changed —
// see STOCK_CARD_DEFS below, only its `category` string values were updated to match).
export const STOCK_CARD_CATEGORIES = ['股東回饋', '獲利品質', '獲利能力', '成長動能', '財務韌性', '市場評價', '公司資訊'] as const

// No 'summary' entry here anymore — StockSummaryCard renders unconditionally on the stock
// detail page (never gated behind isVisible), and the picker itself now sits directly on top
// of it (see StockSummaryCard's #actions slot) instead of teleporting off to the sidebar, so
// a disabled "基本資訊（必要）" checkbox in the list below it was just redundant noise: its
// own position already says "this is the card you can't turn off."
//
// '策略評分' (six-axis radar) category removed entirely — its only card (StockRadarChart) was
// driven by literal `Math.round(30 + random()*60)` scores with no real per-stock analysis
// behind them, which read as a genuine評分 to users. Per explicit product direction: don't
// keep fake-looking-real data on this page even gated behind a toggle. Revisit only if/when a
// real per-stock scoring endpoint exists.
// 'share-capital' added 2026-09-04, wired to a real endpoint the same day
// (GET /companies/capital-stock-history — see useCapitalStockHistory.ts). See
// docs/investment-knowledge/基本面財報觀察年限分析.md's own "股權稀釋歷史" section for why this matters to
// a 存股 investor: EPS growth propped up by repeated share dilution isn't real growth, only a
// flat/buyback-shrinking share count is.
//
// 'ex-dividend' added 2026-09-04 as a shell only — twse-ts's export.ex_dividend_notice is real
// (109 rows in prod) but has no public API yet (confirmed with analysis-ts, same situation
// 股本變化 was in before its own endpoint existed). See StockExDividendCardShell.vue.
//
// 'roe'/'roa'/'dupont' added 2026-09-07, wired to analysis-ts's real GET
// /stocks/:symbol/roe-history|roa-history|dupont-history (see StockMetricHistoryChart.vue and
// StockDupontChart.vue's own comments) — no shell phase needed, the backend endpoints already
// existed by the time these cards were added.
//
// 'dupont-extended' added same day once analysis-ts shipped the 5-factor breakdown — a
// separate card from 'dupont' (per direct request: keep both, don't replace), reading the same
// underlying endpoint via StockDupontExtendedChart.vue.
//
// 'roe-composition' added same day per direct request ("個股瀏覽 卡片 獲利品質 多做一張表，
// 這個表是把ROE ROA 權益乘數 放在一起看") after the ROE不能跨產業比較 blog post — ROE/ROA/
// 權益乘數 plotted together, since that comparison (ROE ≈ ROA × 權益乘數) is awkward to
// eyeball across 3 separate line charts. Started as a table, rebuilt into a chart same day
// per direct follow-up ("該卡片請幫我做成 圖表 如同杜邦分析，他們是一個家族的卡片") to match
// StockDupontChart.vue/StockDupontExtendedChart.vue's own visual language. See
// StockRoeCompositionChart.vue's own comment.
//
// 'dupont-factor-levels' added same day per direct request ("我想把 ROE拆解對照與杜邦分析整合，
// 變成 2因子 3因子 4因子 5因子 的變化，請做一張整合表，我好比較") — a NEW, additive 4th card
// (confirmed directly: the other 3 stay, this doesn't replace any of them), showing the same
// underlying dupont-history data as 2/3/4/5-factor decompositions via a factor-count dropdown,
// since all 4 levels reconstruct the exact same ROE by construction. Originally a table
// (period rows × factor columns), converted to a chart later the same week ("table 請換成 圖表
// 比照 杜邦分析") to match this card family's own visual language — label dropped its "表"
// suffix accordingly. See StockDupontFactorLevelChart.vue's own comment for the telescoping
// math.
export const STOCK_CARD_DEFS: StockCardDef[] = [
  { id: 'profile', label: '公司詳細資料', category: '公司資訊' },
  // Added 2026-09-09 per direct request ("個股瀏覽 要有一張卡片，這張卡片有八個面向的徽章") —
  // every real badge in each GURU_BADGE_CATEGORIES slot combined into that category's own tile
  // (see guru-badges.ts's own guruBadgesByCategory), queried live for THIS symbol via
  // POST /screener/values (see useGuruBadgeScores.ts). `category: '公司資訊'` here is only for
  // the PICKER's own grouping —
  // per direct follow-up ("徽章系統請放上面，基本資料下面。他不隸屬於任何分類") stock/[code].vue
  // renders this card standalone, above every category <section> (including 公司資訊's own),
  // not nested inside one — see that file's own comment at the render site.
  { id: 'guru-badges', label: '徽章總覽（八面向）', category: '公司資訊' },
  // 市場評價 — how the market currently prices the stock relative to its own history.
  { id: 'per-river', label: '本益比河流圖', category: '市場評價' },
  { id: 'pbr-river', label: '本淨比河流圖', category: '市場評價' },
  // Added 2026-09-08 per docs/3_audiences/前端工程師/個股瀏覽.md 第5之二節 ("個股瀏覽增加一張
  // 外資持股卡片") — chip/flow data reflecting market participants' actual position changes,
  // not a fundamentals metric, so it sits in 市場評價 alongside the two river charts rather than
  // any of the fundamentals-driven categories. Only 2330 has backfilled data (twse-ts's one-time
  // historical load, not a regular full-market schedule); every other symbol shows an explicit
  // "尚未提供" empty state — see StockForeignShareholdingChart.vue's own comment.
  { id: 'foreign-shareholding', label: '外資持股比例變化', category: '市場評價' },
  // 獲利能力 — how much profit the business generates, and on what base (equity/assets).
  { id: 'eps', label: '四季 EPS', category: '獲利能力' },
  // Labels renamed ROE/ROA 趨勢 → 近四季 ROE/ROA 2026-09-09 per direct correction ("含有趨勢
  // 這個用字不可以") then follow-up ("用中文 近四季") — the card itself is a TTM (trailing-four-
  // quarter) line chart, "趨勢" wasn't the accurate word for what one already-aggregated TTM
  // number per period represents, and 近四季 (not the English "TTM") was the requested wording.
  { id: 'roe', label: '近四季 ROE', category: '獲利能力' },
  { id: 'roa', label: '近四季 ROA', category: '獲利能力' },
  // 成長動能 — whether the top line is actually growing.
  { id: 'revenue', label: '月營收年增率', category: '成長動能' },
  // 財務韌性 — capital-structure/dilution risk (real growth vs share-count inflation).
  { id: 'share-capital', label: '股本變化', category: '財務韌性' },
  // 獲利品質 — WHERE that profit/ROE comes from (margin vs leverage vs turnover), not just
  // how much of it there is — a DuPont breakdown is a quality lens on 獲利能力's own numbers.
  { id: 'dupont', label: '杜邦分析（三因子）', category: '獲利品質' },
  { id: 'dupont-extended', label: '杜邦分析（五因子）', category: '獲利品質' },
  { id: 'roe-composition', label: 'ROE 拆解對照', category: '獲利品質' },
  // Renamed 杜邦拆解對照→杜邦分析 (TTM) 2026-09-09 per direct request.
  { id: 'dupont-factor-levels', label: '杜邦分析 (TTM)', category: '獲利品質' },
  // 5th DuPont-family card, per conductor's docs/3_audiences/前端工程師/個股瀏覽.md 第五節
  // ("按照這邊指示再做一個版本的杜邦拆解卡片") — horizontal metric-card layout (本期 vs 近4期
  // 自身平均 per factor, chained with × connectors), not a line chart like its 3 siblings.
  // Originally fixed at 5 factors/single-quarter data ("五階段指標卡"); extended per direct
  // follow-up to also compute on TTM and offer the same 2/3/4/5-factor level switcher as
  // 'dupont-factor-levels' above (see StockDupontFiveStageMetricCards.vue's own comment) — label
  // updated to match since "五階段" no longer describes its only mode, disambiguated from
  // 'dupont-factor-levels' by "（指標卡）" since both are now "杜邦拆解對照" at heart, just
  // rendered differently (line chart vs metric cards). Defaults to hidden alongside its 3
  // siblings (see DEFAULT_HIDDEN_CARD_IDS below).
  { id: 'dupont-five-stage', label: '杜邦拆解對照（指標卡）', category: '獲利品質' },
  // 股東回饋
  { id: 'ex-dividend', label: '下次除權息', category: '股東回饋' }
]

// Backend-synced as of 2026-09-07 via useStockDetailPreferencesSync.ts (bff-ts's GET/PUT
// /users/me/stock-detail-preferences) — useState here is still the source of truth the UI
// reads/writes moment-to-moment (same as useDashboardCards.ts's own visibleCardIds), the sync
// composable just keeps a signed-in account's saved choice applied on top of it.
// Per direct request ("獲利品質 保留 杜邦拆解對照 就好，其他三個都可以先隱藏") — 'dupont'/
// 'dupont-extended'/'roe-composition' start hidden by default now, leaving only
// 'dupont-factor-levels' visible in that category out of the box. This only changes the
// INITIAL default for a session/account that has never touched this preference before — an
// account with an already-saved choice (bff-ts sync) or an already-populated local useState
// keeps whatever it already had; the backfill loop below only ever ADDS a missing id as
// visible for a newly-introduced card, it never removes one that's already present. Anyone who
// already sees all 4 cards can hide the 3 manually via "顯示卡片".
const DEFAULT_HIDDEN_CARD_IDS = ['dupont', 'dupont-extended', 'roe-composition', 'dupont-five-stage']

export function useStockCards() {
  const visibleCardIds = useState<string[]>('stock-detail-visible-cards', () =>
    STOCK_CARD_DEFS.map(card => card.id).filter(id => !DEFAULT_HIDDEN_CARD_IDS.includes(id))
  )

  // useState's factory only ever runs the first time this key is created — an existing
  // session (or, in dev, an HMR reload that keeps client state around across an edit) that
  // already had this key set before a new card was added to STOCK_CARD_DEFS would otherwise
  // never see that card in visibleCardIds at all, reading as "the user turned it off" even
  // though they never had the chance to. Backfill any def id missing from an already-created
  // list so a newly-added card still defaults to visible. Skips DEFAULT_HIDDEN_CARD_IDS
  // entirely — without this exclusion, this loop ran immediately after the factory above on
  // every FIRST-EVER creation of this state too (not just later HMR/new-card-added reloads),
  // saw the 3 cards deliberately filtered out and read that as "a new card the user never had
  // the chance to see," and pushed them straight back in as visible — silently undoing the
  // filter one line after it ran. Confirmed live: a genuinely fresh browser session/dev-server
  // restart still showed all 4 cards until this exclusion was added.
  for (const def of STOCK_CARD_DEFS) {
    if (DEFAULT_HIDDEN_CARD_IDS.includes(def.id)) continue
    if (!visibleCardIds.value.includes(def.id)) visibleCardIds.value.push(def.id)
  }

  function isVisible(id: string) {
    const def = STOCK_CARD_DEFS.find(card => card.id === id)
    return def?.required || visibleCardIds.value.includes(id)
  }

  return { cardDefs: STOCK_CARD_DEFS, categories: STOCK_CARD_CATEGORIES, visibleCardIds, isVisible }
}
