# 無障礙檢查 2026-10-08

來源 http://localhost:3000，文字 100%，axe-core 標籤 wcag2a、wcag2aa、wcag21a、wcag21aa、wcag22aa、best-practice。

| 路由 | light@320 | dark@320 |
|---|---|---|
| / | ✓ | ✓ |
| /calendar | ✓ | ✓ |
| /watchlist | ✓ | ✓ |
| /holdings | ✓ | ✓ |
| /appearance | ✓ | ✓ |
| /sitemap | ✓ | ✓ |
| /accessibility | ✓ | ✓ |
| /preferred-stocks | ✓ | ✓ |
| /etf-zone | ✓ | ✓ |
| /guru-indicators | ✓ | ✓ |
| /blog | ✓ | ✓ |
| /industries | ✓ | ✓ |
| /stock/2330/quick-view | ✓ | ✓ |
| /screener?template=value | ✓ | ✓ |
| /blog/low-pe-ratio-trap-cyclical-stocks | ✓ | ✓ |
| /design | ✓ | ✓ |

## axe 違規

無。

## 目標尺寸（<24px 在任何寬度都失敗，除非符合 2.5.8 的 spacing 例外；24–43px 只在觸控寬度警告）

| 頁面 | <24px | 24–43px |
|---|---|---|
| / light@320 | — | 5 個（最小 32px）：a.router-link-active.router-link-exact-active×2、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| / dark@320 | — | 5 個（最小 32px）：a.router-link-active.router-link-exact-active×2、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /calendar light@320 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /calendar dark@320 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /watchlist light@320 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /watchlist dark@320 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /holdings light@320 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /holdings dark@320 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /appearance light@320 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /appearance dark@320 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /sitemap light@320 | — | 7 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.sitemap-page__link×2、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /sitemap dark@320 | — | 7 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.sitemap-page__link×2、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /accessibility light@320 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /accessibility dark@320 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /preferred-stocks light@320 | — | 15 個（最小 24px）：a.app-logo.app-logo--always-show-name×1、a.preferred-stocks-page__title-info.el-tooltip__trigger×1、button.caret-wrapper×6、button.preferred-stocks-page__header-info.el-tooltip__trigger×3、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /preferred-stocks dark@320 | — | 15 個（最小 24px）：a.app-logo.app-logo--always-show-name×1、a.preferred-stocks-page__title-info.el-tooltip__trigger×1、button.caret-wrapper×6、button.preferred-stocks-page__header-info.el-tooltip__trigger×3、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /etf-zone light@320 | — | 13 個（最小 24px）：a.app-logo.app-logo--always-show-name×1、button.el-tag__close×1、button.caret-wrapper×7、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /etf-zone dark@320 | — | 13 個（最小 24px）：a.app-logo.app-logo--always-show-name×1、button.el-tag__close×1、button.caret-wrapper×7、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /guru-indicators light@320 | — | 12 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.guru-indicators-page__nav-link×7、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /guru-indicators dark@320 | — | 12 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.guru-indicators-page__nav-link×7、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /blog light@320 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /blog dark@320 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /industries light@320 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /industries dark@320 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /stock/2330/quick-view light@320 | — | 6 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.stock-breadcrumb__link×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /stock/2330/quick-view dark@320 | — | 6 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.stock-breadcrumb__link×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /screener?template=value light@320 | — | 25 個（最小 27px）：a.app-logo.app-logo--always-show-name×1、a.screener-result-table__name-link×20、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /screener?template=value dark@320 | — | 25 個（最小 27px）：a.app-logo.app-logo--always-show-name×1、a.screener-result-table__name-link×20、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /blog/low-pe-ratio-trap-cyclical-stocks light@320 | — | 6 個（最小 24px）：a.app-logo.app-logo--always-show-name×1、a.blog-post__back×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /blog/low-pe-ratio-trap-cyclical-stocks dark@320 | — | 6 個（最小 24px）：a.app-logo.app-logo--always-show-name×1、a.blog-post__back×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /design light@320 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /design dark@320 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |

## 靠 spacing 例外通過的小目標（列出備查）

- /calendar light@320：button.dividend-calendar-card__cell.dividend-calendar-card__cell--events 22px
- /calendar dark@320：button.dividend-calendar-card__cell.dividend-calendar-card__cell--events 22px

## 缺名稱的控制項

無。

## 橫向溢出（320px）

無。

## hydration 警告（列出，不算失敗）

- /preferred-stocks light@320：2 則
- /preferred-stocks dark@320：2 則
- /stock/2330/quick-view light@320：6 則
- /stock/2330/quick-view dark@320：6 則
