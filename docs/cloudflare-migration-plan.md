# oingg-web-nuxt 搬到 Cloudflare Workers 的計畫

## 背景

- **為什麼搬：** 使用者在追冷啟動（2026-10-26）。App Hosting 這一側，開容器加網站程式啟動約 5 秒，其中開容器約 3.4 秒，跟程式碼無關。Cloudflare Workers 是 isolate 架構，沒有容器要開，網站這一側的冷啟動可以降到幾乎為零；頁面也在台灣節點執行與快取。
- **這份文件的範圍：** 只是計畫，核可前不改任何程式。核可後，把這份文件存成專案裡的 `docs/cloudflare-migration-plan.md`。
- **先講清楚效益的上限：**
  - 業務中台、數據中台還在 Cloud Run 上。它們冷的時候（業務中台約 2.5～5 秒）搬了也一樣會等。
  - 每支上游呼叫仍然要從邊緣節點連到新加坡（asia-southeast1）。
  - 如果目標只有冷啟動，App Hosting 最少保留 1 台（約 13 美元／月）也能拿到網站這一側的效果，而且不用搬。
  - 搬家真正多拿到的，是邊緣快取公開頁面：個股、產業、排行這些頁面直接由台灣節點回應。
- **選 Workers，不選 Pages：** Cloudflare 現在把全端框架導向 Workers 加靜態資源；Nuxt Content 官方的 Workers 部署說明用 `cloudflare_module` preset。

## 進度（2026-10-27 開工，分支 `cloudflare-workers`）

- **使用者決定：** 先讓同一份程式在 App Hosting 和 Workers 都能跑，比冷啟動，差距極端顯著就直接換過去。A2 用 ①（服務帳戶金鑰）；DEV 網址先用 workers.dev；Workers Paid 已訂。
- **第 0 階段過關（本機 `wrangler dev`）：**
  - A1 沒有發生：全部打包後，個股、產業、ETF、特別股、排行、篩選頁都正常渲染；瀏覽器開 14 頁沒有 hydration 警告與錯誤。
  - Worker 未壓縮 8.3 MiB、gzip 1.75 MiB（上限 64 MiB，官方已取消壓縮後的上限；下面「方案」那條的 3／10 MB 是舊數字）。
  - 啟動 CPU 約 219 ms（本機量，上限 1 秒）。
  - 免費方案不能用：每次請求只有 10 ms CPU、50 個子請求。
- **第 1 階段已改：** A2（`googleServiceAccountKey`＋`serviceAccountAssertion`）、A3 前半（內部請求改看 `coldStartParent`）、A5、A6、A7（KV＋`patches/nitropack@2.13.4.patch` 讓快取的背景重算掛上 `waitUntil`；`/api/cached` 的鍵超過 300 bytes 改雜湊）、A8（拿掉共用的 IAM 請求；12 格限流當時以為「等待的請求還活著時跨請求解開沒問題」而留著，**錯了**，10/29 拿掉：排隊的請求自己沒有 I/O，Workers 直接當成卡住取消、回 500，位子還會漏掉。寶雅指標速覽的月營收 500 就是它，本機 workerd＋慢的假業務中台 20 個同時穩定重現 8 個 500；`scripts/check-concurrent-upstream.mjs` 在 CI 的 workers smoke 守著）、B（Workers 上不叫醒業務中台、不送 webup）。平台判斷是 `server/utils/platform.ts` 的 `onWorkers`。
- **DEV 已上 Workers（手動部署）：** https://oingg-web-nuxt-dev.oingg-web-nuxt.workers.dev（Worker `oingg-web-nuxt-dev`，Cloudflare 量的啟動時間 70～115 ms）。KV `oingg-web-nuxt-dev-cache`（第一次部署時 wrangler 自動建）、D1 `oingg-web-nuxt-dev-content`。GCP 服務帳戶 `web-nuxt-workers@oingg-web-dev`，只有業務中台 DEV 的 `run.invoker`；金鑰只在 Worker 機密 `NUXT_GOOGLE_SERVICE_ACCOUNT_KEY`。Nitro 金鑰複製一份到機密 `NUXT_BUSINESS_NITRO_KEY`（使用者選複製：去 Secret Manager 讀會在冷啟動多一段延遲，跟換平台的目的相反；業務中台換金鑰時這邊要跟著換）。瀏覽器開 14 頁沒有錯誤。
  - 建置與部署：`NITRO_PRESET=cloudflare_module NUXT_SITE_ENV=preview pnpm build`，再 `pnpm dlx wrangler@4 deploy`。Nitro 對這個 preset 預設用 `nodejs_compat`＋`no_nodejs_compat_v2`（它的 polyfill 配 v1），照它的。
  - Nitro 讀環境變數會把 JSON 字串解析成物件，服務帳戶金鑰兩種都要收。
