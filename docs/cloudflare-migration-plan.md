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
- **第 1 階段已改：** A2（`googleServiceAccountKey`＋`serviceAccountAssertion`）、A3 前半（內部請求改看 `coldStartParent`）、A5、A6、A7（KV＋`patches/nitropack@2.13.4.patch` 讓快取的背景重算掛上 `waitUntil`；`/api/cached` 的鍵超過 300 bytes 改雜湊）、A8（拿掉共用的 IAM 請求；12 格限流留著，等待的請求還活著時跨請求解開沒問題）、B（Workers 上不叫醒業務中台、不送 webup）。平台判斷是 `server/utils/platform.ts` 的 `onWorkers`。
- **DEV 已上 Workers（手動部署）：** https://oingg-web-nuxt-dev.oingg-web-nuxt.workers.dev（Worker `oingg-web-nuxt-dev`，Cloudflare 量的啟動時間 70～115 ms）。KV `oingg-web-nuxt-dev-cache`（第一次部署時 wrangler 自動建）、D1 `oingg-web-nuxt-dev-content`。GCP 服務帳戶 `web-nuxt-workers@oingg-web-dev`，只有業務中台 DEV 的 `run.invoker`；金鑰只在 Worker 機密 `NUXT_GOOGLE_SERVICE_ACCOUNT_KEY`。Nitro 金鑰複製一份到機密 `NUXT_BUSINESS_NITRO_KEY`（使用者選複製：去 Secret Manager 讀會在冷啟動多一段延遲，跟換平台的目的相反；業務中台換金鑰時這邊要跟著換）。瀏覽器開 14 頁沒有錯誤。
  - 建置與部署：`NITRO_PRESET=cloudflare_module NUXT_SITE_ENV=preview pnpm build`，再 `pnpm dlx wrangler@4 deploy`。Nitro 對這個 preset 預設用 `nodejs_compat`＋`no_nodejs_compat_v2`（它的 polyfill 配 v1），照它的。
  - Nitro 讀環境變數會把 JSON 字串解析成物件，服務帳戶金鑰兩種都要收。
