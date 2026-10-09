# WCAG 2.2 A／AA 符合性清單

每一條成功準則一列：方式（哪些 axe 規則，或哪個人工程序）、狀態、樣本頁、證據。狀態只有四種：**符合**（有證據）、**待人工確認**（程序寫在備註，還沒在這一輪做）、**待登入輪**（要用測試帳號跑 `A11Y_LOGIN=1` 才驗得到）、**不適用**。自動的證據在 `docs/a11y/evidence/<日期>/`；人工的證據是備註裡的批次（本 repo 的 commit）與日期。台灣「網站無障礙規範 2.0」的檢測碼對應 WCAG 2.0／2.1 的同名準則，這份表同時涵蓋。

最近更新：2026-10-08。

## 方式縮寫

- **axe**：`scripts/check-a11y-pages.mjs`（公開頁）、`check-stock-pages.mjs`（個股頁）、`check-hub-pages.mjs`（hub／排行／指標／總經頁）跑的 axe-core 4.13，標籤 wcag2a／wcag2aa／wcag21a／wcag21aa／wcag22aa／best-practice。
- **腳本**：check-a11y-pages 自己的檢查（標題、單一 h1、模式、橫向溢出、目標尺寸、page error）。
- **人工**：備註裡的程序。

## 清單

| 條文 | 等級 | 方式 | 狀態 | 樣本頁 | 證據／備註 |
|---|---|---|---|---|---|
| 1.1.1 非文字內容 | A | axe image-alt／svg-img-alt／role-img-alt／input-image-alt；人工：每張圖表 role="img" 有名稱且同頁有資料表 | 符合 | /、/stock/2330、/stock/2330/dividend、/macro/policy-rate | evidence；SharedChart 集中加 role／aria-label（B3，2026-10-08）；裝飾圖 alt=""（頭像、logo mark） |
| 1.2.1 純音訊與純視訊（預錄） | A | — | 不適用 | — | 無影音 |
| 1.2.2 字幕（預錄） | A | — | 不適用 | — | 無影音 |
| 1.2.3 音訊描述或媒體替代（預錄） | A | — | 不適用 | — | 無影音 |
| 1.2.4 字幕（直播） | AA | — | 不適用 | — | 無影音 |
| 1.2.5 音訊描述（預錄） | AA | — | 不適用 | — | 無影音 |
| 1.3.1 資訊與關係 | A | axe list／listitem／dlitem／definition-list／td-headers-attr／th-has-data-cells／scope-attr-valid／aria-required-children／aria-required-parent／label／p-as-heading／heading-order／landmark-*／region；人工：表格 caption 與 scope、表單 label | 符合 | /stock、/industry/24-semiconductor、/holdings（登入） | evidence；seo-table 的 th scope=col／row；el-form 的 label；/design 的表 2026-10-08 補 caption＋scope（C8b） |
| 1.3.2 有意義的順序 | A | 人工：停用樣式表，確認閱讀順序是 頁首 → 內容 → 頁尾；375 的底部頁面清單在 DOM 末尾 | 待人工確認 | /、/stock/2330、/holdings | 程序：DevTools 停用 CSS，從上讀到下；兩份 DOM（桌機 rail／手機底部清單）同時在 HTML 裡，確認順序仍合理 |
| 1.3.3 感官特性 | A | 人工：指示不只靠形狀、位置或顏色 | 符合 | /stock/2330（徽章）、/screener | 徽章 met／unmet／unknown 用形狀＋文字（2026-09-14）；漲跌 ▲▼＋數字 |
| 1.3.4 方向 | AA | axe css-orientation-lock | 符合 | 全部 | evidence |
| 1.3.5 識別輸入目的 | AA | axe autocomplete-valid；人工：登入表單的 email 欄位 | 符合（訪客頁）；登入表單待登入輪 | /holdings（表單）、登入對話框 | evidence；FirebaseUI 的 email 輸入框 autocomplete 由它決定 |
| 1.4.1 顏色運用 | A | axe link-in-text-block；人工：漲跌色配符號、徽章用形狀、圖表線型＋符號各不相同 | 符合 | /stock/2330/dupont（四線）、/calendar | evidence；杜邦四條線（線型, 符號）配對（2026-09-22） |
| 1.4.2 音訊控制 | A | — | 不適用 | — | 無自動播放音訊 |
| 1.4.3 對比（最低） | AA | axe color-contrast（淺／深 × GOLD）；其他六色的對比數字記在 main.css 各主色區塊的註解（2026-09-19 量測） | 符合 | 全部；/design | evidence；七個主色 2026-09-19 調到對頁面 4.5:1、警告色 2026-10-08（C3）、深色實心按鈕近黑字、FirebaseUI email 按鈕 #c0392b 5.4:1 |
| 1.4.4 調整文字大小 | AA | 腳本：A11Y_PAGES_TEXT_SCALE=120；人工：瀏覽器 200% 縮放 | 120% 符合；200% 待人工確認 | /holdings、/screener、/stock/2330 | 程序：Chrome 200%，確認無截斷、無橫向捲動、對話框可用（2026-09-16 修過 skip-link 與 el-select 的 200% 截斷） |
| 1.4.5 文字圖像 | AA | 人工 | 符合 | / | logo 以外無文字圖像；logo 有文字替代（aria-label 回首頁＋站名文字） |
| 1.4.10 重排 | AA | 腳本：A11Y_PAGES_WIDTHS=320 無橫向溢出；人工：對話框在 320px | 320 符合；對話框待人工確認 | 全部公開頁 | evidence（320 那一份）；程序：320px 開 新增條件／記一筆交易／登入 對話框，內容不被截斷 |
| 1.4.11 非文字對比 | AA | 人工：UI 邊框 token、焦點環、圖表線對底色 ≥3:1 | 符合 | /screener、/stock/2330 | 框線 #7f8690 對淺色面 3.26–3.67:1、深色 #6b6c6e 3.17–3.56:1（main.css 註解，2026-09-20）；焦點環主色 ≥4.5:1 |
| 1.4.12 文字間距 | AA | axe avoid-inline-spacing；人工：套用 WCAG 文字間距書籤小工具 | 自動符合；人工待確認 | /blog/<slug>、/stock/2330 | 程序：行高 1.5、段距 2em、字距 0.12em、詞距 0.16em 後無截斷重疊 |
| 1.4.13 滑鼠停留或焦點的內容 | AA | 人工：el-tooltip 以 hover＋focus 觸發、可停留、Esc 關閉 | 待人工確認 | /preferred-stocks（表頭說明）、/stock/2330（指標 info） | C6a／C7 改成 trigger=['hover','focus']（2026-10-08）；程序：Tab 到觸發鈕出現提示，移到提示上不消失，Esc 關閉 |
| 2.1.1 鍵盤 | A | axe scrollable-region-focusable；人工：Tab 走訪每頁、對話框、拖曳皆有按鈕替代 | 符合（訪客頁）；登入頁待登入輪 | /stock/2330、/industries、/calendar、/preferred-stocks | C1（側欄改原生清單，Tab ≤80 次到達每個連結）、C2（月曆日期改按鈕）、C6a（欄位上移／下移）2026-10-08 |
| 2.1.2 無鍵盤陷阱 | A | 人工：每個對話框 Esc 與關閉鈕、手機功能選單 inert | 符合 | /calendar、/guru-indicators、375 功能選單 | C2／C7 驗證焦點回到觸發元素（2026-10-08） |
| 2.1.4 字元快速鍵 | A | 人工 | 符合 | 全部 | 只有帶修飾鍵的 accesskey（Alt＋字母），無單字元快速鍵 |
| 2.2.1 時間調整 | A | 人工 | 符合 | 全部 | 無時限；登入 session 無自動登出倒數 |
| 2.2.2 暫停、停止、隱藏 | A | axe blink／marquee；人工 | 符合 | 全部 | 無自動播放動態；prefers-reduced-motion 全站一條（C4） |
| 2.3.1 閃爍三次或低於閾值 | A | 人工 | 符合 | 全部 | 無閃爍內容 |
| 2.4.1 略過區塊 | A | axe bypass／skip-link／landmark-one-main／region | 符合 | 全部 | evidence；跳至主要內容／頁尾／左側功能區塊 skip-link＋定位點 |
| 2.4.2 頁面標題 | A | axe document-title；腳本：title 以「｜安盈選股」結尾 | 符合 | 全部 | evidence |
| 2.4.3 焦點順序 | A | 人工：桌機 頁首 → 摘要卡 → 側欄 → 麵包屑 → 內容；對話框關閉後焦點回觸發元素 | 符合 | /stock/2330、/calendar | C1／C2（2026-10-08） |
| 2.4.4 連結目的（情境中） | A | axe link-name；人工：另開新視窗的連結文字含「另開新視窗」 | 符合 | /guru-indicators、/metrics/roe | evidence；C7（2026-10-08） |
| 2.4.5 多種途徑 | AA | 人工 | 符合 | 全部 | 頁首導覽、頁尾、/sitemap、搜尋、sitemap.xml |
| 2.4.6 標題與標籤 | AA | check-stock-pages questionH2s；人工：表單 label | 符合 | 個股頁、/holdings | 個股頁問句 h2（check-stock-pages）；指標挑選器／搜尋框 aria-label（C8b） |
| 2.4.7 焦點可見 | AA | 人工：每個控制項有 2px 主色焦點環；el-menu 覆寫 | 符合 | /stock、/screener、/calendar | C4 驗證 outlineStyle !== 'none'（2026-10-08） |
| 2.4.11 焦點不被遮蔽（最低） | AA | 人工：375 Tab 到頁面最底的控制項，不被底部導覽列遮住 | 待人工確認 | /stock/2330、/macro/policy-rate | scroll-padding-bottom 已設（main.css has-bottom-nav-bar）；程序：Tab 到頁尾連結，確認在導覽列上方 |
| 2.5.1 指標手勢 | A | 人工：拖曳排序都有上移／下移替代；無多點手勢 | 符合 | /screener（欄位設定）、/preferred-stocks | C4／C6a／C8a（2026-10-08） |
| 2.5.2 指標取消 | A | 人工 | 符合 | 全部 | 點擊在 pointerup 觸發；拖曳可放回原位 |
| 2.5.3 名稱中的標籤 | A | axe label-content-name-mismatch | 符合 | 全部 | evidence；釘選按鈕可見文字在前（C5） |
| 2.5.4 動作驅動 | A | — | 不適用 | — | 無動作感應功能 |
| 2.5.7 拖曳動作 | AA | 人工：同 2.5.1 | 符合 | /screener、/watchlist、/preferred-stocks | 同上 |
| 2.5.8 目標尺寸（最低） | AA | 腳本：每個寬度量可見互動元素短邊 ≥24px，套用 spacing 例外（觸控寬度另對 <44 警告） | 符合 | 全部 | evidence；2026-10-08 修掉特別股頁 16px 圖示連結、el-tag 14px 關閉鈕、表格公司名連結 23px（桌機列）；el-table 排序鈕 14px 高靠 spacing 例外通過，summary 列出備查 |
| 3.1.1 頁面語言 | A | axe html-has-lang／html-lang-valid | 符合 | 全部 | evidence（lang="zh-TW"） |
| 3.1.2 局部語言 | AA | axe valid-lang；人工：/accessibility 的英文段落 lang="en" | 符合 | /accessibility | evidence |
| 3.2.1 焦點時 | A | 人工 | 符合 | 全部 | 聚焦不觸發情境改變 |
| 3.2.2 輸入時 | A | 人工 | 符合 | /screener、/appearance | 改值不自動導頁；篩選條件要按確定才套用；外觀設定即時套用但不換頁 |
| 3.2.3 一致的導覽 | AA | 人工 | 符合 | 全部 | 頁首／頁尾／底部導覽每頁同序（layouts/default.vue、SharedFooter） |
| 3.2.4 一致的識別 | AA | 人工 | 符合 | 全部 | 釘選／移除／關閉 同名同圖示 |
| 3.2.6 一致的協助 | A | 人工 | 符合 | 全部 | 聯絡信箱在每頁頁尾同位置；/accessibility 從頁尾可達 |
| 3.3.1 錯誤識別 | A | 人工：交易表單錯誤以文字顯示（el-form-item__error）、FirebaseUI 錯誤訊息 | 待登入輪 | /holdings、登入對話框 | 程序：送出空表單／錯誤日期，確認錯誤文字與欄位相鄰且被朗讀 |
| 3.3.2 標籤或說明 | A | axe label／select-name；人工：aria-describedby 的提示 | 符合（訪客頁）；表單待登入輪 | /holdings、/watchlist | v-describedby（C8b，2026-10-08） |
| 3.3.3 錯誤建議 | AA | 人工：交易表單的錯誤文字含修正建議 | 待登入輪 | /holdings | — |
| 3.3.4 錯誤預防（法律、財務、資料） | AA | 人工：刪除交易有復原提示、匯入前有預覽 | 待登入輪 | /holdings | 刪除 Undo toast 已實作（useHoldings）；程序：刪一筆 → 按復原 → 回來 |
| 3.3.7 重複輸入 | A | 人工 | 符合 | /holdings | 無重複要求輸入同一資訊 |
| 3.3.8 無障礙驗證（最低） | AA | 人工：登入無認知測驗、允許貼上密碼、有 Google 登入替代 | 待登入輪 | 登入對話框 | FirebaseUI email／password＋Google |
| 4.1.1 剖析 | — | — | 不適用 | — | WCAG 2.2 已移除此準則 |
| 4.1.2 名稱、角色、值 | A | axe button-name／aria-*／nested-interactive／role-img-alt／aria-valid-attr-value | 符合 | 全部 | evidence；el-autocomplete 的 aria-activedescendant 修正（useAutocompleteActiveDescendantFix） |
| 4.1.3 狀態訊息 | AA | 人工：role="status"（搜尋符合數、載入更多、刪除提示、符合組數）會被朗讀 | 符合（實作）；朗讀待 NVDA 確認 | /stock/2330/metrics、/industries、/guru-indicators、/screener | C5／C6b／C7／C8b（2026-10-08）；程序：NVDA＋Chrome，輸入搜尋字，聽到「N 項符合」 |