- **冷啟動怎麼量（10/29 收進 repo）：** `node scripts/measure-cold-start.mjs /stock/{沒開過的代號}/dividend`。流程寫在腳本開頭：先請管理站停掉打 DEV 的輪詢（業務中台 `/admin/health`、數據中台 `/health` 每 30 秒一次，10/29 22:14 量到）、選沒開過的頁、腳本先查兩邊 Cloud Run 請求紀錄閒置 20 分鐘以上才打開頁面，印出跟下面各表同樣欄位的一列。以下各節在這支之前，用的是暫存資料夾的臨時腳本，量法相同。
- **2026-10-27 冷啟動比較（第一輪）：** 測試機的 Chromium 每次送出請求前約有 3 秒自己的開銷（App Hosting 的 l2gfet4t7 比 ttfb 少 2.8～2.9 秒；Workers 那次 requestStart 3,164 ms），所以比「送出請求到第一個位元組」：App Hosting 8.2／8.4／10.8 秒（三層全冷），Workers KV 命中 1 秒內／1.17 秒。KV 沒有那頁的情況沒量準（業務中台被一個開著的 Workers 分頁先叫醒，那次也沒記 requestStart），10/28 凌晨重測。
  - 中華電信（HiNet）的流量進 Cloudflare 聖荷西（colo SJC，RTT 約 126 ms），不是台灣節點；Worker 從 SJC 打新加坡的業務中台。使用者手機的行動網路進新加坡（colo SIN，10/27 使用者回報），跟業務中台同區。入口機房不能指定；程式執行的機房可以（`placement.region`，見下一條）。
  - **10/27 09:41（台灣時間）Workers 最壞情況：** `/stock/1104/dividend`，KV 沒有、Worker 冷、業務中台冷（閒置 75 分鐘，叫醒 4 個容器），從 HiNet 測（SJC）。送出請求到第一個位元組 6.6 秒；Worker 內 5.96 秒，其中等業務中台 5.47 秒，Worker 自己約 0.5 秒，網路約 0.6 秒；CPU 403 ms。對照 App Hosting 三次（l2gfet4t7 減 waitall）：web-nuxt 自己加容器啟動 3.8～6.5 秒，Workers 1.1 秒。Workers 等業務中台多約 1 秒（4.2～4.5 → 5.5 秒），原因是 App Hosting 的 `business-wake.ts` 在行程一起來就叫醒業務中台，它自己啟動的 1.2～1.5 秒跟業務中台的冷啟動重疊；Workers 啟動約 70 ms，沒有可以重疊的時間（不是距離，下一條證明）。
  - **10/27 10:25 Placement 新加坡執行**（`"placement": { "region": "gcp:asia-southeast1" }`，`cf-placement: remote-SIN`、`cf-ray` 仍是 SJC）：`/stock/1103/dividend`，同樣全冷。送出請求到第一個位元組 7.7 秒（比 SJC 執行慢 1.1 秒）；等業務中台 5.50 秒（沒變），Worker 自己 1.1 秒（SJC 是 0.5），Worker 以外 1.0 秒（SJC 是 0.6，回應多繞 SJC→新加坡→SJC）。管理站用業務中台自己的紀錄拆「等業務中台」：web-nuxt 到業務中台 1.35 秒（SJC 是 1.96），業務中台啟動＋處理 4.08 秒（SJC 是 3.46）。三次都拆完後（12:43 那條）看不出這段有省：同一趟各容器之間就差 0.3～0.5 秒。
  - **10/27 12:43 新加坡執行第二次**：`/stock/1108/dividend`，業務中台閒置 40 分鐘、只叫醒 1 個容器。送出請求到第一個位元組 7.2 秒；等業務中台 5.53 秒，Worker 自己 0.5 秒（跟 SJC 一樣，10:25 那次的 1.1 秒是偶發），Worker 以外 1.2 秒。兩次新加坡執行的「等業務中台」都跟 SJC 一樣約 5.5 秒，Worker 以外都多 0.4～0.6 秒（請求與回應多繞 SJC↔新加坡），整頁慢 0.7～1.1 秒。
  - 管理站用業務中台紀錄拆三次（取等最久的容器）：web-nuxt 到業務中台 1.96／1.35／1.59 秒（同一趟各容器差 0.3～0.5，新加坡執行看不出有省），業務中台啟動 2.35／2.71／2.42（幾乎都是載入模組），業務中台處理 1.10／1.37／1.13（幾乎都在等同樣冷的數據中台：容器晚 1.4～1.9 秒起來、連資料庫 0.75～1.2 秒）。等業務中台的 5.4 秒都在上游，換 web-nuxt 的主機或執行位置都動不到。業務中台再拆這 9 個容器（revision 00115，已打包）：啟動裡載入模組佔 2.1～2.6 秒（96～98%），打包前 22 筆中位數約 3.9 秒、這 9 筆約 2.3 秒；處理那段等數據中台 0.6～1.8 秒；我們等的比它從行程啟動到回應多 1.1～1.4 秒，是 Cloud Run 開容器加網路。
  - **使用者決定拿掉 Placement**（10/27 13:33 重新部署，版本 5d5b513e，回應不再有 `cf-placement`）：回到入口機房執行；10/28 02:00 那次就是 SJC 執行的第二個樣本。
  - **10/28 04:09 SJC 執行第二次**（02:00 的排程因電腦休眠沒跑，補跑）：`/stock/1101/dividend`，KV 沒有、Worker 冷、業務中台冷（叫醒 3 個容器）。送出請求到第一個位元組 7.3 秒；Worker 內 6.49 秒，其中等業務中台 5.95 秒（最久那支 5.90），Worker 自己 0.54 秒，Worker 以外 0.84 秒。跟 09:41 那次（6.6 秒：等 5.47、自己 0.5、以外 0.6）一樣：Worker 自己約 0.5 秒，其餘是上游與網路。報告已帶 requestStartMs 與 edgeColo。管理站用業務中台紀錄拆最久那支（beff0d05）：web-nuxt 到業務中台 2.47 秒（開容器加網路約 2.24），業務中台啟動 3.16（載入模組 3.10，另兩支 2.35／2.46，這支是偶發慢），處理 0.28（業務中台開機叫醒已先把數據中台叫起來；09:41 那次數據中台還冷，處理 1.10）。7.33 秒裡業務中台的冷啟動（開容器＋啟動）佔 5.6 秒。
  - **10/28 業務中台換成 Go 之後的冷啟動（使用者「希望安排冷啟動測試」）**：Workers DEV＋Go DEV（e3ee89c），HiNet（SJC），KV 沒有、Worker 冷、業務中台與數據中台都冷（各閒置 45～51 分鐘），每次叫醒業務中台 4 個容器。

    | | Go 15:02 `/stock/1102/dividend` | Go 15:48 `/stock/1110/dividend` | TS 10/28 04:09 | TS 10/27 09:41 |
    |---|---|---|---|---|
    | 業務中台最久那支 cold | 4.37 秒 | 5.50 秒 | 5.90 秒 | 5.42 秒 |
    | 等業務中台（waitall） | 4.79 | 6.13 | 5.95 | 5.47 |
    | Worker 內（web） | 5.36 | 6.85 | 6.49 | 5.96 |
    | Worker 自己（web−waitall） | 0.58 | 0.71 | 0.54 | 0.49 |
    | 送出請求到第一個位元組 | 6.09 | 7.38 | 7.33 | 6.57 |

    兩次 Go 差 1.3 秒，跟 TS 的兩次重疊，n=2 看不出整體變快。業務中台拆 15:02 那次：跨海建連線約 0.5 秒、Cloud Run 開容器 0.9～1.3 秒、Go 從行程啟動到監聽 21～35 ms（TS 載入模組 2.1～3.1 秒那段沒了），處理第一個請求 2.3～2.7 秒幾乎都在等數據中台。數據中台查自己的紀錄：同時開 4 個容器、各約 0.7 秒就緒，頁面那幾支 1.1～1.8 秒，多半在等休眠的 Neon 庫（mops、twse…）醒來；醒了之後 15～65 ms。TS 也在啟動時叫醒數據中台，載入模組跟數據中台的冷啟動本來就重疊，所以 Go 啟動變快沒有縮短等待——現在的瓶頸是 Cloud Run 開容器加數據中台與 Neon 的喚醒，web-nuxt 與 Go 本身都不在上面。15:48 那次多的約 1.1 秒（業務中台拆）：Cloud Run 開容器分兩批，第一批 1.45 秒（15:02 是 0.9～1.3）、第二批晚 1.1 秒才開始建；數據中台約 2.5 秒才開始回應（15:02 是 1.8），4 台都卡在等它；數據中台自己拆：Cloud Run 準備容器約 1.0 秒、程式就緒 1.22 秒（15:02 是 0.68～0.74），多的幾乎都在連 twse 的 Neon 庫（1.17 秒，15:02 是 0.62～0.66，這次醒得慢），第一個頁面請求再等上游庫約 1.1 秒（兩次一樣）。Go 自己兩次都在 50 ms 內——浮動全來自 Cloud Run 與數據中台。
  - **10/28 同時叫醒數據中台（7f8e956d，使用者「web-nuxt 收到請求時，同時叫醒業務中台和數據中台」）**：Worker 要打業務中台時順手在背景 `GET /` 數據中台（每個 isolate 5 分鐘一次；web-nuxt-workers 在 oingg-data-rust-dev 有 run.invoker，使用者在 data-rust session 核准）。叫醒後再測兩次，條件同上：

    | | 叫醒前 15:02 | 叫醒前 15:48 | 叫醒後 16:58 `/stock/1109/dividend` | 叫醒後 17:44 `/stock/1210/dividend` |
    |---|---|---|---|---|
    | 業務中台最久那支 cold | 4.37 秒（4 台） | 5.50（4 台） | 3.45（3 台） | 5.44（1 台） |
    | 等業務中台（waitall） | 4.79 | 6.13 | 4.24 | 5.60 |
    | Worker 自己（web−waitall） | 0.58 | 0.71 | 0.51 | 0.49 |
    | 送出請求到第一個位元組 | 6.09 | 7.38 | 5.67 | 6.65 |

    整體平均 6.74 → 6.16 秒，差 0.6 秒，小於同一組兩次之間的浮動（叫醒前差 1.3、叫醒後差 1.0），n=2 對 n=2 不能說整體變快。分段看得出叫醒有效：16:58 那次（兩邊都冷；業務中台與數據中台只閒置 31 分鐘，16:26 管理站部署後開過冷啟動頁，但都已縮到 0）Worker 的 `GET /` 比業務中台自己的叫醒早 1.0 秒到，數據中台開容器跟業務中台重疊；業務中台等數據中台（upstream_ms）從 2.33～3.45 秒降到 1.79～1.82 秒，數據中台這邊頁面請求等容器從 1.5～2.2 秒降到 0.77 秒、就緒後等庫從約 1.1 秒降到 0.2～0.35 秒。17:44 那次條件不同：數據中台的容器 17:35 被上游通知（`POST /upstream/changes`）叫醒、是熱的，但它的 Neon 庫已休眠（閒置超過 5 分鐘）——`GET /` 不碰資料庫叫不醒 Neon，頁面那幾支在數據中台花 0.9～3.45 秒等庫醒來。剩下的瓶頸：Cloud Run 開業務中台容器（0.9～2.1 秒）與數據中台背後 Neon 庫的喚醒（數據中台容器熱的時候也一樣要等）。
  - **10/28 叫醒時也叫醒資料庫（data-rust 763995c，使用者「叫醒數據中台時也叫醒資料庫」）**：數據中台收到 `GET /` 照樣馬上回，背景同時對 own、twse、tpex、mops、sitca 各送 `SELECT 1`（每個容器 60 秒一次）。web-nuxt 不用改。量「兩個中台都熱、Neon 睡」（先打 `/api/system-health` 叫熱，靜置 7 分鐘讓 Neon 過 5 分鐘自動休眠，再開 KV 沒有的個股頁；這種情況沒有冷啟動紀錄，看頁面的 waitall）：部署前 18:09 `/stock/1218` 3.24 秒（18:02 `/stock/1213` 3.46 秒，own 被 18:00 的上游通知查過還醒著，只算一半）；部署後 18:18 `/stock/1220` 2.54 秒、18:25 `/stock/1225` 2.51 秒。n=2 對 n=2，兩組不重疊，約快 0.7～0.9 秒。數據中台拆（[wake] db）：叫醒與頁面請求幾乎同時到（差 −8～+70 ms，Go 熱的時候沒有提早量），上游庫醒來 0.65～1.1 秒、own（數據中台自己的 Neon DEV 庫）1.8～2.0 秒；單支請求沒變快，省的是第二波請求（到的時候庫已經醒了，0.01～0.06 秒）。剩下約 2.5 秒＝約 2.0 秒等 own 醒來＋約 0.5 秒在數據中台之外；要再縮得改 own 的休眠設定或查它為什麼比上游慢一倍（數據中台與使用者的事，web-nuxt 不用改）。
  - **10/28 晚上全新版本一起的全冷**（web-nuxt f2f912a0：叫醒數據中台、clientTiming 新名；業務中台 Go 9099dd2；數據中台 85aec25：叫醒也叫醒資料庫、各庫 Server-Timing）。兩次都兩邊閒置約 45 分鐘、中間沒有上游通知：

    | | 叫醒前 15:02 | 叫醒前 15:48 | 叫醒後 16:58 | 叫醒後 17:44 | 全新 21:49 `/stock/1227` | 全新 22:35 `/stock/1229` |
    |---|---|---|---|---|---|---|
    | 條件 | 全冷 | 全冷 | 全冷（閒置 31 分） | Go 冷、數據中台容器熱、Neon 睡 | 全冷 | 全冷 |
    | 業務中台最久那支 cold | 4.37 秒 | 5.50 | 3.45 | 5.44 | 3.88 | 3.32 |
    | 等業務中台（waitall） | 4.79 | 6.13 | 4.24 | 5.60 | 3.88 | 3.33 |
    | Worker 自己 | 0.58 | 0.71 | 0.51 | 0.49 | 0.48 | 0.53 |
    | 送出請求到第一個位元組 | 6.09 | 7.38 | 5.67 | 6.65 | 5.08 | 4.51 |

    全新兩次平均 4.80 秒（差 0.57），叫醒前兩次平均 6.74 秒（差 1.29）：差 1.9 秒，大於兩組各自的浮動，兩次全新都比兩次叫醒前快；n=2 對 n=2，算「看得出變快」，還不是定論。Worker 的 `GET /` 兩次都比業務中台自己的叫醒早到數據中台（1.13、0.87 秒）。業務中台拆 21:49：等數據中台 1.16～1.58 秒（叫醒前 2.3～3.4），數據中台自己處理 <8 ms，等庫 0.84～0.99 秒幾乎都在 mops（sitca 也有一支 0.76）；剩下約 0.5 秒跨海建連線＋1.0～1.5 秒 Cloud Run 開業務中台容器（最大的一塊）＋0.6～0.9 秒 mops／sitca 醒來。數據中台查出 mops、sitca 是在 own／twse／tpex 連好（約 0.85 秒）之後才開始叫，提議一開始就並行（它跟使用者談）。clientTiming 新名稱、firstRequestSpans、各庫 serverTiming 業務中台都確認寫進去了。
  - **10/29 凌晨冷啟動系列（使用者睡前「可以多安排幾次，各種測試」）**：網路／容器啟動拆分上線後（web-nuxt 6b2b0409：webColdOffsetMs、clientTcpRttMs、webWakeOffsetMs、webWakeMs、webWakeTokenMs；業務中台 fddcce1、數據中台 20176b4：instanceId、沙盒、Cloud Logging 補寫）。5 次都照排程跑、沒有略過，每次前查兩邊 log 確認閒置：

    | 台北 | 條件 | 入口（rtt） | 業務中台最久那支 cold | waitall | Worker 自己 | 送出請求到第一個位元組 | webColdOffsetMs | 叫醒：送出／換 token／總長 |
    |---|---|---|---|---|---|---|---|---|
    | 00:48 | 全冷 | CDG（268 ms） | 7.86 秒 | 7.86 | 0.31 | 9.22 | 116–119 ms | 116／42／6,053 ms |
    | 01:34 | 全冷 | SJC（127） | 3.81 | 3.85 | 0.64 | 5.10 | 309–349 | 307／135／2,541 |
    | 02:20 | 全冷 | LHR（264） | 4.69 | 4.70 | 0.19 | 6.25 | 145–151 | 146／83／2,321 |
    | 02:28 | 兩邊容器熱、Neon 睡 | SJC（127） | —（沒有冷啟動） | 2.26 | 0.61 | 3.53 | — | 307／160／392 |
    | 03:15 | 頁面 KV 命中、後端全冷 | ATL（191） | —（冷啟動在 SWR 背景重算） | 0 | 0.67 | 1.62 | — | — |

    **SJC 全冷**（21:49、22:35、01:34，n=3）平均 4.90 秒（最大差 0.59），叫醒前（15:02、15:48，n=2）平均 6.74 秒（差 1.29）：差 1.84 秒，大於兩組各自的浮動、三次都比叫醒前兩次快——叫醒有效，樣本小但方向一致。**SJC 全冷約 5 秒的組成**（業務中台、數據中台用新欄位與 Cloud Logging 拆 01:34）：瀏覽器到入口 0.13 秒來回；Worker 送出前 0.31～0.35 秒（其中換業務中台／數據中台的 ID token 約 0.14 秒，新 isolate 才有）；Worker 到業務中台網路 0.49～0.97 秒；業務中台開容器 0.83～1.21 秒（排程 0.04～0.08、沙盒準備 0.32～0.46、沙盒開機 0.34～0.79、Go 就緒 0.02）；等數據中台 1.6～2.1 秒（數據中台排程 0.05、開容器 0.6、程式啟動 1.3（連 own／twse／tpex），之後頁面請求再等 mops／sitca 0.7～0.9）；Worker 自己 0.5～0.6 秒。**入口不固定**：HiNet 今晚的入口在 SJC、CDG、LHR、ATL 之間換（白天量到的都是 SJC），歐美入口的 rtt 191～268 ms、Worker 到新加坡的網路 0.74～1.72 秒，比 SJC 多約 0.3～1 秒。**00:48 慢到 9.2 秒**是歐洲入口加上數據中台 own 庫的 Neon 開機 2.8 秒（同一天 own 的 start_compute 從 0.33 到 2.8 秒，數據中台判斷是 Neon 那端本身不穩，不是我們觸發的）。**容器熱、Neon 睡**（02:28）2.26 秒，跟 18:18／18:25 的 2.54／2.51 同一級（部署叫醒資料庫前 18:09 是 3.24）：快在五個庫同時醒，不是叫醒搶先——Go 是熱的時候頁面請求比叫醒早 52 ms 到。**KV 命中**（03:15）使用者第一個位元組 1.62 秒、沒等冷啟動；後端由 SWR 背景重算叫醒，瀏覽器只有 /api/system-health 等了約 1 秒，這種冷啟動紀錄沒有 clientTiming 是正常的。資料品質：業務中台 Cloud Logging 補寫有 bug（觸發請求還沒進 log 就當查齊），02:20 的 87722084 與 03:15 的 112a5c04 的觸發／第一個請求欄位不準，修正 a95bf62 於 03:40 前後部署；數據中台查庫補的（id 147–150，觸發請求都是 Worker 的 `GET /`）：排程 34～55 ms、沙盒準備 335～575 ms、沙盒開機 78～252 ms（開容器合計 0.5～0.7 秒，Cloud Run 平台時間），程式啟動平常 0.85～1.34 秒（幾乎都在連 own／twse／tpex；00:48 那次 4.69 秒是 own 的 Neon 開機 2.8 秒），頁面請求到了之後在 Cloud Run 等數據中台容器就緒 0.42～1.19 秒（00:48 是 4.52）——Worker 叫醒得越早這段越短（03:15 提早 1.24 秒，只剩 0.42）。
    **數據支持的下一步**：web-nuxt 已不在瓶頸上（Worker 送出前 ≤0.35 秒、自己 ≤0.65 秒），先不再改——提前備好數據中台 token 最多省約 0.3 秒、只在容器熱 Neon 睡的情況。剩下最大的是平台時間：業務中台開容器約 1 秒、數據中台開容器加連庫 1～2 秒（Neon 開機不穩時 4～5 秒），能動的只有常駐 1 台或 Neon 不休眠（要花錢，使用者決定）；mops／sitca 提早叫醒使用者 10/28 決定不做。HiNet 入口在歐美時多出的 0.3～1 秒，跟自訂網域時要問 Cloudflare 的方案是同一件事。
  - **10/29 12:40 數據中台「就緒前不等資料庫」（8c66c54，revision 00038）後重量一次**（業務中台預告、本 session 跑；/stock/1235/dividend，KV 沒有它的鍵，兩邊閒置 57 分鐘，n=1）：入口 SJC（rtt 126），業務中台兩支 cold 2.34／2.45 秒（夜間 SJC 3.3～3.8），waitall 3.43（夜間 3.33～3.88），Worker 3.76，送出請求到第一個位元組 4.81（夜間 4.51～5.10、平均 4.90），叫醒 `GET /` 1.23 秒（夜間 2.32～2.54）。數據中台拆（冷啟動紀錄 id 155）：就緒從 0.85～4.69 秒降到 0.044 秒，五個庫在背景同時叫醒、各 0.75～1.16 秒（Neon 開機本身，沒變）；業務中台第一批請求到時庫已醒 0.45 秒，剩下的在查詢裡等（殖利率歷史等庫 0.76 秒），第二批 34～204 ms。等庫沒有挪到後面，這次省約 0.3～0.5 秒；省最多的是 own 開機慢的情況（00:48 那種），這次沒碰到。
    **waitall 拖到 3.43 秒的是 Workers 的連線上限**（業務中台拆＋對時間）：一次呼叫最多 6 條連線同時在等回應標頭，第 7 條起排隊到前面某條收到標頭（fetch、KV get 都算；developers.cloudflare.com/workers/platform/limits/ 的 Simultaneous open connections）。這頁的 10 支業務中台呼叫在 setup 時一起發出（series 路由也是同一個 `Promise.all`，web-nuxt 的 semaphore 是 12，不卡），加上叫醒共 11 條擠 6 個位子：metrics-history FY 排在叫醒後面（叫醒 1,531 ms 收到標頭 → 它約 1,717 ms 送出，但到了 Cloud Run 又跟第一批一起排隊，沒落在關鍵路徑上）；第二批四支（除權息公告、daily-price-history?limit=2000、TTM、`/metrics`）等第一批冷的那幾支收到標頭才送（profile 約 2,648 收到標頭 → 下一支約 2,770 送出），最後一支比冷的那支晚 385 ms 做完。剩下 0.29 秒是讀回應本文（waitall 算到本文讀完、JSON 解析完；大本文從新加坡回 SJC 多幾個來回）。KV 沒命中的頁面每次都會排這一輪，業務中台熱時每支 0.1～0.3 秒、代價小。能動的只有減少一頁的呼叫數（例如業務中台把摘要卡的 profile／報價／近 2 天股價合成一支，要改業務中台）；叫醒的 `GET /` 一定要等數據中台容器開好才有標頭，避不掉。先記錄、不改（冷啟動能省約 0.4 秒，排在開容器與 Neon 開機之後），等使用者決定。
    **熱的時候也排隊**（10/29 13:52 量，業務中台剛部署完是熱的；先開 /stock/1241/dividend 暖機，再量 1237、1238，n=2，到達時間看業務中台 Cloud Run 請求 log）：前 6 支 +0～41 ms 到，後面 3 支 +235～+263（1237 的 FY 指標 +402，排到第三波），每支 Go 31～130 ms；waitall 662／469 ms、Worker 1,013／561 ms——排隊多 0.2～0.4 秒，約 Worker 時間的 25～35%（1238 的基本資料回 404，不是正常頁，排隊的樣子一樣）。**但使用者只在「這一頁第一次」才等得到它**：swr 下 KV 有值就先回舊值、背景重算（nitropack `cache.mjs`：`entry.value === undefined` 才 await），而 KV 鍵永遠不過期——所以同一頁第二次起，業務中台冷或熱使用者都不等。受益的只有每個鍵第一次被打開（爬蟲第一次爬到的長尾頁、新股票、改了快取鍵）、PRD 剛上線 KV 是空的時候，以及使用者看不到的背景重算。**業務中台評估過通用 bundle**（`GET /stocks/{symbol}/bundle?part=…`，內部平行、每段各自 status，約半天；web-nuxt 在 `businessFetch` 收集同一請求的呼叫合併，約 100～150 行）；**10/29 使用者選先不做**，改成 PRD 上線前預熱 KV（見第 4 階段），Search Console 的爬取統計顯示回應太慢時再考慮。
  - **10/29 22:42 全冷，第一次用 `scripts/measure-cold-start.mjs`**（使用者「你這邊可以安排冷啟動測試嗎」；/stock/1219/dividend，7 天的 Workers Logs 沒人開過＝KV 沒有；業務中台閒置 20.4 分、數據中台 27.7 分，Worker 是 22:27 剛部署的新版 c704c230；管理站的服務健康頁 22:14 起關著，n=1）：

    | 台北 | 入口（rtt） | 業務中台最久那支 cold | waitall | Worker 自己 | 送出請求到第一個位元組 | webColdOffsetMs | 叫醒：送出／換 token／總長 |
    |---|---|---|---|---|---|---|---|
    | 22:42 | SJC（126） | 3.01 | 3.40 | 0.98 | 5.82 | 878–883 ms | 908／598／1,359 ms |

    比 SJC 全冷（凌晨 4.51～5.10、12:40 的 4.81）慢約 1 秒。多出來的在 Worker 送出第一支業務中台呼叫之前：0.88 秒（之前 0.12～0.35），其中換數據中台 ID token 0.60 秒（之前 0.04～0.16），業務中台那張應該也是同樣慢；業務中台 4 支 cold 2.60～3.01 秒（12:40 是 2.34／2.45，夜間 3.3～3.8）。只有一次，分不出是 Google 換 token 那一下剛好慢、還是剛部署的新版第一個請求要多載一次；要判斷得在同樣條件下再量幾次。冷啟動紀錄 id：e421a2e4、59f9f79e、af72b6c7、567c497e（最久那支 3,010 ms）。**管理站核對（同日）：中台那側跟以前差不多**——業務中台請求到達後 0.80～1.12 秒能接請求（排程、沙盒開機、初始化都在以前範圍內），第一個請求 0.82～1.14 秒幾乎全在等數據中台第一批查詢等 Neon 醒（own 716、twse 669、mops 1,138、sitca 682 ms）；數據中台比業務中台第一支呼叫早 0.12 秒就能接請求。所以慢的那 1 秒在 Worker 這一側。59f9f79e 的容器 22:27:52 就開好、凍著，請求來才解凍（Cloud Run 自己開的：業務中台在 22:21:44 web-nuxt 部署登記之後到測試前沒有任何請求）。**注意**：web-nuxt 每次部署結束都會叫醒業務中台一次（部署紀錄），量冷啟動要從部署後再等 20 分鐘，腳本會擋。
  - **10/30 凌晨一輪（使用者「安排」，用 scripts/measure-cold-start.mjs，4 次＋22:42 共 5 筆）**：每次換一個 7 天內沒人開過的代號的 /stock/{代號}/dividend（KV 沒有），兩邊閒置滿 20 分鐘才開頁（腳本擋），管理站分頁全關、業務中台 Rust 版停打 DEV。01:27 之後原本排的 3 次因本機 gcloud 登入過期沒跑，使用者重新登入後補跑。

    | 台北 | 代號 | 入口（rtt） | 業務中台最久那支 cold | waitall | Worker 自己 | 送出請求到第一個位元組 | webColdOffsetMs | 叫醒：送出／換 token／總長 |
    |---|---|---|---|---|---|---|---|---|
    | 10/29 22:42 | 1219 | SJC（126） | 3.01 | 3.40 | 0.98 | 5.82 | 878 ms | 908／598／1,359 ms |
    | 01:27 | 1314 | SJC（127） | 3.13 | 3.15 | 0.55 | 4.40 | 284 ms | 284／139／1,386 ms |
    | 02:39 | 1316 | SJC（126） | 4.24 | 4.24 | 0.57 | 5.51 | 322 ms | 361／206／1,142 ms |
    | 03:02 | 1321 | SJC（127） | 2.64 | 3.35 | 0.64 | 5.04 | 385 ms | 440／228／1,251 ms |
    | 03:24 | 1323 | DFW（166） | 3.00 | 3.00 | 0.39 | 4.46 | 164 ms | 164／45／1,498 ms |

    **SJC 4 次**送出請求到第一個位元組平均 5.19 秒（4.40～5.82）；去掉 22:42 的 3 次平均 4.98 秒，跟 10/29 凌晨 SJC 全冷（n=3，平均 4.90、4.51～5.10）與 12:40 的 4.81 同一個水準——這一週的改動（刪掉限流、部署登記、新舊鍵並存）沒有讓冷啟動變慢。**22:42 慢的那 1 秒沒再出現**：之後 4 次 Worker 送出前 0.16～0.39 秒、換 token 0.05～0.23 秒，22:42 是 0.88／0.60，5 次裡 1 次——偶發，分不出是 Google 換 token 那一下慢還是剛部署的新版第一個請求，不追。剩下的起伏在中台那一側：業務中台最久那支 2.64～4.24 秒（02:39 的 4.24 最慢），由開容器與數據中台等 Neon 醒決定（見前面各節）。**管理站核對（10/30）**：02:39 慢在數據中台自己的庫（own）從 Neon 休眠醒來花 2.74 秒（平常 0.66～0.72），數據中台第一個請求 /metrics 2,833 ms 幾乎全在等庫，開容器與兩邊開機都正常（數據中台比業務中台第一次呼叫它早 0.47 秒就能接請求）；03:02、03:24 沒有異常。中台的起伏兩個來源：Neon 庫醒得慢時 own 到 2.7 秒；Go 的執行環境初始化 0.03～0.85 秒不等（Firebase SDK 帶進太多套件、容器映像用到才拉），Rust 版 DEV 是 79 ms。網站這一側穩定。冷啟動紀錄 id：fd464cd3（01:27）；434770b6、98a237f8、68f499dc（02:39）；1e52351b、6a534b97（03:02）；3e6f30e0、6d4bedb9、d8dc7932、5369d673（03:24）。
  - **10/28 持續負載下再比一次新加坡執行**（使用者「Worker 還是固定在新加坡好了」；業務中台 `loadtest.mjs --via web-nuxt`，每秒 3 條 journey、10 分鐘，從 HiNet 打、入口都是 SJC；13:02 SJC 執行、13:34 新加坡執行，個股換一組不重疊的代號）。兩次都 0 錯誤。壓測端量到的 p50：固定頁面（/、/calendar、/rank、/holdings、/screener/common）160–220 → 430–790 ms，個股頁 970 → 1,250 ms，/api/core 330–440 → 350–420 ms（沒變）。Workers Logs 拆開看：/api/core 在 Worker 內 207 → 49 ms（離業務中台近了），但省下的被「SJC 入口 → 新加坡 Worker」那段吃掉；固定頁面在 Worker 內只多 20–50 ms（23–71 → 43–121 ms），多出的 300 ms 以上都在 Worker 外——整頁 HTML 要從新加坡繞回 SJC，比小的 JSON 多好幾個來回。KV 冷、換代號、數據中台擴容只會動到 Worker 內的時間，解釋不了。而入口本來就在新加坡的使用者（手機行動網路），不設 placement 時 Worker 就已經在新加坡執行，設了也沒差。**結論：新加坡執行只讓 HiNet 使用者變慢，10/28 13:48 再次拿掉，b69e4841**（使用者選「恢復並重跑壓測比較」時說好比較慢就拿掉）。
  - 修了一個 bug：頁面用全域 `$fetch` 打自己的 `/api` 時，Nitro 不把外層的 waitUntil 交給內部請求，背景重算在回應送出後被砍掉（業務中台照樣被叫醒、KV 沒更新）。`server/plugins/cold-start-timing.ts` 讓內部請求沿用外層的 waitUntil。
  - 每個回應都帶 Server-Timing（development 3fcd3c9b）；冷啟動報告的 requestStartMs 與 edgeColo（入口機房，Server-Timing 的 `colo`）在分支 `cold-start-request-start`；業務中台 10/27 上 DEV（09ae1a4）後併進 `cloudflare-workers`（1fdca814），16:08 部署 Workers（版本 f7847842），10/28 02:00 那次會帶這兩個欄位。使用者核准後 16:18 推上 development（f7022902），App Hosting DEV 16:21 上線（web-nuxt-dev-build-2026-10-27-002），02:40 那次也會帶。