- **2026-10-27 冷啟動比較（第一輪）：** 測試機的 Chromium 每次送出請求前約有 3 秒自己的開銷（App Hosting 的 l2gfet4t7 比 ttfb 少 2.8～2.9 秒；Workers 那次 requestStart 3,164 ms），所以比「送出請求到第一個位元組」：App Hosting 8.2／8.4／10.8 秒（三層全冷），Workers KV 命中 1 秒內／1.17 秒。KV 沒有那頁的情況沒量準（業務中台被一個開著的 Workers 分頁先叫醒，那次也沒記 requestStart），10/28 凌晨重測。
  - 中華電信（HiNet）的流量進 Cloudflare 聖荷西（colo SJC，RTT 約 126 ms），不是台灣節點；Worker 從 SJC 打新加坡的業務中台。使用者手機的行動網路進新加坡（colo SIN，10/27 使用者回報），跟業務中台同區。入口機房不能指定；程式執行的機房可以（`placement.region`，見下一條）。
  - **10/27 09:41（台灣時間）Workers 最壞情況：** `/stock/1104/dividend`，KV 沒有、Worker 冷、業務中台冷（閒置 75 分鐘，叫醒 4 個容器），從 HiNet 測（SJC）。送出請求到第一個位元組 6.6 秒；Worker 內 5.96 秒，其中等業務中台 5.47 秒，Worker 自己約 0.5 秒，網路約 0.6 秒；CPU 403 ms。對照 App Hosting 三次（l2gfet4t7 減 waitall）：web-nuxt 自己加容器啟動 3.8～6.5 秒，Workers 1.1 秒。Workers 等業務中台多約 1 秒（4.2～4.5 → 5.5 秒），原因是 App Hosting 的 `business-wake.ts` 在行程一起來就叫醒業務中台，它自己啟動的 1.2～1.5 秒跟業務中台的冷啟動重疊；Workers 啟動約 70 ms，沒有可以重疊的時間（不是距離，下一條證明）。
  - **10/27 10:25 Placement 新加坡執行**（`"placement": { "region": "gcp:asia-southeast1" }`，`cf-placement: remote-SIN`、`cf-ray` 仍是 SJC）：`/stock/1103/dividend`，同樣全冷。送出請求到第一個位元組 7.7 秒（比 SJC 執行慢 1.1 秒）；等業務中台 5.50 秒（沒變），Worker 自己 1.1 秒（SJC 是 0.5），Worker 以外 1.0 秒（SJC 是 0.6，回應多繞 SJC→新加坡→SJC）。管理站用業務中台自己的紀錄拆「等業務中台」：web-nuxt 到業務中台 1.35 秒（SJC 是 1.96），業務中台啟動＋處理 4.08 秒（SJC 是 3.46）。三次都拆完後（12:43 那條）看不出這段有省：同一趟各容器之間就差 0.3～0.5 秒。
  - **10/27 12:43 新加坡執行第二次**：`/stock/1108/dividend`，業務中台閒置 40 分鐘、只叫醒 1 個容器。送出請求到第一個位元組 7.2 秒；等業務中台 5.53 秒，Worker 自己 0.5 秒（跟 SJC 一樣，10:25 那次的 1.1 秒是偶發），Worker 以外 1.2 秒。兩次新加坡執行的「等業務中台」都跟 SJC 一樣約 5.5 秒，Worker 以外都多 0.4～0.6 秒（請求與回應多繞 SJC↔新加坡），整頁慢 0.7～1.1 秒。
  - 管理站用業務中台紀錄拆三次（取等最久的容器）：web-nuxt 到業務中台 1.96／1.35／1.59 秒（同一趟各容器差 0.3～0.5，新加坡執行看不出有省），業務中台啟動 2.35／2.71／2.42（幾乎都是載入模組），業務中台處理 1.10／1.37／1.13（幾乎都在等同樣冷的數據中台：容器晚 1.4～1.9 秒起來、連資料庫 0.75～1.2 秒）。等業務中台的 5.4 秒都在上游，換 web-nuxt 的主機或執行位置都動不到。業務中台再拆這 9 個容器（revision 00115，已打包）：啟動裡載入模組佔 2.1～2.6 秒（96～98%），打包前 22 筆中位數約 3.9 秒、這 9 筆約 2.3 秒；處理那段等數據中台 0.6～1.8 秒；我們等的比它從行程啟動到回應多 1.1～1.4 秒，是 Cloud Run 開容器加網路。
  - **使用者決定拿掉 Placement**（10/27 13:33 重新部署，版本 5d5b513e，回應不再有 `cf-placement`）：回到入口機房執行；10/28 02:00 那次就是 SJC 執行的第二個樣本。
  - **10/28 04:09 SJC 執行第二次**（02:00 的排程因電腦休眠沒跑，補跑）：`/stock/1101/dividend`，KV 沒有、Worker 冷、業務中台冷（叫醒 3 個容器）。送出請求到第一個位元組 7.3 秒；Worker 內 6.49 秒，其中等業務中台 5.95 秒（最久那支 5.90），Worker 自己 0.54 秒，Worker 以外 0.84 秒。跟 09:41 那次（6.6 秒：等 5.47、自己 0.5、以外 0.6）一樣：Worker 自己約 0.5 秒，其餘是上游與網路。報告已帶 requestStartMs 與 edgeColo。管理站用業務中台紀錄拆最久那支（beff0d05）：web-nuxt 到業務中台 2.47 秒（開容器加網路約 2.24），業務中台啟動 3.16（載入模組 3.10，另兩支 2.35／2.46，這支是偶發慢），處理 0.28（業務中台開機叫醒已先把數據中台叫起來；09:41 那次數據中台還冷，處理 1.10）。7.33 秒裡業務中台的冷啟動（開容器＋啟動）佔 5.6 秒。
  - 修了一個 bug：頁面用全域 `$fetch` 打自己的 `/api` 時，Nitro 不把外層的 waitUntil 交給內部請求，背景重算在回應送出後被砍掉（業務中台照樣被叫醒、KV 沒更新）。`server/plugins/cold-start-timing.ts` 讓內部請求沿用外層的 waitUntil。
  - 每個回應都帶 Server-Timing（development 3fcd3c9b）；冷啟動報告的 requestStartMs 與 edgeColo（入口機房，Server-Timing 的 `colo`）在分支 `cold-start-request-start`；業務中台 10/27 上 DEV（09ae1a4）後併進 `cloudflare-workers`（1fdca814），16:08 部署 Workers（版本 f7847842），10/28 02:00 那次會帶這兩個欄位。使用者核准後 16:18 推上 development（f7022902），App Hosting DEV 16:21 上線（web-nuxt-dev-build-2026-10-27-002），02:40 那次也會帶。
