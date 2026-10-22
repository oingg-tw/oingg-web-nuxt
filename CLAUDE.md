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
| ECharts setup (renderer, a11y label, static legends, theme; tooltips close when something covers the page) | `SharedChart.vue` (listens for `hideChartTips()` in `app/utils/chart-palette.ts`, called by `AppBottomNav` and `AppSlideLayer` when they open) |
| Phone section sheet「其他頁面」(overlay that takes every tap outside it, Esc, Tab out, close on navigation) | `app/components/AppBottomNav.vue` |
| Dividend calendars drop the 六／日 columns unless that data has a weekend date: /calendar, /holdings/dividends | `.app-calendar--weekdays` in `app/assets/css/main.css` + `hasWeekendDate` in `app/utils/dividend-event.ts` |
| Screener pages (普通股／特別股／ETF): order, 我的篩選／顯示欄位 dropdowns, condition pills and panel, result table, empty state, new-screen dialogs | `app/components/screener/ScreenerPageShell.vue` |
| The screen in the URL (bookmark／share: `?f=roe.TTM:15~&c=…&sort=…`; opening it picks the saved screen with the same conditions or opens an unsaved one; the URL follows edits by replace) | format `app/utils/screener-url.ts` (`scripts/check-screener-url.mjs`); screen ⇄ URL `app/composables/screener/useScreenerUrlSync.ts`; opened by the common page and `useUniverseScreener`. Links into a screener (e.g. 除權息月覽) write this format, not their own parameter |
| Spreadsheet feel (cell selection, keyboard grid, copy as TSV/HTML, column widths and `###`, formula reference colors): /watchlist, /holdings/columns | `app/components/shared/SharedSheetGrid.vue` + `app/utils/sheet-grid.ts` |
| 欄位設定 panel (reorder／remove／add columns) | `app/components/shared/SharedColumnSettings.vue` |
| Pick a catalog metric as a column (search → 分類 → 指標 → 期別; phone fullscreen by CSS; reads the catalog itself): /watchlist 欄位設定「＋ 新增欄位」, /holdings/columns「新增指標」(adds `=METRIC("roe.TTM")`, see `holdings-formula.ts`) | `app/components/shared/SharedMetricColumnPicker.vue` (body `ScreenerIndicatorPickerBody.vue`, also used by the screener's `ScreenerConditionPanel`); duplicates and quota stay with each page |
| "Which group am I looking at" switch in a section sidebar, only with 2+ groups: below the list when it changes the data but not the list (holdings 帳戶 incl. 全部帳戶), above it when it decides which list shows (排行 類別 普通股／ETF); the mobile bar shows the group via `currentDetail` | `app/components/shared/SharedScopeSwitch.vue`, placed in `SectionNav`'s `#after` slot by `HoldingsNav.vue` and its `#before` slot (class `rail-group--lead`) by `RankNav.vue`. The watchlist has one content page, so its lists ARE the sidebar (`WatchlistNav.vue`: one draggable link per list `/watchlist?list=` via StockPageNavList, 清單管理 last; one current item at a time via the node's `current`) |
| Group management page (帳戶管理 /holdings/accounts, 清單管理 /watchlist/lists): rename, move up/down, delete with 10 s undo (the toast names what goes with it; the group leaves the list and the sidebar at once, 復原 puts it back, a failed delete too), add | `app/components/shared/SharedCollectionManager.vue` (callers pass `hide`: `hidePortfolio` / `hideWatchlist`); `scripts/check-collection-delete.mjs` |
| Holdings accounts data: ?account= sync, loading gate, scope of every read/write | `HoldingsPageShell.vue` + `app/composables/holdings/useHoldingsPortfolios.ts` (pages watch `holdingsScope`; reads send `scopeQuery`, writes need a `portfolioId`; pages pass their first-load `:pending` and get `loading` from the default slot: headings, labels and table headers render from the server's first frame, data blocks are same-size skeletons until everything arrives — no spinner, no `v-loading` on a first load; `scripts/check-reload-flash.mjs`) |
| Loading placeholders (structure first, data blocks the same size as the real content so nothing moves): every member page (holdings, /watchlist, /watchlist/lists) | `.app-skeleton` (+ `--text`, `--inline`, `--flow`) in `app/assets/css/main.css`; signed-in-or-guest before Firebase restores from `useMemberGate`; row counts from `useLayoutHint` (first visit uses defaults and may move once; reloads don't); `HoldingsMetricTable` (fixed column shares) / `HoldingsSymbolTable` / `HoldingsAllocationChart` / `HoldingsTraits` / `StockMultiSeriesLineChart` / `SharedCollectionManager` / `WatchlistTable` / `SharedShareButton` draw their own |
| Collapsed `<details>` (drawn arrow that turns when open, 44px summary, hover/focus, text capped at 72ch): holdings 計算方式 and per-symbol/per-month breakdowns, /calendar/months day rows | `.app-disclosure` in `app/assets/css/main.css` |
| 5xx record for the admin site's 排程與服務 page (one structured line per 5xx a user receives: status, route template, reason code; internal SSR calls hand their reason to the outer request) → GCP log-based metric `http_errors` in oingg-web-dev | `server/plugins/http-errors.ts` + `server/utils/http-error.ts` (`scripts/check-http-error.mjs`); proxies set `event.context.httpErrorReason`. Reason codes are shared with the admin site: tell oingg-admin-vue before changing them |
| Add to watchlist (star → per-list checkboxes, new list): every /stock, /etf, /preferred summary card | `StockSummaryCard.vue` + `app/components/watchlist/WatchlistPickerPanel.vue`; state and API in `useStocks` (multiple lists, items carry `watchlistId`) |
| Table download as CSV (column picker; position-size columns unchecked by default): /holdings, /holdings/realized, /holdings/columns, /watchlist | `app/components/shared/SharedDownloadButton.vue` + `toCsv` in `app/utils/sheet-grid.ts`; columns flag `sensitive` (holdings/columns: `sizeRevealingLetters`); the picker itself is `SharedColumnChecklist.vue` |
| Column picker "regular columns, then sensitive ones (position size, private notes) unchecked in their own lower section": download and share dialogs | `app/components/shared/SharedColumnChecklist.vue` |
| Share link (分享／已分享, create, copy or send, update columns, close with 10 s undo; hidden until GET /shares answers): /watchlist and /holdings (the account picked in the sidebar, null＝全部帳戶) | `app/components/shared/SharedShareButton.vue` + `app/composables/share/useShares.ts`; copy/send in `app/utils/share-link.ts` (also the stock summary card's share button); the public page `app/pages/share/[token].vue` renders `WatchlistTable` or `HoldingsSharedView` (same figures as 持股總覽); its 加到我的觀察清單 copies the share into a new list with `importToWatchlist` in `useStocks` (signed out → login dialog with a reason, then resumes) |
| Watchlist table and cards (sheet columns, 漲跌／除息 cells, notes under the name, card sort): /watchlist and the read-only /share/[token] | `app/components/watchlist/WatchlistTable.vue`; rows from `useWatchlistStocks` + `watchlistCatalogFields` |
| 持股特色 (weighted 本益比／Beta／ROE… vs 大盤, 規模與風格九宮格, 前三大占比, factual threshold tags, 計算方式): /holdings/analysis and shared holdings | `app/components/holdings/HoldingsTraits.vue`; rows and tag rules in `app/utils/holdings-traits.ts` (`scripts/check-holdings-traits.mjs`); numbers from 業務中台 `GET /holdings/traits` (`fetchTraits`) and the share payload's `traits` |
| Site header, desktop and phone: what the entries are and their order (desktop dropdown groups; phone icon grid = the same list flattened + 總經特區／大師徽章 + 外觀設定; the phone menu is ALWAYS an icon grid, user's standing rule), and the one control look (44px, no border, same hover and current-page marking as the sidebar) | entries in `APP_NAV` / `APP_FEATURES` (`app/utils/app-features.ts`); `.app-bar-item` in `app/assets/css/main.css`; desktop nav = `AppNavMenu.vue` (disclosure buttons with aria-expanded, real links, Esc returns focus — not el-menu); shells `AppHeaderMenu.vue` / `AppMobileHeader.vue`; login/account `UserMenuButton.vue` (`layout="bar"` same width signed in or out, `layout="row"` in the phone menu). Changing the header's height means changing `--app-header-height`'s fallback in main.css too |
| Site map: /sitemap lists every group; the site footer shows only the 本站 group (user: 「footer 只放 本站相關」), plus 聯絡我們／Cookie 設定 | `SITE_MAP` / `ABOUT_SITE_LINKS` in `app/utils/app-features.ts`; drawn by `pages/sitemap.vue` and `SharedFooter.vue` (shared data, not a shared component). A new section's entry goes in `SITE_MAP`, or it orphans |
| Sidebar look (rows, current row, group headings, dividers) for every section nav: SectionNav, StockPageNavList, SharedScopeSwitch; the rail itself (fixed, vertically centered) | `.rail-*` in `app/assets/css/main.css` + `app/components/AppNavRail.vue`; a switch that loads late draws skeleton rows from a `useLayoutHint` count so the centered rail doesn't jump |
| Sortable server-rendered data table (click a header: numbers big→small first, again reverses, third returns to the server order; nulls last; aria-sort; never in the URL). Only for "one row per entity" tables: /industries, /industries/cycle, /industry/[sector]/companies, /macro/market-events. Not for time-ordered history or step-by-step breakdown tables | `app/components/shared/SharedSortableTable.vue` (the page draws each row's cells in `#row`) |
| Sort icon everywhere (two triangles; while sorted only the one direction, centred, primary colour; 24×24 hit area) | `app/components/shared/SharedSortIcon.vue` for hand-drawn headers (SharedSortableTable, SharedSheetGrid) + the 排序箭頭 block in `app/assets/css/element-plus.css` for every el-table — change both together |
| Section sidebar with a drag-to-reorder segment (個股自選指標, ETF facets, 類股 facets, 觀察清單的清單; a node may set `current` / `skeleton`; the grip and dragging only appear with 2+ rows) | `app/components/stock/StockPageNavList.vue` (`sortableItems` + `@reorder`; the caller owns where the order is stored — ETF and 類股 facets both through `useFacetOrder`, this browser only) |
| Per-symbol ETF pages (/etf/{code}/*): StockPageShell, facet sidebar, breadcrumb, footer, SEO; each facet's chart (also on the 速覽 home) | `app/components/EtfPage.vue` + `app/components/EtfFacetChart.vue` + `app/composables/etf/useEtf.ts` (data) + `app/utils/etf-pages.ts` (facets, formatters) |
| Per-symbol preferred pages (/preferred/{code}/*): StockPageShell, facet sidebar, breadcrumb, footer sources「以公司正式公告為準」, SEO | `app/components/PreferredStockPage.vue` + `app/composables/preferred/usePreferredStock.ts` (data) + `app/utils/preferred-stock.ts` (facets, formatters) |
| Per-sector pages (/industry/{code}-{slug}/*, the user's「比照個股瀏覽」): heading, sidebar (指標速覽 on top, draggable facets), breadcrumb, footer, SEO, stale-slug 301 to the same facet; each facet's chart (also on the 速覽 home, which ends with the other sectors); stock links live on the companies facet (home chips → 速覽 → 公司名單 → stock = 3 clicks) | `app/components/IndustryPage.vue` + `app/components/IndustryFacetChart.vue` + `app/composables/industry/useIndustry.ts` (data, 404/301, noindex) + `INDUSTRY_FACETS` in `shared/utils/hub-slugs.ts` (facets; the sitemap and site-routes read it) + `app/utils/industry-pages.ts` (row helpers, formatters) |

A new chart component renders `<SharedChartCard>` itself and forwards a `#header` slot. If it has a time axis, it gets its state from `useChartPeriod` and passes `:period`. A new stock page renders `<StockPageShell>`. If a new rule has no owner yet, create the owner first, then move callers onto it.

A screener page renders `<ScreenerPageShell :universe :screener>` and nothing else of its own; the three differ only in their data (`useScreenerTabs` for 普通股, `useUniverseScreener` with `useEtfSource` / `usePreferredSource`). Per-symbol ETF pages render `<EtfPage>`; per-symbol preferred pages render `<PreferredStockPage>`; per-sector pages render `<IndustryPage>`. `scripts/check-screener-consistency.mjs` asserts the three stay the same.