- **使用者決定拿掉 App Hosting**（10/27，管理站轉達「App Hosting拿掉吧」，本 session 確認「先補齊再刪」）：管理站 DEV 最近 5 次使用者等待平均 App Hosting 12.9 s、Workers 9.8 s。10/28 02:40 的 App Hosting 測試取消。要先補齊才刪 backend：
  - 登入：workers.dev 已加進 Firebase Auth 授權網域與 Browser key 的網站限制（10/27 20:5x）。LINE Developers 的 callback 使用者 10/28 加了（workers.dev 與 hosted.app 各一行；LINE 的 authorize 兩個都到登入頁）。10/28 `pnpm login:check` 對 workers.dev 全過：Google 彈出視窗到帳號選擇、LINE 到登入頁、臨時 Email 帳號登入後 /watchlist 讀到會員資料、跑完刪掉；業務中台沒有 redirectUri 白名單（原樣交給 LINE 核對，`lineSignIn`），只有 LINE 後台這一處。
  - 程式：`cloudflare-workers` 已推上 development（9f8e4058，10/27 20:57），App Hosting 跑同一份（web-nuxt-dev-build-2026-10-27-003，CI 通過、主要頁面 200）。
  - 自動部署：Workers Builds（使用者選），10/28 04:29 連上：只建 `development`、沒有預覽建置；建置變數 `NITRO_PRESET=cloudflare_module`、`NUXT_SITE_ENV=preview`、`PNPM_VERSION=11.24.0`（Node 用它預設的 24.22.1）。**10/29 起部署指令是 `npx wrangler deploy && node scripts/record-deploy.mjs --environment dev`**（部署紀錄，給管理站的版本發布頁；使用者「要做發布管理，尤其是 breaking changes」），建置機密 `DEPLOY_RECORD_KEY`（業務中台 Secret Manager 的 DEPLOY_RECORD_KEY_DEV）與 `DEPLOY_RECORD_GOOGLE_KEY`（服務帳號 `web-nuxt-deploy-record@oingg-web-dev`，只在 oingg-business-go-dev 有 run.invoker）。PRD 的觸發器要照樣設，`--environment prd`，並給這個帳號 PRD 的 run.invoker。
  - **10/30 業務中台 DEV 換成 Rust 版**（使用者「把網站 DEV 切到 Rust 版」）：wrangler.jsonc 的 NUXT_BUSINESS_BASE／AUDIENCE、部署登記與冷啟動腳本都指 `oingg-business-rust-dev`。切之前確認過：第二輪改名 C1、C2、C4、C5、C6 web-nuxt 都收（business-rust-compat.ts）；同一把 Nitro 金鑰、冷啟動 Server-Timing、部署紀錄、LINE 登入都已移植；web-nuxt-workers 與 web-nuxt-deploy-record 是它的 invoker；閒置後連線池讀到 EOF 回 503 的問題（10/30 09:35 抓到）已修（rev 00006，09:59 閒置 8.4 分鐘後連打 4 次都 200）。管理站 DEV 先切過去。退回：兩個網址改回 Go DEV（同一個庫）。第一次建置 04:37～04:40（ab48b75a，版本 a97da365）：KV 沿用（inherited），主要頁面 200。查狀態用 `cf builds list --external-script-id 3added6f2dc84cdab650a6704725f7f2`。
  - A3 後半（5xx 紀錄）：使用者選「改抓 Cloudflare log」——不寫進 GCP、不加 logWriter；`http-errors.ts` 那一行在 Workers Logs 已經是拆好欄位的結構化紀錄（過去一週 10 筆，error hook 與 afterResponse 兩條路都有），管理站用 Cloudflare 的 telemetry query API 讀（最多留 7 天；管理站「排程與服務」只看最近 24 小時，不用另外存）。總數讀 GraphQL `workersInvocationsAdaptive`。管理站 DEV 已上線（10/27，revision 00117）：篩選鍵是 `event`（`source.event` 查不到）加 `$metadata.service`，權杖只有讀取權限，Observability Read 就夠。
  - 完整回歸（10/28 06:xx，對 workers.dev 部署 9b9ddf89）：hydration 83 頁、無障礙 100 組、會員頁閃動、`login:check` 全過；會員頁、分享頁、`/api/core` 沒被 Cloudflare 快取。兩個失敗都跟 Workers 無關：
    - 版面位移：4 個指標頁（/stock/2330/roe、pe-ratio、eps、/stock/7711/shareholder-yield）1440 寬約 2 秒時上移 16px（0.012）；App Hosting 一模一樣，是既有的頁面問題。
    - hub 頁：/industry/30 類股家數 45 對股利統計 46。KV 三筆都是 04:41 寫的、在期限內；`hub-sectors` 快取 24 小時，KV 跨部署留著，App Hosting 的記憶體快取每次部署就清掉才看不出來。