- **使用者決定拿掉 App Hosting**（10/27，管理站轉達「App Hosting拿掉吧」，本 session 確認「先補齊再刪」）：管理站 DEV 最近 5 次使用者等待平均 App Hosting 12.9 s、Workers 9.8 s。10/28 02:40 的 App Hosting 測試取消。要先補齊才刪 backend：
  - 登入：workers.dev 已加進 Firebase Auth 授權網域與 Browser key 的網站限制（10/27 20:5x）。LINE Developers 的 callback 還要使用者加；業務中台的 redirectUri 白名單由管理站轉給業務中台。
  - 程式：`cloudflare-workers` 已推上 development（9f8e4058，10/27 20:57），App Hosting 跑同一份（web-nuxt-dev-build-2026-10-27-003，CI 通過、主要頁面 200）。
  - 自動部署：Workers Builds（使用者選），要使用者在 Cloudflare 主控台連 GitHub。
  - A3 後半（5xx 紀錄）：使用者選「改抓 Cloudflare log」——不寫進 GCP、不加 logWriter；`http-errors.ts` 那一行在 Workers Logs 已經是拆好欄位的結構化紀錄（過去一週 10 筆，error hook 與 afterResponse 兩條路都有），管理站用 Cloudflare 的 telemetry query API 讀（最多留 7 天；管理站「排程與服務」只看最近 24 小時，不用另外存）。總數讀 GraphQL `workersInvocationsAdaptive`。管理站 DEV 已上線（10/27，revision 00117）：篩選鍵是 `event`（`source.event` 查不到）加 `$metadata.service`，權杖只有讀取權限，Observability Read 就夠。
- **還沒做：** A9（大小與啟動時間都夠，先不做）、C 的主控台設定、CI 的 Workers 冒煙測試、Workers Builds；刪 App Hosting 之後清掉只給它用的程式（`business-wake.ts`、metadata server 身分、`compress-responses.ts`、webup、`apphosting*.yaml`、腳本裡寫死的 hosted.app 網址）。

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
| A8 | **跨請求共用的 promise：** Workers 不允許一個請求去解開另一個請求的 promise，可能卡住 | `business.ts` 的 12 格限流（`active`／`waiters`）、IAM 憑證的共用請求 `identityRequest` | 限流改成每個請求自己算；Workers 每個請求本來就最多 6 條同時連線。憑證只快取「值」，不快取 promise |
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
  - 登入：Google、Email、LINE。LINE 要使用者用真帳號測。
  - 分享頁、會員頁不被快取：看回應標頭。
- 第 3 階段：
  - 同一頁 `/stock/2002/dividend` 做冷啟動測試，跟 App Hosting 的 12.9 秒（2026-10-26 15:21Z）比較。
  - 確認冷啟動報告、5xx 紀錄在管理站看得到。
