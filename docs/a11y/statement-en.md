# Accessibility Conformance Statement — 安盈選股

This is the English text of the statement published at `/accessibility`. The Chinese page is the authoritative version; keep the two in step (the page carries the same sections in the same order).

**Statement date:** 2026-10-08
**Last review:** 2026-10-08 (the date of the evidence in `docs/a11y/evidence/`)

## Standards

安盈選股 is built to conform to:

- **WCAG 2.2 Level AA** (W3C Web Content Accessibility Guidelines 2.2, Level A and Level AA success criteria).
- **網站無障礙規範 2.0, Level AA** (Taiwan Web Accessibility Guidelines 2.0, issued by the Ministry of Digital Affairs' 無障礙網路空間服務網).

## Scope

The whole site, public and signed-in: the landing page, 配息月曆 (dividend calendar), 個股篩選 (stock screener) and its condition pages, 個股總表 and every 證交所類股 page, every 個股 page family, 排行 (rankings), 指標說明 (metric explanations), 總經特區 (macro zone), 特別股專區, ETF 專區, 大師徽章, the blog, and the signed-in tools 持股管理 (holdings), 觀察清單 (watchlist), 個人資料設定 and 外觀設定.

**Third-party content:** the sign-in dialog is rendered by FirebaseUI. Its markup is Firebase's; the site overrides its colours where contrast required it and lists anything it cannot change under *Known limitations*.

## Technologies relied upon

HTML, CSS, JavaScript, WAI-ARIA, SVG. Charts are drawn with ECharts as SVG, each exposed as `role="img"` with an accessible name, and the numbers behind every chart are also rendered as an HTML table.

## Evaluation methods

1. **Automated, repeatable by anyone with the repository:** `node --env-file=.env scripts/check-a11y-pages.mjs` runs axe-core 4.13 (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`) against every public page in light and dark mode at 375 px (touch) and 1440 px, checks the page title, a single `<h1>`, horizontal overflow, touch-target size (WCAG 2.5.8), and page errors, and writes `report.json` and `summary.md`. The same axe configuration runs in `scripts/check-stock-pages.mjs` (every 個股 page), `scripts/check-hub-pages.mjs` (hub, ranking, metric and macro pages) and `scripts/check-macro-rail.mjs`. The `A11Y_LOGIN=1` mode repeats the run signed in with a dedicated test account.
2. **Manual checklist:** `docs/a11y/conformance.md` lists every WCAG 2.2 A/AA success criterion with its method (which axe rules, or which manual procedure), its status and the sample pages used.
3. **Freego 2.0** (the Ministry of Digital Affairs' checker) is run against the deployed site before the AA mark application; its result PDF is kept in `docs/a11y/evidence/`.

## Keyboard shortcuts (accesskeys)

Following the Taiwan convention: **Alt+U** top area (home), **Alt+C** main content, **Alt+S** search, **Alt+L** left navigation (on pages that have one), **Alt+Z** footer. Firefox uses Shift+Alt+letter. The full list is on `/sitemap`.

## Known limitations

- **Sign-in dialog (FirebaseUI):** the widget's own markup is third-party. Colours that failed contrast have been overridden; anything found later is listed here with a date.
- **Touch targets between 24 px and 44 px:** a few text links in the header and footer, and the day cells of the dividend calendar on a 375 px screen, measure 24–43 px. They meet WCAG 2.2 Level AA (2.5.8, 24 px) but not the AAA 44 px target (2.5.5). All form controls and buttons are at least 44 px on touch devices.
- **Charts:** a chart's visual trend is described by its accessible name and its data table, not by a narrated summary.

## Feedback

If any part of 安盈選股 is hard to use, write to **ian.chu@oingg.com**. Say which page and which assistive technology or browser you were using. We will reply as soon as we can.

## Formal approval

This statement is published by 蔓馥金融科技股份有限公司, the operator of 安盈選股.
