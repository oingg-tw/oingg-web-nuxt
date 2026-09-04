---
aliases:
  - 金融 YMYL 內容與 E-E-A-T 信任架構
  - YMYL
  - E-E-A-T
  - 核心網頁指標
  - JSON-LD 結構化資料
tags:
  - seo
  - ymyl
  - eeat
  - web-performance
  - frontend-engineering
---

# 金融 YMYL 內容與 E-E-A-T 信任架構

> 金融、投資與存股類軟體在 Google 搜尋品質評估指南中，屬於標準的「攸關金錢與生活（YMYL, Your Money Your Life）」高風險領域。Google 對此類網站套用最嚴苛的 **E-E-A-T（經驗 Experience、專業 Expertise、權威 Authoritativeness、信任 Trustworthiness）** 審查標準。除了透過 SSR/SSG 技術架構確保核心網頁指標（CWV）達到極致外，必須部署完備的 JSON-LD 結構化資料矩陣，並在介面公開專業證照背書與法定免責聲明，以構築堅不可摧的自然搜尋護城河。

---

## 1. 現代前端渲染架構與核心網頁指標 (Core Web Vitals, CWV)

行銷首頁與核心產品落地頁**嚴禁採用純客戶端渲染（CSR, Client-Side Rendering）**：
- **SSR / SSG 的必然性**：純 CSR 依賴瀏覽器下載並執行龐大的 JavaScript bundle，爬蟲常因渲染佇列超時而直接抓取空白 HTML。行銷頁面必須全面採用 Nuxt 的伺服器端渲染（SSR）或靜態生成（SSG）。
- **三大核心網頁指標 (CWV) 的工程控制**：

| 核心指標項目 | 官方合格標準 | oingg-web-nuxt 前端工程優化手段 |
| :--- | :--- | :--- |
| **最大內容繪製 (LCP)** | **$\le 2.5$ 秒** | - 首屏關鍵 CSS 內嵌（Inline Critical CSS）。<br>- Hero 區域主圖與圖表預加載（`<link rel="preload">`），轉換為 WebP / AVIF 次世代格式。<br>- 靜態資產全數上架 CDN 全球快取。 |
| **互動就緒延遲 (INP)** | **$\le 200$ 毫秒** | - 拆解龐大 JavaScript 任務，將複雜的財務指標回測與統計計算移交 **Web Workers** 於背景線程執行，避免阻塞主線程。<br>- 按需非同步載入（Lazy-load）重量級圖表庫（如 Highcharts/Echarts）。 |
| **累計版面位移 (CLS)** | **$\le 0.1$** | - 所有動態資料卡片、表格與圖表容器，在 CSS 中**顯式預設固定寬高比例（`aspect-ratio`）或最小高度**。<br>- 避免因動態 API 報價回傳水合（Hydration）時引發畫面下壓晃動。 |

---

## 2. 金融 JSON-LD 結構化資料矩陣 (Schema.org)

透過在 HTML `<head>` 中注入語意化 JSON-LD，直接向搜尋引擎知識圖譜宣告軟體屬性，並爭取 Rich Snippets（豐富網頁摘要）：

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "oingg 存股選股平台",
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "Web, iOS, Android",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "TWD"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "1250"
      }
    },
    {
      "@type": "Organization",
      "name": "oingg.com",
      "url": "https://oingg.com",
      "knowsAbout": ["台灣存股策略", "ETF配置", "三水桶資產配置"]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "退休投資應如何配置三水桶資產？",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "三水桶策略將資金分為短期1-3年生活流動金、中期4-8年債券固定收益、以及長期成長型股票..."
          }
        }
      ]
    }
  ]
}
</script>
```

- **`SoftwareApplication`**：指派 `FinanceApplication` 類別，使 Google 在軟體應用類別中優先索引。
- **`FAQPage`**：爭取在 Google 搜尋結果頁中展開折疊式問答版位，佔據超大視覺面積，顯著提升 CTR，並大幅提高被 AI 搜尋（GEO）直接引用的機率。

---

## 3. 金融 YMYL 的 E-E-A-T 信任防線搭建

在缺乏專業認證背書的情況下，金融網站會被 Google 人工評估員判定為「低品質/可疑內容」：

| E-E-A-T 構面 | 具體產品落地呈現方式 | 演算法與人工審查效益 |
| :--- | :--- | :--- |
| **專業度 (Expertise) & 權威性 (Authoritativeness)** | - 在專案「關於我們」或研報底部，公開研究團隊之**專業金融證照**（如特許金融分析師 CFA、證券投資分析師 CSIA）。<br>- 明確揭露數據源來自台灣證券交易所（TWSE）、櫃檯買賣中心（TPEx）與公開資訊觀測站官方授權。 | 建立實體知識圖譜關聯，證明內容非 AI 幻覺隨機生成。 |
| **經驗 (Experience)** | 在功能介紹中展示真實的歷史回測數據、真實退休提領世代案例（如 1966 與 1929 世代壓力測試）。 | 符合 Google 2023 年新增的「第一手實戰經驗」加權。 |
| **信任度 (Trustworthiness)** | - 在計算機旁明確列出試算假設（包含交易手續費折讓、證交稅、二代健保 2.11%、股利二擇一報稅抵減）。<br>- 遵從 [[投顧法第 4 條安全港與釋字 634 號邊界]]，顯式配置法定免責宣告與隱私權保護協議。 | 消除「黑箱誘騙投資」的惡意網站嫌疑。 |

---

## 4. 關鍵字防蠶食策略 (Keyword Cannibalization Prevention)

- **首頁定位**：聚焦於「品牌大詞」與「存股軟體類別大詞」（如 `存股軟體`、`退休資產配置平台`）。
- **具體工具分流**：針對 `定期定額計算機`、`高股息 ETF 篩選器`、`除權息日曆`，必須各自建立獨立的二級二級靜態路由（如 `/tools/dividend-calendar`），首頁僅提供內部錨點連結。
- **自我規範化**：首頁與各工具頁均部署自引用 Canonical（`<link rel="canonical" href="..." />`），徹底防止多個子頁面與首頁在同一關鍵字上自我競爭打架。

---

## 5. 關聯網絡與實踐

- **研究源頭**：[[存股 SaaS 首頁 SEO 策略]]、[[SEO 友善網址設計指南]]
- **URL 架構底座**：[[SEO 友善 URL 拓撲與多面向導覽治理]]
- **專業內容支撐**：[[常態化獲利與財報回溯年限]]、[[Piotroski F-Score 評分模型]]
- **法規合規邊界**：[[投顧法第 4 條安全港與釋字 634 號邊界]]