- **App Hosting 已刪（10/28 06:10，使用者確認）：** backend `web-nuxt-dev` 連同 Cloud Run 服務刪掉，hosted.app 回 404；Firebase 授權網域與 Browser key 拿掉 hosted.app（之後 `login:check` 全過）。管理站拿掉那一列；業務中台 10/28 經使用者核准收回 firebase-app-hosting-compute 的 run.invoker、NITRO_SHARED_SECRET_DEV 的讀取與檢視權，以及 App Hosting 服務代理的檢視權；oingg-business-ts-dev 的 invoker 只剩 web-nuxt-workers@oingg-web-dev 與 admin-vue-dev@oingg-admin（本 session 查過，Workers 照常打得到業務中台）。Workers Builds 的預覽建置 10/28 關掉（`previews_enabled` 原本預設開著，PR 分支被拿去建、沒有建置變數而失敗）。LINE Callback URL 只剩 workers.dev（使用者刪了 hosted.app，探測確認）。程式清理（PR #17，10/28 合併部署，之後 `login:check` 全過）：刪 `business-wake.ts`、`compress-responses.ts`（連同 `compressPublicAssets` 與 CI 的壓縮檢查）、`apphosting*.yaml`、metadata server 身分、X-Forwarded-For 取 IP、webup（`webUptimeMs` 欄位留著、一律 null）；腳本預設網址改 workers.dev。
- **CI 的 Workers 冒煙測試（10/28，PR #19）：** `workers smoke` job 照 Workers Builds 的方式建置，用 `wrangler dev` 在 workerd 開起來（KV、D1 本機模擬，GitHub 上不需要 Cloudflare 登入，約 7 秒起來），`SMOKE_PATHS` 每頁都要 200；頁面清單跟 Node 版開機測試共用。development 的 ruleset 加上它必過，Dependabot 自動合併也等它。
- **業務中台換成 Go 版（10/28 09:09）：** 先上新舊回應鍵都收的版本（PR #18，`shared/utils/business-go-compat.ts`），再經使用者核可把 wrangler.jsonc 的 `NUXT_BUSINESS_BASE`／`NUXT_BUSINESS_AUDIENCE` 換成 oingg-business-go-dev（e1855f4c）。TS DEV 同日中午經使用者停掉，不會退回。KV 裡 TS 時期的快取照 TTL 慢慢換掉。
- **還沒做：** A9（大小與啟動時間都夠，先不做）、C 的主控台設定（自訂網域、GA4）。

