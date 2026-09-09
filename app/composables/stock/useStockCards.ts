import { FINANCIAL_ANALYSIS_DIMENSIONS } from '~/utils/financial-analysis-dimensions'

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
//
// The 6 shared dimensions now come from FINANCIAL_ANALYSIS_DIMENSIONS (also used by
// guru-badges.ts's own GURU_BADGE_CATEGORIES) rather than being repeated here as an independent
// list, per direct request 2026-09-09 ("stock-guru-badge-card__grid 這邊的排序 以及 個股瀏覽排序
// 也比照") — the two used to be hand-kept-in-sync hardcoded arrays with no mechanism actually
// enforcing that, the same drift risk that broke the screener's own category order (see
// MoleculeIndicatorPickerBody.vue's own sortedCategories comment). 公司資訊 stays this file's
// own extra 7th category on top of the shared base (GURU_BADGE_CATEGORIES adds two different
// ones instead, 營運周轉/大戶籌碼).
// '營運周轉' added 2026-09-10 per direct request ("Tab加一頁 營運效率") — briefly renamed to
// "營運效率" the same day (matching analysis-ts's own same-day screener taxonomy rename, commit
// 2c45346) then reverted back to '營運周轉' per direct follow-up, to match guru-badges.ts's own
// existing category of the same name (see that file's own GURU_BADGE_CATEGORIES comment) —
// the two pickers are allowed their own extra category on top of the shared
// FINANCIAL_ANALYSIS_DIMENSIONS base by design, but landed on the same wording here anyway.
export const STOCK_CARD_CATEGORIES = [...FINANCIAL_ANALYSIS_DIMENSIONS, '營運周轉', '公司資訊'] as const

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
  // Added 2026-09-09 per direct request ("可以做一個 三率 變化表嗎") — 毛利率/營業利益率/
  // 稅後淨利率, analysis-ts's domainPitMetrics/profitability. 3 same-unit/same-basis (%, TTM)
  // ratios on one line chart, see StockMarginsChart.vue's own comment.
  { id: 'margins', label: '三率變化', category: '獲利能力' },
  // 成長動能 — whether the top line is actually growing.
  { id: 'revenue', label: '月營收年增率', category: '成長動能' },
  // Added 2026-09-09 per analysis-ts's own suggestion, relayed and confirmed directly — compares
  // 淨利成長率 vs EPS成長率 (or 淨值成長率 vs BVPS成長率), with shareCountChangeRate as the
  // explanatory bridge: a gap between the pair signals dilution/buyback distorting the
  // per-share number, not real operating growth. Two separate cards (not merged — confirmed
  // directly after an earlier misunderstanding tried pairing 股本變化 with PER/PBR instead,
  // which wasn't what was asked for). See StockGrowthDecompositionChart.vue's own comment.
  { id: 'eps-growth-decomposition', label: 'EPS 成長分解', category: '成長動能' },
  { id: 'equity-growth-decomposition', label: '淨值成長分解', category: '成長動能' },
  // 財務韌性 — capital-structure/dilution risk (real growth vs share-count inflation).
  { id: 'share-capital', label: '股本變化', category: '財務韌性' },
  // Added 2026-09-10 per direct request ("發想卡片...請開工") — analysis-ts's
  // domainPitMetrics/resilience factor group, split along unit/basis lines (same discipline as
  // every other multi-metric card family this session): altmanZScore/ohlsonOScore/
  // zmijewskiScore are NOT here — already guru badges. equityMultiplier NOT here — already on
  // StockDupontChart.vue/StockRoeCompositionChart.vue. See each card's own comment for why its
  // particular metricCode grouping/axis choice.
  { id: 'liquidity', label: '短期流動性', category: '財務韌性' },
  { id: 'leverage', label: '長期槓桿', category: '財務韌性' },
  { id: 'debt-coverage', label: '償債能力（現金流角度）', category: '財務韌性' },
  { id: 'bank-capital', label: '銀行資本適足性', category: '財務韌性' },
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
  // Added 2026-09-09, design confirmed directly — analysis-ts's domainPitMetrics/quality factor
  // group, split along unit lines: ocfPerShare/fcfPerShare/ownerEarnings are all 元/股 (one line
  // chart), accrualsRatio/ocfToNetIncome are %/倍 (own dual-axis card). piotroskiFScore/
  // beneishMScore from the same domain are NOT added here — both already exist as guru badges.
  { id: 'cash-earnings', label: '每股現金獲利', category: '獲利品質' },
  { id: 'accruals-quality', label: '應計品質', category: '獲利品質' },
  // 股東回饋
  { id: 'ex-dividend', label: '下次除權息', category: '股東回饋' },
  // Added 2026-09-09, design confirmed directly after walking through analysis-ts's
  // domainPitMetrics/dividend factor group (6 metricCodes, 3 different bases). Split into 2
  // cards along basis lines rather than 1: dividendYield(EOD)/dividendPayoutRatio(TTM)/
  // consecutiveDividendYears(FY) don't share a time axis (snapshot tiles), while
  // dividendCoverageRatio/buybackYield are both TTM (an actual line chart). See
  // StockDividendStabilityCard.vue/StockDividendCoverageChart.vue's own comments.
  { id: 'dividend-stability', label: '配息穩定度', category: '股東回饋' },
  { id: 'dividend-coverage', label: '配息保障與資本配置', category: '股東回饋' },
  // 營運周轉 — added 2026-09-10 per direct request ("Tab加一頁 營運周轉"), analysis-ts's
  // domainPitMetrics/efficiency factor group. Split along unit lines (次/天/%), same discipline
  // as every other multi-metric card family this session. See each card's own comment.
  { id: 'turnover-ratio', label: '存貨／應收／應付週轉率', category: '營運周轉' },
  { id: 'cash-conversion-cycle', label: '現金轉換循環 (CCC)', category: '營運周轉' },
  { id: 'asset-utilization', label: '資產利用效率', category: '營運周轉' },
  { id: 'capex-intensity', label: '資本支出佔營收比', category: '營運周轉' }
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
// 'bank-capital' added to this list 2026-09-10 — only ~19-20 symbols have any real data at all
// (逾放比率) and as few as ~6-7 for the CAR/CET1/Tier1 trio (see StockBankCapitalChart.vue's own
// comment), so defaulting it visible would show an empty card for the overwhelming majority of
// stocks. Anyone researching a bank/financial-holding stock can turn it on via "顯示卡片".
const DEFAULT_HIDDEN_CARD_IDS = ['dupont', 'dupont-extended', 'roe-composition', 'dupont-five-stage', 'bank-capital']

