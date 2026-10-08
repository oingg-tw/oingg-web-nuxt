# 無障礙檢查怎麼跑

認證的證據來自三支腳本，都對著跑起來的 `pnpm dev`（或部署後的網址）用真瀏覽器＋axe-core 跑；第三方只要有這個 repo 就能重跑。

| 腳本 | 範圍 | 指令 |
|---|---|---|
| `scripts/check-a11y-pages.mjs` | 公開頁（首頁、月曆、篩選器、產業追蹤、特別股、ETF、大師徽章、部落格、網站導覽、無障礙聲明、指標速覽…）與登入頁 | `node --env-file=.env scripts/check-a11y-pages.mjs` |
| `scripts/check-stock-pages.mjs` | 個股頁全家族（68 條路由） | `node scripts/check-stock-pages.mjs`（`STOCK_PAGES_WIDTH=375` 再一次） |
| `scripts/check-hub-pages.mjs` | hub／排行／指標／總經頁 | `node scripts/check-hub-pages.mjs`（`HUB_PAGES_WIDTH=375` 再一次） |

`check-a11y-pages.mjs` 每個 路由 × 模式 × 寬度 驗：`<title>` 以「｜安盈選股」結尾、恰好一個可見 h1、`html.dark` 跟模式一致、沒有橫向捲動、axe（wcag2a／wcag2aa／wcag21a／wcag21aa／wcag22aa／best-practice，排除 disabled 控制項）、手機寬度的觸控目標（<24px 失敗、24–43px 警告）、缺名稱的控制項、page error 為 0；hydration 警告列出不算失敗。結果寫到 `a11y-report/<時間>/summary.md` 與 `report.json`。

## 環境變數

| 變數 | 預設 | 用途 |
|---|---|---|
| `A11Y_PAGES_URL` | `http://localhost:3000` | 要檢查的站 |
| `A11Y_PAGES_ROUTES` | 全部 | 逗號分隔子集；Git Bash 下寫不帶斜線的 `calendar`，`index` 指首頁 |
| `A11Y_PAGES_MODES` | `light,dark` | 由 `theme-mode` cookie 決定 |
| `A11Y_PAGES_WIDTHS` | `375,1440` | 驗 1.4.10（reflow）另跑一次 `320` |
| `A11Y_PAGES_TEXT_SCALE` | `100` | `110`／`120`，由 `text-scale` cookie 決定 |
| `A11Y_REPORT_DIR` | `a11y-report/<時間>` | 已 gitignore；認證用的那一份複製到 `docs/a11y/evidence/<日期>/` |
| `A11Y_LOGIN` | 未設 | `1` 時用測試帳號登入後再跑登入頁（見下） |
| `A11Y_TEST_EMAIL`／`A11Y_TEST_PASSWORD` | — | 只放在 `.env`（gitignored），腳本永不印出 |

## 認證用的一輪

1. 上游服務都在（讀取失敗彈窗開著的頁面會記為 skip，認證那一份不能有 skip）。
2. 訪客：預設矩陣一次、`A11Y_PAGES_WIDTHS=320` 一次、`A11Y_PAGES_TEXT_SCALE=120` 一次。
3. 登入：同樣三次加 `A11Y_LOGIN=1`。
4. 個股頁與 hub 頁各跑兩個寬度。
5. 把 `summary.md`／`report.json` 複製到 `docs/a11y/evidence/<日期>/`，更新 `docs/a11y/conformance.md` 的狀態與 `/accessibility` 頁的更新日期。
6. 部署後對正式網址跑 Freego 2.0，結果 PDF 也放進 evidence。

## 測試帳號與種子資料

登入檢查用一個專用的 Firebase email／password 帳號（不是任何人的本人帳號），帳密放 `.env`：

```
A11Y_TEST_EMAIL=
A11Y_TEST_PASSWORD=
```

帳號建好後，用它在畫面上建立檢查需要的資料（都是假資料，只為了讓頁面有內容可驗）：

- 持股管理：約 5 筆交易（兩檔以上、含一筆賣出），讓 報酬／風險／已實現 三頁都有東西。
- 觀察清單：3 檔。
- 篩選器：1 個自訂分頁、1 個自訂欄位預設。
- 外觀：模式設 SYSTEM（腳本用 `emulateMedia` 切深色，不寫入帳號設定）。

腳本每個 context 登入一次（Firebase 的登入狀態在 IndexedDB，Playwright 的 storageState 帶不走；375 與 1440 各登入一次）。