## 盤點結果：哪些東西要改

以下來自三路唯讀盤點，路徑都是本專案。

### A. 一定要解決（不解決就不能上線）

| # | 問題 | 位置 | 做法 |
|---|---|---|---|
| A1 | **全部打包會讓個股頁壞掉**（`Class extends value [object Module]`）。Workers 一定要全部打包。 | `nuxt.config.ts`：nitro 那行的註解，2026-10-26 實測 | 第 0 階段先找出是哪個套件，再看要改 import 或換寫法 |
| A2 | **連業務中台的身分：** IAM 憑證是向 GCP metadata server 拿的，Cloudflare 上沒有，每支呼叫都會被 403 | `server/utils/business.ts`：`businessAuthHeaders`、`METADATA_IDENTITY_URL`、`x-serverless-authorization` | 二選一，要跟業務中台定：① 用服務帳戶金鑰在 Worker 裡以 `crypto.subtle` 簽 RS256 JWT，換 Google 的 ID token（保留 IAM 鎖）；② 業務中台拿掉 IAM 鎖，只靠 Nitro 金鑰加 ingress 限制。`shared/utils/id-token.ts` 的到期判斷可沿用 |
| A3 | **5xx 紀錄會全部漏掉：** Workers 上每個請求都帶 `__unenv__`，`http-errors.ts` 會全部當成內部請求跳過。而且紀錄原本是寫給 GCP log-based metric `http_errors`，管理站「排程與服務」頁讀的就是它 | `server/plugins/http-errors.ts`、`server/utils/http-error.ts` | 改用別的方式判斷內部請求（例如 `cold-start-timing.ts` 已經有的 `coldStartParent`）；紀錄的去處跟 oingg-admin-vue 一起定：Workers Logpush 到 GCP，或像冷啟動報告一樣 POST 給業務中台 |
| A4 | **Nuxt Content 用 `node:sqlite`，Workers 沒有** | `nuxt.config.ts`（`sqliteConnector: 'native'`）、`content.config.ts`（blog 集合，4 篇） | 照官方做法改用 D1（`content.database: { type: 'd1', bindingName: 'DB' }`）；`/blog/**` 也可以預先產生成靜態頁 |
| A5 | **回應可能被壓縮兩次：** 我們自己壓 brotli／gzip，Workers 又會依 `Content-Encoding` 再處理，還會吃 CPU | `server/plugins/compress-responses.ts` | 在 Workers 上停用，交給邊緣壓縮；`compressPublicAssets` 也可以拿掉 |
| A6 | **使用者 IP 會取錯：** 取 X-Forwarded-For 從右邊數第 3 段，這是照 App Hosting 的兩層代理量出來的；換平台後會是空的或可被偽造，業務中台的限流會把所有匿名訪客算在同一桶 | `server/api/core/[...path].ts` | 改讀 `cf-connecting-ip` |
| A7 | **伺服器快取只存在記憶體：** 46 支 `defineCachedFunction`，沒有掛任何 storage。Workers 的 isolate 很短命，快取幾乎命中不了；背景更新沒用 `waitUntil`，回應送出後可能被中斷 | `server/utils/hub-data.ts`（19）、`stock-data.ts`（7）、`screener-data.ts`（8）、`macro-data.ts`（4）、`company-logo.ts`、`server/api/cached/[...path].get.ts`（3）等 | `nitro.storage.cache` 掛 Cloudflare KV；包一層讓背景更新呼叫 `event.waitUntil`（用 `useEvent()`，asyncContext 已經開了）。KV 的 key 上限 512 bytes：`/api/cached` 的 `keyOf` 直接用使用者送來的 query 組 key，要先正規化並限制長度。`system-health` 的 15 秒 TTL 在 KV 會被拉長到 60 秒，要另外處理 |
| A8 | **跨請求共用的 promise：** Workers 不允許一個請求去解開另一個請求的 promise，可能卡住 | `business.ts` 的 12 格限流（`active`／`waiters`）、IAM 憑證的共用請求 `identityRequest` | 限流拿掉（10/29；Workers 每個請求本來就最多 6 條同時連線）。憑證只快取「值」，不快取 promise。nitropack 快取的同時讀取（`pending[key]`）實測沒事：同一個鍵同時 3 個都 200 |
| A9 | **Firebase Auth 的 Node 版被打包進伺服器端**（`@firebase` 1.4 MB＋undici 1.2 MB） | `app/pages/profile.vue`、`app/pages/auth/line.vue` 在頂層 import `firebase/auth` | 照 2026-10-26 `UserEmailVerificationGate.vue` 的做法，改成用到時才 import |