export function useStockCards() {
  const visibleCardIds = useState<string[]>('stock-detail-visible-cards', () =>
    STOCK_CARD_DEFS.map(card => card.id).filter(id => !DEFAULT_HIDDEN_CARD_IDS.includes(id))
  )

  // useState's factory only ever runs the first time this key is created — an existing
  // session (or, in dev, an HMR reload that keeps client state around across an edit) that
  // already had this key set before a new card was added to STOCK_CARD_DEFS would otherwise
  // never see that card in visibleCardIds at all, reading as "the user turned it off" even
  // though they never had the chance to. Backfill any def id missing from an already-created
  // list so a newly-added card still defaults to visible.
  //
  // Real bug fixed 2026-09-09 (reported live: "我注意到你每次更新卡片，我這邊關掉的 ROE ROA
  // 卡片就會自己又打開"): this loop used to just check `!visibleCardIds.value.includes(def.id)`
  // directly (skipping only DEFAULT_HIDDEN_CARD_IDS) — but that can't tell "id missing because
  // STOCK_CARD_DEFS genuinely grew a new entry" apart from "id missing because the user
  // unchecked an EXISTING card via 顯示卡片" (roe/roa aren't in DEFAULT_HIDDEN_CARD_IDS, so a
  // manual uncheck of either looked identical to a brand-new card to this loop). Confirmed live:
  // this loop runs on EVERY call to useStockCards() (every component mount, every HMR reload
  // while developing this file), not just once — so any deliberately-hidden card outside
  // DEFAULT_HIDDEN_CARD_IDS got silently pushed back into visibleCardIds the next time ANY
  // component on the page called this composable, and useStockDetailPreferencesSync.ts's own
  // flush:'sync' watcher then PUT that corrupted list straight back to bff-ts — turning a local
  // rendering quirk into a real, persisted loss of the user's saved preference.
  //
  // Fix: track every card id this session has ever known about, separately from
  // visibleCardIds, so "genuinely new" can be told apart from "already known, just hidden."
  // Bootstraps to the FULL current STOCK_CARD_DEFS id list (not the DEFAULT_HIDDEN-filtered
  // visible one) so nothing already shipped reads as new the first time this runs — only an id
  // added to STOCK_CARD_DEFS AFTER knownCardIds was first created (a later HMR reload in dev, or
  // a new deploy for an existing session) is treated as new.
  const knownCardIds = useState<string[]>('stock-detail-known-cards', () => STOCK_CARD_DEFS.map(card => card.id))

  for (const def of STOCK_CARD_DEFS) {
    if (knownCardIds.value.includes(def.id)) continue
    knownCardIds.value.push(def.id)
    if (DEFAULT_HIDDEN_CARD_IDS.includes(def.id)) continue
    if (!visibleCardIds.value.includes(def.id)) visibleCardIds.value.push(def.id)
  }

  function isVisible(id: string) {
    const def = STOCK_CARD_DEFS.find(card => card.id === id)
    return def?.required || visibleCardIds.value.includes(id)
  }

  return { cardDefs: STOCK_CARD_DEFS, categories: STOCK_CARD_CATEGORIES, visibleCardIds, isVisible }
}
