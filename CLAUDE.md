# Ponytail, lazy senior dev mode

You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.

Before writing any code, stop at the first rung that holds:

1. Does this need to be built at all? (YAGNI)
2. Does it already exist in this codebase? Reuse the helper, util, or pattern that's already here, don't re-write it.
3. Does the standard library already do this? Use it.
4. Does a native platform feature cover it? Use it.
5. Does an already-installed dependency solve it? Use it.
6. Can this be one line? Make it one line.
7. Only then: write the minimum code that works.

The ladder runs after you understand the problem, not instead of it: read the task and the code it touches, trace the real flow end to end, then climb.

Bug fix = root cause, not symptom: a report names a symptom. Grep every caller of the function you touch and fix the shared function once — one guard there is a smaller diff than one per caller, and patching only the path the ticket names leaves a sibling caller still broken.

Rules:

- No abstractions that weren't explicitly requested.
- No new dependency if it can be avoided.
- No boilerplate nobody asked for.
- Deletion over addition. Boring over clever. Fewest files possible.
- Shortest working diff wins, but only once you understand the problem. The smallest change in the wrong place isn't lazy, it's a second bug.
- Question complex requests: "Do you actually need X, or does Y cover it?"
- Pick the edge-case-correct option when two stdlib approaches are the same size, lazy means less code, not the flimsier algorithm.
- Mark deliberate simplifications that cut a real corner with a known ceiling (global lock, O(n²) scan, naive heuristic) with a `ponytail:` comment naming the ceiling and upgrade path.