### B. 換平台後語意會變、要調整

- **冷啟動量測：** `server/plugins/cold-start-timing.ts` 的 `webup`（把 `performance.now()` 當成行程啟動多久）和 `webcold`（行程的第一個請求）在 Workers 上失去意義。數值太大的話，`cleanColdStartReport` 會整筆拒收。改法：Workers 上這兩欄送 null；業務中台的 cold id 和等待時間照用。欄位語意跟業務中台、管理站共用，改之前要先告訴他們（CLAUDE.md 那一列）。
- **開機叫醒業務中台：** `server/plugins/business-wake.ts` 在 Workers 上沒有「開機」這回事，而且全域範圍不能發 fetch，會變成什麼都不做。直接移除；要不要改用 Cron Trigger 定時叫醒，是另一個決定。
- **sitemap：** `server/api/__sitemap__/stocks.get.ts`、`hubs.get.ts` 快取冷的時候，一次要打很多上游、算很多 URL。要確認付費方案的 CPU 和子請求上限夠用，必要時改成預先產生。
- **大套件在啟動時就被執行：** Workers 一啟動就評估整包程式。KaTeX（`server/utils/hub-data.ts` 頂層 import）、ECharts（SharedChart chunk 1.8 MB）都會吃啟動 CPU。KaTeX 改成用到時才載入；shiki（Nuxt Content 帶進來的 wasm）要確認執行時用不到，因為 Workers 不能在執行時把 bytes 編譯成 WASM。
- **伺服器端每支上游呼叫都要回新加坡：** 試 Smart Placement，讓 Worker 跑在靠近業務中台的地方，再比較延遲。

