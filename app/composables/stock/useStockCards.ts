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
// '大戶籌碼' added 2026-09-10 per direct request ("Tab 公司資訊 改為 大戶籌碼") — the 公司資訊
// TAB itself was renamed/repurposed (see stock/[code].vue's own comment), so the picker gets a
// matching new category rather than leaving 股本變化/外資持股比例變化 grouped under a "公司資訊"
// heading that no longer describes what's actually in that tab. 公司資訊 stays as its OWN
// category below, now covering only 'profile' (公司詳細資料), which moved out of the tabs
// entirely (renders persistently above the footer) — same "picker grouping ≠ template
// placement" precedent already established for share-capital's own history.
export const STOCK_CARD_CATEGORIES = [...FINANCIAL_ANALYSIS_DIMENSIONS, '營運周轉', '大戶籌碼', '公司資訊'] as const

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
// (GET /companies/capital-stock-history — see docs/investment-knowledge/基本面財報觀察年限分析.md's own
// "股權稀釋歷史" section for why this matters to a 存股 investor: EPS growth propped up by
// repeated share dilution isn't real growth, only a flat/buyback-shrinking share count is).
// REMOVED entirely 2026-09-14 — mops-ts is dropping the whole capitalStock domain (its own
// CapitalStockHistory table + export.capital_stock_history view) along with preferredStock's
// redemption tables: both only ever came from unofficial MOPS ajax endpoints (ajax_t05st05 for
// this one), and mops-ts's own 2026-09-13 sourcing audit found no official replacement across
// TWSE's free open data or any of their 8 paid packages (confirmed live: the underlying
// analysis-ts endpoint will start erroring once the table's gone, not gracefully degrade to an
// empty response — reported live, "會噴錯 請先拿掉"). useCapitalStockHistory.ts and
// StockShareCapitalChart.vue deleted outright, not left as dead code.
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
  // Added 2026-09-15 per直接要求（"我要怎麼設計卡片讓用戶直觀理解差異？逐級拆解營收怎麼變成自由
  // 現金流嗎？" 接著明確為"營收怎麼一步一步變成股利"）— 跟 'profile' 一樣是置底、跨分頁的持續區塊
  // (StockRevenueToDividendBridge.vue)，不屬於任何卡片軌分類，版位固定在公司基本資訊上面，所以
  // 歸在同一個'公司資訊' picker 分類下。
  { id: 'revenue-to-dividend-bridge', label: '營收到股利，錢去了哪裡', category: '公司資訊' },
  // Added 2026-09-09 per direct request ("個股瀏覽 要有一張卡片，這張卡片有八個面向的徽章") as
  // ONE standalone card living above every tab, showing all 8 categories as tiles in a single
  // grid. REBUILT 2026-09-10 per direct follow-up ("徽章系統改為每個面向 比如股東回饋 都有自己的
  // 專門用來呈現徽章的卡片") into per-category cards, each living INSIDE its own category's tab
  // instead of standing apart from all of them. StockGuruBadgeCategoryCard.vue itself renders
  // nothing when a given category still has zero real badges (成長動能/營運周轉/大戶籌碼 today),
  // so adding an id here for every category ahead of time costs nothing and needs no further
  // code change once a real methodology lands in one of those. 大戶籌碼 added same day 公司資訊's
  // tab was renamed to it (see stock/[code].vue's own comment) — now that it's a real tab, it
  // gets the same guru-badges slot every other tab already has.
  { id: 'guru-badges-市場評價', label: '市場評價徽章', category: '市場評價' },
  { id: 'guru-badges-股東回饋', label: '股東回饋徽章', category: '股東回饋' },
  { id: 'guru-badges-獲利品質', label: '獲利品質徽章', category: '獲利品質' },
  { id: 'guru-badges-獲利能力', label: '獲利能力徽章', category: '獲利能力' },
  { id: 'guru-badges-成長動能', label: '成長動能徽章', category: '成長動能' },
  { id: 'guru-badges-財務韌性', label: '財務韌性徽章', category: '財務韌性' },
  { id: 'guru-badges-營運周轉', label: '營運周轉徽章', category: '營運周轉' },
  { id: 'guru-badges-大戶籌碼', label: '大戶籌碼徽章', category: '大戶籌碼' },
  // 市場評價 — how the market currently prices the stock relative to its own history.
  { id: 'per-river', label: '本益比河流圖', category: '市場評價' },
  { id: 'pbr-river', label: '本淨比河流圖', category: '市場評價' },
  // Added 2026-09-08 per docs/3_audiences/前端工程師/個股瀏覽.md 第5之二節 ("個股瀏覽增加一張
  // 外資持股卡片") — chip/flow data reflecting market participants' actual position changes.
  // Moved 市場評價 → 大戶籌碼 2026-09-10 per direct request ("外資持股比例變化 卡片移過去
  // 大戶籌碼") once that tab became a real section — this is the closest thing this site has to
  // actual 大戶籌碼 (institutional/large-holder) data, so it belongs there now, not alongside
  // the two valuation river charts. Only 2330 has backfilled data (twse-ts's one-time historical
  // load, not a regular full-market schedule); every other symbol shows an explicit "尚未提供"
  // empty state — see StockForeignShareholdingChart.vue's own comment.
  { id: 'foreign-shareholding', label: '外資持股比例變化', category: '大戶籌碼' },
  // Added 2026-09-10 per direct request ("個股瀏覽 市場評價 幫我加上 股價歷史卡片") — real
  // daily-resolution OHLCV via bff-ts's daily-price-history proxy, genuinely different from the
  // two river charts above (those are quarter-end snapshots). MERGED with the former 成長動能
  // 'revenue' card (月營收年增率) 2026-09-14 per direct request ("股價歷史卡片 希望與呈現月營收
  // 合併呈現") — see StockPriceRevenueChart.vue's own comment for why this stayed under
  // 市場評價 rather than moving to 成長動能, and why 年增率 dropped from a plotted line to
  // tooltip-only text.
  { id: 'price-history', label: '股價與月營收', category: '市場評價' },
  // A set of 市場評價 cards added 2026-09-14, per card ideas the user asked to be brainstormed
  // then confirmed building — each covers a real analysis-ts metricCode this app never surfaced a
  // dedicated card for before. 3 of the original set were later removed the same day: 'beta'
  // (系統性風險係數) and 'live-valuation'（即時估值 vs 季報凍結）first, then 'market-valuation-
  // info' (a tiles-style snapshot card that had folded beta into itself, mirroring 股東回饋's own
  // 股利資訊 card) was ALSO removed outright per direct follow-up ("現在的 市場評價資訊 整個移
  // 除") — Beta rebuilt 2026-09-14 once bff-ts's GET /market/taiex-daily-price proxy went live,
  // as its own dedicated chart card (StockBetaComparisonChart.vue: 個股股價 vs 加權指數，兩者
  // 指數化到同一基期100比較），不是原本的 tiles 快照卡片。
  { id: 'beta-comparison', label: '個股股價 vs 加權指數', category: '市場評價' },
  { id: 'ev-multiples', label: '現金獲利估值倍數', category: '市場評價' },
  { id: 'yield-family', label: '獲利收益率', category: '市場評價' },
  // 獲利能力 — how much profit the business generates, and on what base (equity/assets).
  { id: 'eps', label: '四季 EPS', category: '獲利能力' },
  // Labels renamed ROE/ROA 趨勢 → 近四季 ROE/ROA 2026-09-09 per direct correction ("含有趨勢
  // 這個用字不可以") then follow-up ("用中文 近四季") — the card itself is a TTM (trailing-four-
  // quarter) line chart, "趨勢" wasn't the accurate word for what one already-aggregated TTM
  // number per period represents, and 近四季 (not the English "TTM") was the requested wording.
  { id: 'roe', label: '近四季 ROE', category: '獲利能力' },
  { id: 'roa', label: '近四季 ROA', category: '獲利能力' },
  // Added 2026-09-09 per direct request ("可以做一個 三率 變化表嗎") — 毛利率/營業利益率/
  // 稅後淨利率, analysis-ts's domainPitMetrics/profitability. 3 same-unit/same-timeframe (%, TTM)
  // ratios on one line chart, see StockMarginsChart.vue's own comment.
  { id: 'margins', label: '三率變化', category: '獲利能力' },
  // Added 2026-09-10 per direct pointer to analysis-ts's famaFrenchOperatingProfitability — see
  // StockFamaFrenchProfitabilityChart.vue's own comment for why this is chart-only, no guru
  // badge (RMW is a relative cross-sectional factor, not an absolute pass/fail bar).
  { id: 'fama-french-profitability', label: 'Fama-French 營業獲利力', category: '獲利能力' },
  // 成長動能 — whether the top line is actually growing.
  // 'revenue' (月營收年增率) MERGED into 市場評價's 'price-history' card 2026-09-14 — see that
  // entry's own comment.
  // Added 2026-09-09 per analysis-ts's own suggestion, relayed and confirmed directly — compares
  // 淨利成長率 vs EPS成長率 (or 淨值成長率 vs BVPS成長率), with shareCountChangeRate as the
  // explanatory bridge: a gap between the pair signals dilution/buyback distorting the
  // per-share number, not real operating growth. Two separate cards (not merged — confirmed
  // directly after an earlier misunderstanding tried pairing 股本變化 with PER/PBR instead,
  // which wasn't what was asked for). See StockGrowthDecompositionChart.vue's own comment.
  { id: 'eps-growth-decomposition', label: 'EPS 成長分解', category: '成長動能' },
  { id: 'equity-growth-decomposition', label: '淨值成長分解', category: '成長動能' },
  // Added 2026-09-10 alongside guru-badges.ts's own new 'sue' badge entry ("兩個都做" — both a
  // badge and a chart, confirmed directly). SUE (Standardized Unexpected Earnings) is a
  // decades-old PEAD literature flagship indicator, Q-only timeframe — see StockSueChart.vue's own
  // comment for the full sourcing.
  { id: 'sue', label: '標準化未預期盈餘 (SUE)', category: '成長動能' },
  // 'share-capital' DELETED 2026-09-14 — see this file's own top-of-file comment (2026-09-04
  // entry) for why: mops-ts dropped the capitalStock domain its data came from entirely.
  // Added 2026-09-10 per direct request ("發想卡片...請開工") — analysis-ts's
  // domainPitMetrics/resilience factor group, split along unit/timeframe lines (same discipline as
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
  // 'dupont'/'dupont-extended'/'roe-composition'/'dupont-five-stage' DELETED 2026-09-10 per
  // direct request ("刪除以下卡片 杜邦分析 (三因子) 杜邦分析 (五因子) ROE拆解對照" then "也刪除
  // 以下卡片 杜邦拆解對照 (指標卡)") — their own component files
  // (StockDupontChart.vue/StockDupontExtendedChart.vue/StockRoeCompositionChart.vue/
  // StockDupontFiveStageMetricCards.vue) removed outright too, not left as dead unused code;
  // confirmed none of the 4 were referenced anywhere else in the app before deleting. Only
  // 'dupont-factor-levels' (杜邦分析) survives from this family. Label dropped its "(TTM)"
  // suffix 2026-09-14 once the card gained its own 單季/近四季 timeframe toggle in the header — the
  // card is no longer TTM-only, so the picker label shouldn't claim it is.
  { id: 'dupont-factor-levels', label: '杜邦分析', category: '獲利品質' },
  // Added 2026-09-09, design confirmed directly — analysis-ts's domainPitMetrics/quality factor
  // group, split along unit lines: ocfPerShare/fcfPerShare/ownerEarnings are all 元/股 (one line
  // chart), accrualsRatio/ocfToNetIncome are %/倍 (own dual-axis card). piotroskiFScore/
  // beneishMScore from the same domain are NOT added here — both already exist as guru badges.
  { id: 'cash-earnings', label: '每股現金獲利', category: '獲利品質' },
  { id: 'accruals-quality', label: '應計品質', category: '獲利品質' },
  // 股東回饋
  // 'ex-dividend' (下次除權息) + 'dividend-stability' (配息穩定度) MERGED into one 'dividend-info'
  // (股利資訊) card 2026-09-14 per direct request ("股東回饋 下次除權息 希望可以跟 配息穩定度
  // 合併呈現，卡片要更名") — see StockDividendInfoCard.vue's own comment. A single card id now
  // covers both; a user who had only one of the two old ids toggled off will see the merged card
  // regardless (no way to preserve that split now that they're one card).
  { id: 'dividend-info', label: '股利資訊', category: '股東回饋' },
  // Added 2026-09-09, design confirmed directly after walking through analysis-ts's
  // domainPitMetrics/dividend factor group (6 metricCodes, 3 different bases). dividendCoverageRatio/
  // buybackYield are both TTM (an actual line chart) — kept as its own card, unlike the
  // dividendYield/dividendPayoutRatio/consecutiveDividendYears snapshot tiles now merged above.
  { id: 'dividend-coverage', label: '配息保障與資本配置', category: '股東回饋' },
  // Added 2026-09-14 per direct request ("幫發想股東回饋卡片呈現") — analysis-ts's own
  // dividendGrowthRate3y/5y/8y family, never surfaced anywhere before this. See
  // StockDividendGrowthRateCard.vue's own comment for why this is a 3-tile stat row rather than
  // a line chart, and its connection to chowderNumber's own formula.
  { id: 'dividend-growth-rate', label: '股利成長率', category: '股東回饋' },
  // Added 2026-09-10 per direct pointer to analysis-ts's chowderNumberDefinition.ts, same
  // session/treatment as SUE — see guru-badges.ts's own 'chowder-number' entry and
  // StockChowderNumberChart.vue's own comment. FY-only timeframe.
  { id: 'chowder-number', label: 'Chowder Number（存股評分）', category: '股東回饋' },
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
// 'dupont'/'dupont-extended'/'roe-composition'/'dupont-five-stage' REMOVED from this list
// 2026-09-10 — those 4 card ids no longer exist at all (deleted outright, see STOCK_CARD_DEFS's
// own comment), not just hidden by default anymore.
// 'bank-capital' stays — only ~19-20 symbols have any real data at all (逾放比率) and as few as
// ~6-7 for the CAR/CET1/Tier1 trio (see StockBankCapitalChart.vue's own comment), so defaulting
// it visible would show an empty card for the overwhelming majority of stocks. Anyone
// researching a bank/financial-holding stock can turn it on via "顯示卡片".
const DEFAULT_HIDDEN_CARD_IDS = ['bank-capital']

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