## 樣本頁

/、/stock/2330（＋/dividend、/metrics、/quick-view）、/screener（訪客與登入）、/industries、/macro/policy-rate、/calendar、/preferred-stocks、/etf-zone、/holdings＋/holdings/columns、/watchlist、/appearance、/profile、/sitemap、/accessibility、/blog/<slug>；各 375／1440、淺／深、100／120%。

## 證據

`docs/a11y/evidence/<日期>/`：check-a11y-pages 的 summary.md／report.json（訪客預設矩陣、320、120%；登入輪同三份），check-stock-pages 與 check-hub-pages 兩寬度的輸出，之後加 Freego 2.0 的結果 PDF。聲明頁（/accessibility）的更新日期＝最近一份證據的日期。

2026-10-08 這一份有的：訪客三輪、HUB 兩寬度、RAIL。沒有的：登入三輪（等測試帳號）、check-stock-pages 完整版 68 條 × 兩寬度（約 20 分鐘，依 2026-10-07 的規則要先問過才跑；這一輪只跑了改到的 quick-view、index、dupont 等單頁）。

## 待辦

1. 登入輪（需要 `.env` 的測試帳號）：1.3.5、2.1.1、3.3.1、3.3.2、3.3.3、3.3.4、3.3.8。
2. 人工程序：1.3.2、1.4.4（200%）、1.4.10（對話框）、1.4.12、1.4.13、2.4.11、4.1.3（NVDA）。
3. 部署後：Freego 2.0 全站檢測、服務網申請（承辦人資料由營運方填）。