### C. 網域、主控台、設定（不是程式碼）

- **環境變數：** `apphosting.dev.yaml` 裡的值要搬到 wrangler vars／secrets：
  - `NUXT_BUSINESS_BASE`、`NUXT_BUSINESS_AUDIENCE`
  - `NUXT_BUSINESS_NITRO_KEY`（目前在 Secret Manager）
  - `NUXT_PUBLIC_FIREBASE_*`
  - `NUXT_PUBLIC_LINE_LOGIN_CHANNEL_ID`（PRD 要另外設）
  - `NUXT_SITE_ENV=preview`：DEV 一定要設，否則 DEV 會被搜尋引擎收錄
  - `NUXT_SITE_URL`
- **新網域要加進的地方：**
  - Firebase Auth 的 Authorized domains
  - Firebase Browser API key 的網站限制（目前只收四個網站）
  - LINE Developers 的 callback URL：`https://<新網域>/auth/line`，並確認業務中台有沒有白名單 `redirectUri`
  - GA4 資料串流
- **canonical、og:url：** 這些都用 `useRequestURL().origin`（`useHubPageSeo.ts` 等）。`*.workers.dev` 的網址要關掉，不然會產生自己指向自己的重複頁面。
- **使用者影響：**
  - 登入狀態、同意 cookie 都綁在舊網域，搬完大家要重新登入、重新同意。
  - 已經分享出去的 `hosted.app` 連結要靠舊站 301 轉址。
