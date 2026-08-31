<script setup lang="ts">
import { WarningFilled } from '@element-plus/icons-vue'

// Condensed from docs/KY Stock Fundamental Analysis.md into an actionable checklist —
// the doc itself is a full forensic-accounting essay; this keeps just the "what to actually
// check" points, not the tax/regulatory background prose. Static content for now (no live
// per-stock data wired up yet — see the note at the bottom), but genuinely useful on its own
// while that's built.
interface WarningItem {
  title: string
  description: string
}

const FINANCIAL_WARNINGS: WarningItem[] = [
  {
    title: '存貸雙高',
    description: '帳上現金充沛卻同時舉借大量短期借款，或利息收入明顯低於同業定存利率，現金可能已遭質押、凍結，甚至是虛構資產。'
  },
  {
    title: '應收帳款週轉天數（DSO）異常飆升',
    description: '帳款天數遠高於同業或逐季暴增，代表銷貨款項難以實質收現，後續恐提列大額備抵呆帳或商譽減損。'
  },
  {
    title: '營業現金流長期落後稅後淨利',
    description: '帳面獲利亮眼但營業活動現金流長期偏低甚至為負，代表獲利可能來自應收帳款增加等帳面認列，而非真實現金流入。'
  },
  {
    title: '資本支出與關係人往來異常',
    description: '出現不成比例的大額預付款項、非常規跨境併購或高額對外背書保證，需留意資金實際流向。'
  }
]

const GOVERNANCE_WARNINGS: WarningItem[] = [
  {
    title: '簽證會計師頻繁更換',
    description: '在無充分商業理由下更換會計師事務所，通常代表查核程序（如海外銀行函證、存貨盤點）遭遇阻礙。'
  },
  {
    title: '關鍵查核事項（KAM）連年集中同一風險',
    description: '若KAM連續多年集中於收入認列真實性、海外存貨或商譽減損測試，代表資產灌水風險較高，值得深入研讀因應程序。'
  },
  {
    title: '董監持股質押比率過高',
    description: '質押比率超過五成時，經營層與外部股東利益脫鉤，一旦股價下挫觸及斷頭線，容易引發質押斷頭賣壓。'
  },
  {
    title: '財務主管或獨立董事密集異動',
    description: '財務長、內部稽核主管或獨立董事密集辭職，常是內控失衡或經營團隊涉及非常規交易的前兆訊號。'
  }
]
</script>

<template>
  <div class="ky-stocks-page">
    <h1 class="ky-stocks-page__title">KY 股專區</h1>
    <p class="ky-stocks-page__subtitle">
      境外第一上市櫃公司（KY股）具備稅務優勢，但跨國控股架構也帶來更高的資訊不對稱風險——傳統的EPS、本益比不足以評估，這裡整理投資人應該重點檢查的財務與治理警訊
    </p>

    <section class="ky-stocks-page__section">
      <h2 class="ky-stocks-page__section-title">財務體質警訊</h2>
      <div class="ky-stocks-page__list">
        <div v-for="item in FINANCIAL_WARNINGS" :key="item.title" class="ky-stocks-page__item">
          <el-icon class="ky-stocks-page__item-icon"><WarningFilled /></el-icon>
          <div class="ky-stocks-page__item-body">
            <span class="ky-stocks-page__item-title">{{ item.title }}</span>
            <p class="ky-stocks-page__item-desc">{{ item.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="ky-stocks-page__section">
      <h2 class="ky-stocks-page__section-title">公司治理警訊</h2>
      <div class="ky-stocks-page__list">
        <div v-for="item in GOVERNANCE_WARNINGS" :key="item.title" class="ky-stocks-page__item">
          <el-icon class="ky-stocks-page__item-icon"><WarningFilled /></el-icon>
          <div class="ky-stocks-page__item-body">
            <span class="ky-stocks-page__item-title">{{ item.title }}</span>
            <p class="ky-stocks-page__item-desc">{{ item.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="ky-stocks-page__section">
      <h2 class="ky-stocks-page__section-title">監理防線</h2>
      <p class="ky-stocks-page__note">
        可搭配公開資訊觀測站「財務重點專區」的9大財務與交易預警指標，作為建構投資組合前的第一道負面清單篩選工具。
      </p>
    </section>

    <el-empty description="個股風險快篩工具開發中，敬請期待" />
  </div>
</template>

<style scoped>
.ky-stocks-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.ky-stocks-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.ky-stocks-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin: -16px 0 0;
}

.ky-stocks-page__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ky-stocks-page__section-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.ky-stocks-page__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ky-stocks-page__item {
  display: flex;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.ky-stocks-page__item-icon {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 18px;
  color: var(--el-color-warning);
}

.ky-stocks-page__item-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ky-stocks-page__item-title {
  font-size: 16px;
  font-weight: 600;
}

.ky-stocks-page__item-desc {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.ky-stocks-page__note {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
</style>
