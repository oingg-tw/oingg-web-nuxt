# 操作紀錄與統計圖表（規劃中）

## 目標
記錄使用者每次的篩選操作，並用圖表呈現統計數據，讓使用者了解自己習慣的操作區間（例如常用哪些指標、慣用的 min/max 數值範圍）。

## 需要記錄的資料（每次「搜尋」動作）
- userId、timestamp
- presetId / tabId（可選，關聯到哪個分頁）
- 該次送出的 filters 陣列：`{ field, min, max, exclude }[]`
- （可選）該次搜尋結果數量 count，用於分析篩選寬鬆／嚴格程度

## API 需求（待後端配合）
- 寫入：可能在 `/screener/presets/:id/run` 時順手落地一筆操作紀錄；或前端另外呼叫 `POST /screener/operations`
- 讀取：例如 `GET /screener/operations/stats?field=xxx&range=90d`，回傳依欄位分組的統計（次數、min/max 分布）

## 圖表呈現方式
- 「最常使用的指標」→ 長條圖（依使用次數排序）
- 「單一指標的區間分布」→ 直方圖或 box plot，呈現該欄位 min/max 值的分布（例如 ROE 大多落在 20~35）
- （可選）「操作趨勢」→ 時間軸，看使用頻率隨時間變化

## 開放問題
1. 記錄範圍只算「按下搜尋」，還是包含新增/移除欄位、切分頁等所有互動？
2. 統計頁面要獨立頁面（目前先建立 `/operation-stats` 佔位），還是嵌在 screener 頁面側邊/彈窗？
3. 後端目前有沒有現成的操作紀錄表，還是這次要一起規劃 API？

## 目前狀態
僅建立佔位頁面（`index.vue`），尚未串接任何資料或圖表，也尚未加入導覽選單（`app/utils/app-features.ts`）。