- **寫死 DEV 網址的腳本：** `scripts/lighthouse-check.mjs`、`scripts/check-line-link-real.mjs` 要改成可設定。
- **CI：** `.github/workflows/ci.yml` 的開機測試用 `node .output/server/index.mjs`，只適用 node-server preset。改成另外建一份 Cloudflare 版、用 `wrangler dev` 做冒煙測試；原本那份 node 版建置可以保留。
- **方案：** 要用 Workers Paid（月費 5 美元起，另計 KV、D1 用量）。現在伺服器端壓縮後約 4.5 MB（含 source map），超過 Free 的 3 MB 上限；Paid 的上限，官方文件有寫 10 MB 也有寫 64 MiB，以實際建置量為準。

## 分階段做法

1. **第 0 階段：試建置（1～2 天，只在本機、不部署）**
   - 加 `nitro.preset: 'cloudflare_module'`（compatibility date ≥ 2024-09-19，開 `nodejs_compat`），先在分支上做。
   - 解決 A1：找出全部打包時壞掉的套件。
   - 量 Worker 壓縮後的大小和啟動 CPU，用 `wrangler dev` 打首頁和個股頁，列出所有執行時錯誤。
   - **結論門檻：** A1 解不掉，或大小、CPU 超過上限，就停在這裡回報，不往下做。
2. **第 1 階段：程式調整（約 1 週）**
   - 做 A2～A9 和 B。
   - 原則：用環境判斷，同一份程式在 App Hosting 和 Workers 都能跑，DEV 先兩邊並行。
   - A2、A3 要先跟業務中台、管理站定好介面。
3. **第 2 階段：DEV 上 Workers**
   - `wrangler.jsonc`：KV（cache）、D1（DB）、vars、secrets、自訂 DEV 子網域、關閉 workers.dev。
   - 用 Workers Builds 接 `development` 分支自動部署。
   - 完成 C 的主控台設定。
   - 跑一次完整回歸（見下面「驗證」）。
4. **第 3 階段：效能**
   - 跟 App Hosting DEV 比冷啟動和熱的時候的延遲，用冷啟動報告和 Lighthouse。
   - 試 Smart Placement。
   - 公開頁面加邊緣快取：用 `routeRules` 設 SWR，或 Cache API；會員頁、`/share/**`、`/api/core` 一律不快取；確認有 `Set-Cookie` 的回應不會被快取。
5. **第 4 階段：PRD 切換（使用者決定時機）**
   - 上線前預熱 KV（10/29 使用者選，取代業務中台 bundle 端點）：把 sitemap 的頁面爬一遍，讓使用者打開的都不是「這一頁第一次」。分散跑、避開業務中台限流；約 5 萬頁 × 每頁 9 支業務中台呼叫，一次性。網路上的做法（10/29 查）：用 GET 不用 HEAD；限速（太快等於自己 DDoS 上游）、先跑一小批確認內容對了再全跑（預熱進去的錯誤值比冷的還糟）；在最後一次部署之後、上線前跑，不要提早幾週；跑完用 KV 鍵數驗證，不是「爬完」就算。KV 是全球一份，跟 CDN 快取每個機房各一份不同，爬一次就夠；也不會幫 Google 自己的快取預熱。
   - 數據中台 PRD 10/29 已經準備好（https://oingg-data-rust-prd-188704795199.asia-southeast1.run.app，數據中台說不急）：PRD Worker 的 `NUXT_ANALYSIS_BASE` 用這個網址，audience 用根網址；PRD Worker 的服務帳戶定好後告訴數據中台，由它申請 `run.invoker`（跨專案權限要先經使用者核准）。爬 sitemap 預熱 KV 的時間要先跟業務中台和數據中台約。
   - 正式網域的 DNS 交給 Cloudflare。
   - 舊網域 301 轉址。
   - App Hosting 保留一段時間當回退。

## 要使用者決定的

1. 連業務中台的身分：A2 的 ① 還是 ②（同時要業務中台同意）。
2. 5xx 紀錄改送到哪裡：A3（同時要管理站同意）。
3. DEV、PRD 的網域名稱，以及 Workers Paid 的費用。
4. 要不要用 Cron 定時叫醒業務中台（B）。
5. 搬家的時機。如果只是為了冷啟動，可以先比較「App Hosting 最少 1 台」的成本和效果。

## 要沿用的現有程式

- `shared/utils/id-token.ts`：JWT 到期判斷，A2 ① 用。
- `server/plugins/cold-start-timing.ts` 的 `coldStartParent`：A3 判斷內部請求用。
- `server/utils/http-error.ts` 的 `routeTemplate`、原因代碼：A3 照用，原因代碼跟管理站共用。
- `UserEmailVerificationGate.vue` 的「用到時才 import firebase/auth」：A9 照抄。
- scratchpad 的 `module-census.mjs`、`cold-dev.mjs`：量啟動載入和冷啟動，第 0、3 階段用。

## 驗證

- 每一階段：`pnpm lint`、`npx nuxt typecheck`、`pnpm selfcheck`（含 `check-cold-start-timing.mjs`、`check-http-error.mjs`、`check-business-auth.mjs`；A2 ① 要補一支 JWT 簽章的檢查腳本）。
- 第 0 階段：`wrangler dev` 打首頁、個股頁、產業頁、`/api/core`、`/blog/*`，記下錯誤和 Worker 大小。
- 第 2 階段，對 Workers DEV 跑：
  - `check-hydration.mjs`（全站 83 種頁面）、`check-hub-pages.mjs`、`check-stock-pages.mjs`（完整版要先問使用者）、`check-layout-shift.mjs`、`check-reload-flash.mjs`、`check-tables.mjs`。
  - a11y 檢查（axe）。
  - 登入：`pnpm login:check [網址]`（Google、LINE 走到輸入帳密為止；Email 用臨時帳號走完再刪）。
  - 分享頁、會員頁不被快取：看回應標頭。
- 第 3 階段：
  - 同一頁 `/stock/2002/dividend` 做冷啟動測試，跟 App Hosting 的 12.9 秒（2026-10-26 15:21Z）比較。
  - 確認冷啟動報告、5xx 紀錄在管理站看得到。