Not lazy about: understanding the problem (read it fully and trace the real flow before picking a rung, a small diff you don't understand is just laziness dressed up as efficiency), input validation at trust boundaries, error handling that prevents data loss, security, accessibility, the calibration real hardware needs (the platform is never the spec ideal, a clock drifts, a sensor reads off), anything explicitly requested. Lazy code without its check is unfinished: non-trivial logic leaves ONE runnable check behind, the smallest thing that fails if the logic breaks (an assert-based demo/self-check or one small test file; no frameworks, no fixtures). Trivial one-liners need no test.

(Yes, this file also applies to agents working on the ponytail repo itself. Especially to them.)

## Naming

The ecosystem glossary is the single source of truth for names (fields, params, labels, service names): `C:\Users\Chuia\Documents\oingg-analysis-ts\UBIQUITOUS_LANGUAGE.md`. Read it there; do not copy it into this repo. The upstream service is 業務中台 (oingg-business-ts), and this app's Nitro layer is the web-nuxt 伺服器層 — never "BFF".

## Stock-page conventions live in one owner each

A site-wide rule for `/stock/[code]` pages is changed in its owner, never page by page. Pages and chart components don't hand-write these pieces, so a rule change can't miss a caller.

| Convention | Owner |
|---|---|
| Page skeleton and order: loading / not found → summary card → nav → breadcrumb → sections → definition (`#guide`) → footer | `app/components/stock/StockPageShell.vue` |
| Every chart sits in a card; controls row; 近N年 + 自訂區間 select; range slider | `app/components/shared/SharedChartCard.vue` + `app/composables/stock/useChartPeriod.ts` |
| Footer (sources, links, disclaimer) | `StockPageFooter.vue` (via the shell's required `footer` prop) |
| Definition section | `StockMetricGuide.vue` |
| History-table question, label and hidden caption | `historyTableText` |
| ECharts setup (renderer, a11y label, static legends, theme) | `SharedChart.vue` |
| Screener pages (普通股／特別股／ETF): order, 我的篩選／顯示欄位 dropdowns, condition pills and panel, result table, empty state, new-screen dialogs | `app/components/screener/ScreenerPageShell.vue` |
| Spreadsheet feel (cell selection, keyboard grid, copy as TSV/HTML, column widths and `###`, formula reference colors): /watchlist, /holdings/columns | `app/components/shared/SharedSheetGrid.vue` + `app/utils/sheet-grid.ts` |
| 欄位設定 panel (reorder／remove／add columns) | `app/components/shared/SharedColumnSettings.vue` |
| Pick a catalog metric as a column (search → 分類 → 指標 → 期別; phone fullscreen by CSS; reads the catalog itself): /watchlist 欄位設定「＋ 新增欄位」, /holdings/columns「新增指標」(adds `=METRIC("roe.TTM")`, see `holdings-formula.ts`) | `app/components/shared/SharedMetricColumnPicker.vue` (body `ScreenerIndicatorPickerBody.vue`, also used by the screener's `ScreenerConditionPanel`); duplicates and quota stay with each page |
| "Which group am I looking at" switch at the bottom of a section sidebar, only with 2+ groups (holdings 帳戶 incl. 全部帳戶, watchlist 清單); the mobile bar shows the group via `currentDetail` | `app/components/shared/SharedScopeSwitch.vue`, placed in `SectionNav`'s `#after` slot by `HoldingsNav.vue` / `WatchlistNav.vue` |
| Group management page (帳戶管理 /holdings/accounts, 清單管理 /watchlist/lists): rename, move up/down, delete with 10 s undo (the toast names what goes with it), add | `app/components/shared/SharedCollectionManager.vue` |
| Holdings accounts data: ?account= sync, loading gate, scope of every read/write | `HoldingsPageShell.vue` + `app/composables/holdings/useHoldingsPortfolios.ts` (pages watch `holdingsScope`; reads send `scopeQuery`, writes need a `portfolioId`; pages pass their first-load `:pending` and get `loading` from the default slot: headings, labels and table headers render from the server's first frame, data blocks are same-size skeletons until everything arrives — no spinner, no `v-loading` on a first load; `scripts/check-reload-flash.mjs`) |
| Loading placeholders (structure first, data blocks the same size as the real content so nothing moves): every member page (holdings, /watchlist, /watchlist/lists) | `.app-skeleton` (+ `--text`, `--inline`, `--flow`) in `app/assets/css/main.css`; signed-in-or-guest before Firebase restores from `useMemberGate`; row counts from `useLayoutHint` (first visit uses defaults and may move once; reloads don't); `HoldingsMetricTable` (fixed column shares) / `HoldingsSymbolTable` / `HoldingsAllocationChart` / `HoldingsTraits` / `StockMultiSeriesLineChart` / `SharedCollectionManager` / `WatchlistTable` / `SharedShareButton` draw their own |
| 5xx record for the admin site's 排程與服務 page (one structured line per 5xx a user receives: status, route template, reason code; internal SSR calls hand their reason to the outer request) → GCP log-based metric `http_errors` in oingg-web-dev | `server/plugins/http-errors.ts` + `server/utils/http-error.ts` (`scripts/check-http-error.mjs`); proxies set `event.context.httpErrorReason`. Reason codes are shared with the admin site: tell oingg-admin-vue before changing them |
| Add to watchlist (star → per-list checkboxes, new list): every /stock, /etf, /preferred summary card | `StockSummaryCard.vue` + `app/components/watchlist/WatchlistPickerPanel.vue`; state and API in `useStocks` (multiple lists, items carry `watchlistId`) |
| Table download as CSV (column picker; position-size columns unchecked by default): /holdings, /holdings/realized, /holdings/columns, /watchlist | `app/components/shared/SharedDownloadButton.vue` + `toCsv` in `app/utils/sheet-grid.ts`; columns flag `sensitive` (holdings/columns: `sizeRevealingLetters`); the picker itself is `SharedColumnChecklist.vue` |
| Column picker "regular columns, then sensitive ones (position size, private notes) unchecked in their own lower section": download and share dialogs | `app/components/shared/SharedColumnChecklist.vue` |
| Share link (分享／已分享, create, copy or send, update columns, close with 10 s undo; hidden until GET /shares answers): /watchlist and /holdings (the account picked in the sidebar, null＝全部帳戶) | `app/components/shared/SharedShareButton.vue` + `app/composables/share/useShares.ts`; copy/send in `app/utils/share-link.ts` (also the stock summary card's share button); the public page `app/pages/share/[token].vue` renders `WatchlistTable` or `HoldingsSharedView` (same figures as 持股總覽); its 加到我的觀察清單 copies the share into a new list with `importToWatchlist` in `useStocks` (signed out → login dialog with a reason, then resumes) |
| Watchlist table and cards (sheet columns, 漲跌／除息 cells, notes under the name, card sort): /watchlist and the read-only /share/[token] | `app/components/watchlist/WatchlistTable.vue`; rows from `useWatchlistStocks` + `watchlistCatalogFields` |
| 持股特色 (weighted 本益比／Beta／ROE… vs 大盤, 規模與風格九宮格, 前三大占比, factual threshold tags, 計算方式): /holdings/analysis and shared holdings | `app/components/holdings/HoldingsTraits.vue`; rows and tag rules in `app/utils/holdings-traits.ts` (`scripts/check-holdings-traits.mjs`); numbers from 業務中台 `GET /holdings/traits` (`fetchTraits`) and the share payload's `traits` |
| Sidebar look (rows, current row, group headings, dividers) for every section nav: SectionNav, StockPageNavList, SharedScopeSwitch; the rail itself (fixed, vertically centered) | `.rail-*` in `app/assets/css/main.css` + `app/components/AppNavRail.vue`; a switch that loads late draws skeleton rows from a `useLayoutHint` count so the centered rail doesn't jump |
| Sortable server-rendered data table (click a header: numbers big→small first, again reverses, third returns to the server order; nulls last; aria-sort; never in the URL). Only for "one row per entity" tables: /industries, /industries/cycle, /industry/[sector] companies, /macro/market-events. Not for time-ordered history or step-by-step breakdown tables | `app/components/shared/SharedSortableTable.vue` (the page draws each row's cells in `#row`) |
| Sort icon everywhere (two triangles; while sorted only the one direction, centred, primary colour; 24×24 hit area) | `app/components/shared/SharedSortIcon.vue` for hand-drawn headers (SharedSortableTable, SharedSheetGrid) + the 排序箭頭 block in `app/assets/css/element-plus.css` for every el-table — change both together |
| Section sidebar with a drag-to-reorder segment (個股自選指標, ETF facets) | `app/components/stock/StockPageNavList.vue` (`sortableItems` + `@reorder`; the caller owns where the order is stored) |
| Per-symbol ETF pages (/etf/{code}/*): StockPageShell, facet sidebar, breadcrumb, footer, SEO; each facet's chart (also on the 速覽 home) | `app/components/EtfPage.vue` + `app/components/EtfFacetChart.vue` + `app/composables/etf/useEtf.ts` (data) + `app/utils/etf-pages.ts` (facets, formatters) |
| Per-symbol preferred pages (/preferred/{code}/*): StockPageShell, facet sidebar, breadcrumb, footer sources「以公司正式公告為準」, SEO | `app/components/PreferredStockPage.vue` + `app/composables/preferred/usePreferredStock.ts` (data) + `app/utils/preferred-stock.ts` (facets, formatters) |

A new chart component renders `<SharedChartCard>` itself and forwards a `#header` slot. If it has a time axis, it gets its state from `useChartPeriod` and passes `:period`. A new stock page renders `<StockPageShell>`. If a new rule has no owner yet, create the owner first, then move callers onto it.

A screener page renders `<ScreenerPageShell :universe :screener>` and nothing else of its own; the three differ only in their data (`useScreenerTabs` for 普通股, `useUniverseScreener` with `useEtfSource` / `usePreferredSource`). Per-symbol ETF pages render `<EtfPage>`; per-symbol preferred pages render `<PreferredStockPage>`. `scripts/check-screener-consistency.mjs` asserts the three stay the same.
