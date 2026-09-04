---
aliases:
  - Windows 強制色彩模式防禦技術
  - forced-colors
  - 高對比模式防禦
  - Windows Contrast Themes
tags:
  - ui-ux
  - accessibility
  - frontend-engineering
  - css-architecture
---

# Windows 強制色彩模式防禦技術

> Windows 高對比模式（Windows Contrast Themes / Forced Colors Mode）是重度弱視與低視力族群依賴的作業系統級輔助功能。一旦啟用，作業系統將強制剝除網頁定義的 `background-color`、非 URL 的 `background-image`、`box-shadow` 與 `text-shadow`，並套用使用者挑選的系統色盤重新繪製。現代扁平化（Flat Design）介面若未預先佈設防禦性 CSS，按鈕與輸入框將因失去背景與陰影而「隱形」，導致介面輪廓徹底崩解。

---

## 1. 強制色彩模式介入時的破壞現象

```
【常規現代深色設計】                         【啟用 Windows 高對比模式後】
+──────────────────────────+                  + - - - - - - - - - - - - -+
|  按鈕 (純藍色背景無邊框)    |  ──系統剝除背景──►   按鈕文字 (背景消失、陰影消失，
+──────────────────────────+                  邊界徹底隱形，使用者無法判別點擊範圍)
```

- **隱形按鈕災難**：純靠背景顏色區隔的可點擊按鈕，在背景被系統抹除後，退化為懸空文字，使用者完全不知道哪裡可以點擊。
- **輸入框邊界消失**：依賴淺底色填色無邊框的輸入框，外框完全消失，無法定位輸入熱區。

---

## 2. 核心防禦工程：透明邊框預埋法則

解決上述問題最優雅且無副作用的前端工程技術，是在基準樣式中預埋**透明邊框（Transparent Border）**：

```css
/* 基準元件樣式 (按鈕、輸入框、卡片容器) */
.btn-primary {
  background-color: var(--color-primary);
  color: #ffffff;
  /* 關鍵防禦: 在常規模式下宣告 1px 透明邊框 */
  border: 1px solid transparent;
  border-radius: 4px;
}
```

### 瀏覽器渲染原理
- **常規模式下**：`border: 1px solid transparent` 呈現完全透明，不影響設計師原本的扁平化無邊框視覺風格。
- **高對比強制色彩模式下**：作業系統會識別該實體邊框，並自動將 `transparent` 替換為系統定義的實體不透明顏色（如 `ButtonText` 或 `Highlight`），**無痛自動恢復元件的完整幾何外框**。

---

## 3. `@media (forced-colors: active)` 媒體查詢與系統關鍵字

針對更複雜的自訂向量圖示（SVG）或特殊狀態指標，可調用專屬媒體查詢與 CSS 系統色彩關鍵字（System Colors）：

```css
@media (forced-colors: active) {
  /* 讓圖示輪廓主動跟隨系統文字顏色 */
  .custom-icon {
    fill: CanvasText;
    stroke: CanvasText;
  }
  
  /* 焦點狀態錨定至系統高亮色彩 */
  .interactive-element:focus-visible {
    outline: 2px solid Highlight;
  }

  /* 連結強制遵從系統超連結色 */
  .custom-link {
    color: LinkText;
  }
}
```

### 常用 CSS 系統色彩關鍵字
- `Canvas`：系統定義的畫布底色（通常為純黑或純白）。
- `CanvasText`：系統定義的主正文文字顏色。
- `ButtonFace`：系統定義的按鈕底色。
- `ButtonText`：系統定義的按鈕文字顏色。
- `Highlight`：系統定義的反白選取與焦點顏色。
- `LinkText`：系統定義的超連結文字色彩。

---

## 4. 嚴格防範反模式：`forced-color-adjust: none`

- 部分開發者為了省事，在全域宣告 `* { forced-color-adjust: none; }` 來粗暴阻斷系統的高對比覆蓋。
- **此舉屬嚴重違反無障礙法規的反模式**。這將直接剝奪弱視與重度視障者依賴作業系統閱讀網頁的權利，在 WCAG 與台灣政府無障礙認證稽核時會被直接記為嚴重缺失退件。

---

## 5. 關聯網絡與實踐

- **研究源頭**：[[網站無障礙背景色彩架構與視覺感知工程研究報告]]、[[Taiwan Web Accessibility Guidelines]]
- **對齊深色架構**：[[Material 深色高度受光與文字透明度模型]]
- **通用無障礙指引**：[[適度對比與光暈防護 (Tempered Contrast)]]、[[多維視覺冗餘編碼 (Visual Redundancy)]]
- **產品工程落地**：[[Atomic Design 與 Nuxt 元件命名規範]]（在基礎 Atom 元件樣式中統一注入透明邊框）
