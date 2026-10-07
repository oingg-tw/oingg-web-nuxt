# Synthetic fixtures: /holdings/performance and /holdings/risk

Generated 2026-10-07 by bff-ts (commit ddb5023). The ledger is synthetic, held in memory and never written to any DB; no real user's data is involved. Every trade price is the stock's actual close on the trade date. Market data (closes, TAIEX, ex-dividend calendar, 1-year deposit rate) is real, taken from analysis-ts on that day. Values will differ if regenerated later.

Synthetic ledger:
- 2024-06-03 BUY 2330 ×2000, 2317 ×5000, 0056 ×20000, 2882 ×10000
- 2026-03-02 SELL 2317 ×2000
- 2026-05-04 BUY 2454 ×300
- (d only) 2025-12-01 BUY 00988A ×10000 (listed 2025-11-05, so coverage "partial")
- (d only) 2024-06-03 BUY 9999 ×1000 (a symbol with no prices, so coverage "none" with weight null; performance lists it in missingPrices)

| file | window | what it exercises |
|---|---|---|
| a-normal-1y.* | default (1y to 2026-10-07) | every field non-null |
| b-short-window.* | from 2026-08-10 (40 trading days) | tail metrics, benchmarkComparison, riskAdjusted, annualized and calmar all null |
| c-risk-free-null.* | default | riskFree null and riskAdjusted all null; everything else intact |
| d-partial-and-none-coverage.* | default | holdings[] with coverage partial (00988A) and none (9999) |
| e-drawdown-not-recovered.risk.json | to 2026-04-08 | portfolio.maxDrawdown.recoveryDate null (−14.0%, peak 2026-02-26, trough 2026-03-31) |
