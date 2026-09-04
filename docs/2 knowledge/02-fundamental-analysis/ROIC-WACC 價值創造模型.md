---
aliases:
  - ROIC-WACC 價值創造模型
  - ROIC-WACC Spread
  - 經濟附加價值
  - EVA
tags:
  - fundamental-analysis
  - corporate-finance
  - valuation
---

# ROIC-WACC 價值創造模型

> 企業理論上的內在價值創造，取決於其投入資本所產生的回報能否持續超越資本成本。投下資本利益率（ROIC）衡量排除財務槓桿後的本業資產獲利效率，加權平均資金成本（WACC）界定了資本的最低要求回報率。兩者的差額（ROIC－WACC 利差）是判斷企業是在「創造真實股東價值」還是在「規模擴張中毀滅資本」的唯一本質標準。

---

## 1. 核心數理模型與經濟附加價值 (EVA)

### 投下資本利益率 (ROIC)
$\text{ROIC} = \frac{\text{NOPAT}}{\text{投下資本 (Invested Capital)}}$

其中：
- $\text{NOPAT} = \text{營業利益 (EBIT)} \times (1 - \text{有效稅率})$：稅後營業淨利，衡量本業純粹經營獲利。
- $\text{投下資本} = \text{有息負債} + \text{股東權益} - \text{超額現金} = \text{營運資金需求 (NWC)} + \text{固定資產淨額 (PP&E)}$。

### 經濟附加價值 (EVA®) 與利差方程式
$\text{EVA} = \text{投下資本} \times (\text{ROIC} - \text{WACC})$

$\text{ROIC Spread} = \text{ROIC} - \text{WACC}$

---

## 2. 價值創造與資本毀滅之界限

| 利差狀態 | 數理條件 | 實質經濟意涵 | 企業擴張後果 |
| :--- | :--- | :--- | :--- |
| **正利差 (Value Creation)** | $\text{ROIC} > \text{WACC}$ ($\text{EVA} > 0$) | 企業獲利足以覆蓋債權人利息與股東要求的機會成本，產生真正的超額經濟租（Economic Rent）。 | **再投資能創造複利**。營收規模越大、資本支出越多，股東權益內在價值增長越快。 |
| **零利差 (Value Neutral)** | $\text{ROIC} = \text{WACC}$ ($\text{EVA} = 0$) | 企業獲利恰好抵銷資本成本，無任何超額經濟利潤。 | 業務擴張僅僅放大資產負債表，不增加任何每股內在價值。 |
| **負利差 (Value Destruction)** | $\text{ROIC} < \text{WACC}$ ($\text{EVA} < 0$) | 即使損益表上的會計淨利（Net Income）呈現正值，其回報率依然低於社會資本機會成本。 | **擴張等同加速毀滅資本**。盲目擴廠增資將加劇每股純益與自由現金流折現價值的永久減損。 |

---

## 3. EVA 的四輪驅動拆解

將 EVA 結合營收效率，可拆解為四個管理與分析槓桿：

$\text{EVA} = \text{營收} \times \left( \frac{\text{NOPAT}}{\text{營收}} - \text{WACC} \times \frac{\text{投下資本}}{\text{營收}} \right)$

1. **營收擴張槓桿**：在保持利差為正的前提下擴大營收基數。
2. **獲利能力槓桿（NOPAT Margin）**：透過技術專利或定價權提升營業利益率。
3. **資本週轉槓桿（Capital Turnover）**：精簡非核心資產、優化供應鏈存貨，降低單位營收所需的投下資本。
4. **資本結構槓桿（WACC Optimization）**：在信用評等安全範圍內取得最佳債權融資成本。

---

## 4. 關聯網絡與實踐

- **研究源頭**：[[財務諸表の主要投資指標ガイド]]、[[基本面財報觀察年限分析]]
- **延伸定價機制**：[[PBR 1倍破淨機制與資本收益性]]、[[預期投資學與逆向折現 (Reverse DCF)]]
- **品質篩選工具**：[[Piotroski F-Score 評分模型]]、[[DuPont 杜邦分析三因子拆解]]
- **產品落地**：[[選股 Preset 分類矩陣與付費分層]]（巴菲特護城河與 Magic Formula 選股預設核心因子）
