# 無障礙檢查 2026-10-08（訪客）

來源 http://localhost:3000，文字 120%，axe-core 標籤 wcag2a、wcag2aa、wcag21a、wcag21aa、wcag22aa、best-practice。

| 路由 | light@375 | light@1440 | dark@375 | dark@1440 |
|---|---|---|---|---|
| / | ✓ | ✓ | ✓ | ✓ |
| /calendar | ✓ | ✓ | ✓ | ✓ |
| /watchlist | ✓ | ✓ | ✓ | ✓ |
| /holdings | ✓ | ✓ | ✓ | ✓ |
| /appearance | ✓ | ✓ | ✓ | ✓ |
| /sitemap | ✓ | ✓ | ✓ | ✓ |
| /accessibility | ✓ | ✓ | ✓ | ✓ |
| /preferred-stocks | ✓ | ✓ | ✓ | ✓ |
| /etf-zone | ✓ | ✓ | ✓ | ✓ |
| /guru-indicators | ✓ | ✓ | ✓ | ✓ |
| /blog | ✓ | ✓ | ✓ | ✓ |
| /industries | ✓ | ✓ | ✓ | ✓ |
| /stock/2330/quick-view | ✓ | ✓ | ✓ | ✓ |
| /screener?template=value | ✓ | ✓ | ✓ | ✓ |
| /blog/low-pe-ratio-trap-cyclical-stocks | ✓ | ✓ | ✓ | ✓ |
| /design | ✓ | ✓ | ✓ | ✓ |

## axe 違規

無。

## 目標尺寸（<24px 在任何寬度都失敗，除非符合 2.5.8 的 spacing 例外；24–43px 只在觸控寬度警告）

| 頁面 | <24px | 24–43px |
|---|---|---|
| / light@375 | — | 5 個（最小 32px）：a.router-link-active.router-link-exact-active×2、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /calendar light@375 | — | 23 個（最小 30px）：a.app-logo.app-logo--always-show-name×1、button.dividend-calendar-card__cell.dividend-calendar-card__cell--events×18、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /watchlist light@375 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /holdings light@375 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /appearance light@375 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /sitemap light@375 | — | 7 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.sitemap-page__link×2、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /accessibility light@375 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /preferred-stocks light@375 | — | 15 個（最小 24px）：a.app-logo.app-logo--always-show-name×1、a.preferred-stocks-page__title-info.el-tooltip__trigger×1、button.caret-wrapper×6、button.preferred-stocks-page__header-info.el-tooltip__trigger×3、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /etf-zone light@375 | — | 13 個（最小 24px）：a.app-logo.app-logo--always-show-name×1、button.el-tag__close×1、button.caret-wrapper×7、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /guru-indicators light@375 | — | 12 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.guru-indicators-page__nav-link×7、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /blog light@375 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /industries light@375 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /stock/2330/quick-view light@375 | — | 6 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.stock-breadcrumb__link×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /screener?template=value light@375 | — | 25 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.screener-result-table__name-link×20、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /blog/low-pe-ratio-trap-cyclical-stocks light@375 | — | 6 個（最小 29px）：a.app-logo.app-logo--always-show-name×1、a.blog-post__back×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /design light@375 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /preferred-stocks light@1440 | — | — |
| /etf-zone light@1440 | — | — |
| /screener?template=value light@1440 | — | — |
| / dark@375 | — | 5 個（最小 32px）：a.router-link-active.router-link-exact-active×2、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /calendar dark@375 | — | 23 個（最小 30px）：a.app-logo.app-logo--always-show-name×1、button.dividend-calendar-card__cell.dividend-calendar-card__cell--events×18、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /watchlist dark@375 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /holdings dark@375 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /appearance dark@375 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /sitemap dark@375 | — | 7 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.sitemap-page__link×2、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /accessibility dark@375 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /preferred-stocks dark@375 | — | 15 個（最小 24px）：a.app-logo.app-logo--always-show-name×1、a.preferred-stocks-page__title-info.el-tooltip__trigger×1、button.caret-wrapper×6、button.preferred-stocks-page__header-info.el-tooltip__trigger×3、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /etf-zone dark@375 | — | 13 個（最小 24px）：a.app-logo.app-logo--always-show-name×1、button.el-tag__close×1、button.caret-wrapper×7、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /guru-indicators dark@375 | — | 12 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.guru-indicators-page__nav-link×7、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /blog dark@375 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /industries dark@375 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /stock/2330/quick-view dark@375 | — | 6 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.stock-breadcrumb__link×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /screener?template=value dark@375 | — | 25 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.screener-result-table__name-link×20、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /blog/low-pe-ratio-trap-cyclical-stocks dark@375 | — | 6 個（最小 29px）：a.app-logo.app-logo--always-show-name×1、a.blog-post__back×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /design dark@375 | — | 5 個（最小 32px）：a.app-logo.app-logo--always-show-name×1、a.app-logo×1、a.app-github-link×1、a.app-email-link×1、a.shared-footer__nav-link×1 |
| /preferred-stocks dark@1440 | — | — |
| /etf-zone dark@1440 | — | — |
| /screener?template=value dark@1440 | — | — |

## 靠 spacing 例外通過的小目標（列出備查）

- /preferred-stocks light@1440：button.caret-wrapper 14px
- /etf-zone light@1440：button.caret-wrapper 14px
- /screener?template=value light@1440：button.caret-wrapper 14px
- /screener?template=value light@1440：button.caret-wrapper 2px
- /preferred-stocks dark@1440：button.caret-wrapper 14px
- /etf-zone dark@1440：button.caret-wrapper 14px
- /screener?template=value dark@1440：button.caret-wrapper 14px
- /screener?template=value dark@1440：button.caret-wrapper 2px

## 缺名稱的控制項

無。

## 橫向溢出（375／1440px）

無。

## hydration 警告（列出，不算失敗）

- /preferred-stocks light@375：2 則
- /stock/2330/quick-view light@375：6 則
- /preferred-stocks light@1440：2 則
- /stock/2330/quick-view light@1440：6 則
- /preferred-stocks dark@375：2 則
- /stock/2330/quick-view dark@375：6 則
- /preferred-stocks dark@1440：2 則
- /stock/2330/quick-view dark@1440：6 則
