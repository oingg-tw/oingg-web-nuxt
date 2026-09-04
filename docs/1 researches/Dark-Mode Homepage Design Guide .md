# Dark-Mode Homepage Design Guide for ifa.rocks — A Financial Data Platform for Near-Retirement and Senior Investors

## TL;DR
- Build on a layered dark-gray surface scale (never pure black), off-white text, and desaturated red/green-plus-icon semantics; use GitHub Primer (#0d1117 canvas, #E6EDF3 text), Radix "Slate" dark, and Material 3's #121212+overlay elevation as reference systems, and target WCAG AA (4.5:1 body text) as an absolute floor.
- For this audience, oversize everything relative to trading apps: 18px minimum body text, 44–48px touch targets, flat/predictable navigation with always-visible text labels, and enlarged metric cards leading with dividend yield, dividend-safety rating, and credit rating rather than dense tickers.
- Emulate Robinhood's card modularity and glance-readable color logic and TradingView's calm low-contrast chart surfaces — but reject Bloomberg's maximum-density amber-on-black terminal aesthetic, which is the wrong model for non-professional older users.

## Key Findings

### 1. What excellent dark-mode fintech homepages do well
- **Robinhood** is the strongest model for a low-friction retail audience. Its interface organizes all data into interactive card "blocks," uses a monochrome foundation so semantic green/red pops, and encodes state through color so users can "glimpse the health and activity of the Stock Market without reading a single word." Its signature accent is Robinhood Green (#00C805), and portfolio totals/prices use bold weights as the primary focal point.
- **TradingView** dark mode is a fully curated theme (background, gridlines, text, accents all tuned), not a color inversion. It deliberately uses a low-contrast surface to enhance chart continuity and minimize visual noise during long sessions.
- **Bloomberg Terminal** is the canonical dark financial UI — amber-on-black, maximum information density, high-contrast colors to "pick out information from a lot of noise." It is iconic but is explicitly a power-user, professional tool; its density and lack of softening are the wrong template for near-retirement casual investors. Notably, Bloomberg itself moved to blue/red (not red/green) for up/down semantics in its color-vision-deficiency (CVD) accessibility schemes, retaining amber only for non-semantic text.
- **Coinbase** publishes a mature public design system (CDS) built on semantic tokens (bgPrimary, fgMuted) that auto-adapt per theme, and mandates WCAG AA 4.5:1 text contrast as a baseline.
- Reference templates worth studying: **Linear** (near-black surfaces, single accent color, restraint), **GitHub/Stripe** (very dark backgrounds, slightly off-white text), and **Mosaic/PostHog** (analytics kept legible in dark).

### 2. Accessibility guidelines for middle-aged and near-retirement users

**Contrast (WCAG 2.1/2.2):**
- Normal text: 4.5:1 minimum (AA), 7:1 (AAA). Large text (≥18pt/24px, or ≥14pt/18.66px bold): 3:1 (AA), 4.5:1 (AAA). Non-text UI components and meaningful graphics: 3:1 (SC 1.4.11).
- WCAG contrast rules apply identically in dark mode; offering dark mode does not exempt you. Aging eyes warrant treating AA as a floor and pushing body text toward AAA.

**Anti-glare palette principles:**
- Avoid pure black (#000000): pure white on pure black is ~21:1 and causes "halation" (glowing/bleeding text), especially painful for the ~47% of people with astigmatism — a UK study of 11,000+ spectacle-wearers found 47.4% had astigmatism of 0.75 D or greater in at least one eye (Level Access, "Astigmatism and Web Accessibility"), and UBC's Sensory Perception and Interaction Research Group notes people with astigmatism find white-on-black harder to read than black-on-white. Google's Material Design dark theme guidance recommends #121212 as the base surface, targeting a 15.8:1 text-to-background contrast, with elevation via white overlays (01dp = +5% white, 08dp = +12% white) and on-surface text opacities of 87%/60%/38% for high/medium/disabled.
- Avoid pure white (#FFFFFF) body text; use off-white (#E6EDF3 / #E0E0E0 / #E2E8F0). On #121212, #E5E7EB gives ~15.3:1 and even muted #9CA3AF gives ~8.5:1 (both AAA); Material's own off-white text range runs #E0E0E0–#FAFAFA.
- Communicate elevation via lighter surfaces (not shadows, which disappear on dark). Desaturate accent colors so they don't "vibrate" against dark backgrounds.

**Typography for older users:**
- Minimum body text 16px, with 18px+ strongly recommended for senior audiences; legacy print guidance is 12–14pt minimum, but on screen larger is better. Use clean sans-serifs with a generous x-height (Atkinson Hyperlegible is a strong accessible default) and avoid decorative/script faces.
- Line height ≥1.5× font size, letter-spacing ≥0.12×, word-spacing ≥0.16×, paragraph spacing ≥2× (WCAG SC 1.4.12). Line length ≤~65 characters. Flush-left, ragged-right; never justified.
- Text must resize to 200% without breaking; use rem/em not fixed px.

**Touch/click targets:**
- WCAG 2.5.8 (AA): 24×24px minimum. WCAG 2.5.5 (AAA), Apple HIG: 44×44pt. Material Design 3: 48×48dp. Minimum 8px spacing between targets. For this audience, standardize on 48×48px with generous spacing given age-related motor changes.

### 3. Design-platform patterns (Dribbble/Behance/Mobbin)
- Recurring successful pattern (from Aniq-UI's spec of real dark dashboards): a **surface scale not one black** (page #0B0E13, cards #11151C, hover #171C24); **off-white text** (#E6E8EB primary, #9AA3AE secondary); **desaturated accents**; **chart-specific contrast** (gridlines at 6–8% white opacity, series ≥3:1 against card, tooltips on elevated surface); and **tabular numerals** so money columns align.
- Card hierarchy for finance: balance/summary cards sit one surface step above the page; tables sit on the page surface; "the eye finds totals first because they are literally brighter."
- Sparklines-over-full-charts inside cards: a single desaturated line, no gridlines, reads best at small sizes (Tufte's "datawords"). Twitter/Mandiant-style compact trendlines are a proven pattern.
- Dashboard layout convention: top row = 3–5 key KPI metric cards (large number + label + trend arrow/sparkline); middle band = trend/time-series charts; bottom = detail tables.

### 4. Homepage modules for near-retirement investors

**(a) Search + enlarged metric cards.** A prominent, single, obvious search bar with a magnifying-glass icon, placeholder ("Search a stock or fund…"), autocomplete showing up to ~10 suggestions (top 3 most relevant), bolded matched terms, typo tolerance, and autofocus. For retirement investors, the hero metric cards should lead with income-and-safety metrics rather than intraday price action: **dividend yield, dividend-safety score, payout ratio, free-cash-flow coverage, credit/investment-grade rating, and dividend-growth streak.** Industry precedents: Simply Safe Dividends' 0–100 Dividend Safety Scores, bucketed Very Safe (81–100) down to Extremely Unsafe (0–20), with founder Brian Bollinger advising conservative investors focus on stocks scoring at least 60 — per the firm, investors sticking to scores above 60 "would have avoided 97% (917 of 938) of dividend cuts" since the system's 2015 inception; Seeking Alpha's Quant Dividend Grades (Safety/Yield/Growth/Consistency); and S&P/Moody's investment-grade ratings (A or better signals strength). Yields of 2–5% with consistent dividend growth "have historically represented a productive range," while "abnormally high yields (above 6-8%) can signal financial distress rather than generosity, a concept often called a 'yield trap'" (dividendcalculator.net) — AT&T is the canonical case, yielding over 8% before cutting its dividend nearly in half in 2022.

**(b) Low-noise charts.** Remove borders, minimize/lighten gridlines, few axis ticks, abbreviated numbers (1K not 1,000), direct labeling instead of legends, no 3D/shadows, ≤3–5 lines per chart. Prefer simple line charts and sparklines with a written total underneath for those who don't want to read the chart. Always start bar-chart y-axes at zero.

**(c) Low-cognitive-load navigation.** Peer-reviewed evidence (Frontiers in Psychology, 2026) shows deep hierarchical, text-label-stripped navigation produced the longest task times and highest error rates for older adults; each extra navigation layer significantly raises time and errors. Recommendations: flat, persistent, predictable navigation; bottom-tab or top-tab over hidden sidebars/hamburgers; **always pair icons with visible text labels** (icon-only navigation is worst for older users); skeuomorphic/concrete icons over abstract flat symbols; progressive disclosure; a visible settings panel to scale text and toggle high-contrast.

### 5. Synthesis — the concrete design guide (below in Details).

## Details

### Color system (dark mode, layered)
Adopt a semantic-token architecture (roles, not raw hex) so themes scale. Recommended concrete values, triangulated from GitHub Primer, Radix "Slate" dark, and Material 3:

**Surfaces (elevation via lightness):**
- `surface/canvas` (page background): **#0D1117** (GitHub Primer dark canvas) or Radix Slate step 1 **#111113**. Do not use #000000.
- `surface/raised` (cards, panels): **#161B22** (Primer) / Radix Slate step 3 **#212225**.
- `surface/hover`: **#1F262E** / Radix Slate step 4 **#272A2D**.
- `surface/overlay` (modals, elevated): Material approach — #121212 base with a white overlay increasing by elevation (5% ≈ #1E1E1E at +1dp, 9% ≈ #272727 at +4dp; high/medium/disabled on-surface text opacity 87%/60%/38%).

**Borders/dividers:**
- `border/default`: **#30363D** (Primer) / Radix Slate step 6–7 (**#363A3F**–**#43484E**). Must clear 3:1 for meaningful UI borders.

**Text:**
- `text/primary`: **#E6EDF3** (Primer) — ~15–16:1 on #0D1117 (AAA). Reserve near-white for headings/key numbers.
- `text/secondary/muted`: **#8B949E** (Primer, ~6.15:1 on #0D1117) or #9AA3AE. Still AA+.
- Never pure #FFFFFF for body.

**Accents & semantics (desaturated for dark):**
- Interactive/brand accent: one primary hue (a desaturated blue/teal reads as trustworthy/institutional; e.g., Primer accent #2F81F7 / #58A6FF which hits ~7.49:1 on #0D1117).
- Gains/losses: tuned green **#22C55E** and red **#EF4444** (not saturated primaries) — but ALWAYS add a second cue (▲/▼ arrow, +/− sign) because red–green color vision deficiency affects up to 8% of males and ~0.5% of females of Northern European descent (per the peer-reviewed review "A Global Perspective of Color Vision Deficiency," PMC12385717). Consider a blue/orange or blue/red up-down scheme (as Bloomberg adopted for CVD) for maximum accessibility.
- Keep to one interactive accent plus semantic red/green; avoid five competing saturated accents.

### Typography scale
- Font: accessible sans-serif with large x-height (e.g., Atkinson Hyperlegible, Inter, or system UI). Use tabular/lining numerals for all figures.
- Scale (senior-optimized, ~1.25 ratio): body **18px** (not 16), secondary/caption 16px (avoid going below 14px anywhere), H3 24px, H2 30px, H1 ~38–40px, hero metric numbers 44–56px bold.
- Line height 1.5 for body; letter-spacing ≥0.12× where set; ≤65-char line length; left-aligned.
- Weight: use bold for totals/prices/headings; avoid thin/light weights on dark (they lose contrast).

### Spacing & grid
- 8pt grid: spacing tokens 8/16/24/32/48/64. Card internal padding 24px; gap between cards 16–24px; section padding 48–96px. Border radius 8–16px (4px sub-grid for small elements). Rule of thumb: internal ≤ external spacing.
- Layout: 12-column responsive grid; container max-width ~1280px. Because viewport widths (320/360/768/1024/1280/1440) divide by 8, the grid renders cleanly at 1×/1.5×/2× densities.

### Recommended homepage composition (top → bottom)
1. **Top bar:** logo left; large, central/prominent **search bar** (48px+ tall) with autocomplete; theme toggle + a visible "Text size" / accessibility control right. Persistent.
2. **Primary navigation:** flat top-tab or bottom-tab (mobile) with icon + text label pairs — e.g., Home, Watchlist, Search, Portfolio, Learn. No hamburger-hidden primary nav.
3. **Hero KPI row (3–5 enlarged cards):** for a selected/holding stock or the market — lead with Dividend Yield, Dividend-Safety Rating, Credit Rating, Payout Ratio, and 5-yr dividend growth. Each card: large bold number (44–56px), clear label (16–18px), one sparkline or trend arrow, tinted status chip.
4. **Trend band:** one calm line chart (price + dividend history toggle), minimal gridlines (6–8% white), direct labels, written summary sentence underneath.
5. **Simplified detail / watchlist table:** tabular numerals, tinted status chips, one chip vocabulary reused; filters recessed to page surface, rows raised.
6. **Guidance/education module:** plain-language "What this means" cards (progressive disclosure) to reduce cognitive load for less-experienced older investors.

### What to emulate vs. avoid
- **Emulate:** Robinhood's expandable card modularity and glance-readable color state; TradingView's calm curated dark chart surface; Coinbase's semantic-token theming; Aniq-UI's surface-scale + tabular-numeral spec; sparklines-in-cards.
- **Avoid:** Bloomberg's maximum-density amber-on-black terminal (right for pros, wrong here); pure-black backgrounds and pure-white text; color-only gain/loss encoding; icon-only navigation; deep nested menus; thin fonts; sub-16px text.

## Recommendations
**Stage 1 — Foundation (before any screens):** Define semantic color tokens with the surface scale above (canvas #0D1117, raised #161B22, border #30363D, text #E6EDF3/#8B949E). Lock the 8pt spacing scale and the senior type scale (18px body baseline). Set global minimum touch target 48px. Validate every text/background pair in WebAIM contrast checker — treat AA (4.5:1) as the fail line and push body to AAA (7:1).
**Stage 2 — Core modules:** Build the search+autocomplete, the 3–5 enlarged KPI cards (dividend yield, safety rating, credit rating), and one simplified line chart. Add the +/− and arrow second-cue to all gain/loss color. Ship icon+label flat nav.
**Stage 3 — Validation:** Usability-test with users aged 55–70; run Coblis color-blindness simulation and axe DevTools. Add a persistent text-size / high-contrast control.
**Benchmarks that change the plan:** If usability testing shows task times/error rates rising on any nav path, flatten it further (evidence: each nav layer raises older-adult error rates). If contrast tests fail, darken the background rather than brightening text (a darker surface makes medium colors pass). If astigmatic users report halation, step body text down from near-white toward #E0E0E0.

## Caveats
- Some cited hex values come from design-aggregator and Medium sources rather than primary docs; GitHub Primer maintains two dark generations (classic #161B22/#30363D vs. newer #151b23/#3d444d) — confirm which you target (canvas #0D1117 and text #E6EDF3 are stable across both). Radix publishes swatches via CSS and its exact hex were mirrored from the npm package/aggregators; verify against the official package before shipping.
- Specific contrast ratios for #E6EDF3 on #0D1117 and #E0E0E0 on #121212 (~13–16:1) are standard computations, not figures published verbatim by the design systems — re-verify with a checker.
- Research on dark mode is mixed: several studies find better reading comprehension with dark-on-light (positive polarity); dark mode is a legitimate user preference and eye-comfort/OLED-battery choice, not a universally superior reading mode. Offer a light theme too, and make theme + text-size user-controllable.
- "Dividend safety" scores and credit ratings are third-party/proprietary metrics (Simply Safe Dividends, Seeking Alpha, S&P/Moody's) — licensing and methodology transparency matter for a data product; present them with source attribution and avoid implying investment advice.

---

## 🔗 知識網絡與關聯筆記

- **背景工程與視覺感知**：[[網站無障礙背景色彩架構與視覺感知工程研究報告]]（適度對比避免眩光、Material Design 87/60/38% 文字透明度與高度模型）
- **通用無障礙色彩規範**：[[無障礙網站色彩規範]]（文字與非文字對比度門檻、色盲安全調色盤）
- **股票介面色彩與幾何編碼**：[[色盲友善股票介面設計]]（台股紅漲綠跌之符號輔助與色弱相容實踐）
- **版面網格與間距系統**：[[網格排版美學與實踐]]（8pt/4pt 網格系統與間距 token 規範）
- **退休儀表板體驗設計**：[[退休投資儀表板偏好比較]]（雙軌自適應架構與資深投資人低認知負荷實踐）
- **全庫地圖**：[[README]]