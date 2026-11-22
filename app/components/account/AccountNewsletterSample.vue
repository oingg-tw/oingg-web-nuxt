<script setup lang="ts">
// 「看範例週報」（2026-11-16，使用者決定：網站畫固定的假資料，不打後端）：版型照設計的週報信件（https://claude.ai/artifact/YK4pXxDNTwggGgbB4DvoEN 的 4），
// 信本身是業務中台寄的 HTML。公司用「範例」名稱，不把假的除息、公告、處置安在真的公司上
const open = defineModel<boolean>({ required: true })
</script>

<template>
  <el-dialog v-model="open" title="範例週報" width="min(600px, calc(100vw - 32px))" append-to-body>
    <p class="newsletter-sample__intro">範例：公司和數字都是示意。真的週報只放你持有、加入觀察清單的股票，沒資料的那一塊不寄。</p>
    <article class="app-card newsletter-sample" aria-label="範例週報">
      <header class="newsletter-sample__part">
        <p class="newsletter-sample__brand">安盈選股</p>
        <h3 class="newsletter-sample__title">持股週報</h3>
        <p class="newsletter-sample__muted">11/16（一）～11/20（五）這一週</p>
      </header>

      <!-- 第一句就是結論（2026-11-22，〈看盤 SaaS 電子報設計策略〉；同信件的那一列與收件匣預覽文字） -->
      <section class="newsletter-sample__part">
        <p class="newsletter-sample__lead">本週總市值 <span class="newsletter-sample__up">▲ 2.3%（+27,800 元）</span>，下週 1 檔除息，約入帳 1,500 元。</p>
      </section>

      <section class="newsletter-sample__part">
        <h4 class="newsletter-sample__heading">你的持股</h4>
        <dl class="newsletter-sample__figures">
          <div><dt>總市值（11/20 收盤）</dt><dd class="newsletter-sample__big">1,234,567 元</dd></div>
          <div><dt>本週變化</dt><dd class="newsletter-sample__up">▲ 27,800 元（+2.3%）</dd></div>
          <div><dt>今年股利收入</dt><dd>38,420 元</dd></div>
        </dl>
      </section>

      <section class="newsletter-sample__part">
        <h4 class="newsletter-sample__heading">下週除權息與預估入帳</h4>
        <p class="newsletter-sample__muted">11/23（一）～11/27（五）</p>
        <div class="newsletter-sample__row">
          <div>
            <p class="newsletter-sample__name">範例高股息 ETF</p>
            <p class="newsletter-sample__muted">11/25（三）除息・每股 0.5 元 × 你的 3,000 股</p>
          </div>
          <div class="newsletter-sample__end">
            <p class="newsletter-sample__name">約 1,500 元</p>
            <p class="newsletter-sample__muted">12/16 入帳</p>
          </div>
        </div>
        <p class="newsletter-sample__small">預估入帳＝你的股數 × 每股股利，實際以入帳金額為準。</p>
      </section>

      <section class="newsletter-sample__part">
        <h4 class="newsletter-sample__heading">本週重大訊息</h4>
        <ul class="newsletter-sample__list">
          <li><span class="newsletter-sample__muted">範例電子・11/19</span><span class="newsletter-sample__name">董事會決議發放現金股利</span></li>
          <li><span class="newsletter-sample__muted">範例電信・11/18</span><span class="newsletter-sample__name">公告取得機器設備</span></li>
        </ul>
        <p class="newsletter-sample__small">只列標題，信裡點了看公告內容。</p>
      </section>

      <section class="newsletter-sample__part">
        <h4 class="newsletter-sample__heading">注意股、處置股</h4>
        <p>範例生技 <span class="newsletter-sample__tag">處置股</span> 11/19～12/2，你持有</p>
        <p class="newsletter-sample__small">處置期間交易方式會改變，例如分盤撮合。</p>
        <!-- 照真的週報（業務中台 2026-11-22，證交所要求註明來源）：這一塊上市、上櫃都有，處置股也是，所以不加括號 -->
        <p class="newsletter-sample__small">資料來源：臺灣證券交易所、證券櫃檯買賣中心</p>
      </section>

      <footer class="newsletter-sample__part newsletter-sample__footer">
        <p class="newsletter-sample__small">你收到這封信，是因為在安盈選股的帳號設定開啟了每週持股週報，只列你持有、加入觀察清單的股票；那週沒有可以整理的內容就不寄。</p>
        <p class="newsletter-sample__small">信的最下面有「管理電子報設定」和「不再收週報」。本信整理公開資訊，不構成投資建議。</p>
      </footer>
    </article>
  </el-dialog>
</template>

<style scoped>
.newsletter-sample__intro {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
}

.newsletter-sample p,
.newsletter-sample h3,
.newsletter-sample h4,
.newsletter-sample dl,
.newsletter-sample dd {
  margin: 0;
}

.newsletter-sample__part {
  padding: 16px;
}

.newsletter-sample__part + .newsletter-sample__part {
  border-top: 1px solid var(--app-divider);
}

.newsletter-sample__brand {
  font-weight: 700;
  color: var(--el-color-primary-dark-2);
}

.newsletter-sample__title {
  font-size: 1.5rem;
  font-weight: 700;
}

.newsletter-sample__lead {
  font-size: 1.0625rem;
  font-weight: 600;
  line-height: 1.5;
}

.newsletter-sample__heading {
  margin-bottom: 8px;
  font-size: 1.125rem;
  font-weight: 600;
}

.newsletter-sample__muted,
.newsletter-sample__small {
  color: var(--el-text-color-secondary);
}

.newsletter-sample__small {
  margin-top: 8px;
}

.newsletter-sample__figures > div,
.newsletter-sample__row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
}

.newsletter-sample__figures > div + div {
  border-top: 1px solid var(--app-divider);
}

.newsletter-sample__figures dt {
  color: var(--el-text-color-regular);
}

.newsletter-sample__figures dd,
.newsletter-sample__name {
  font-weight: 600;
}

.newsletter-sample__big {
  font-size: 1.25rem;
}

/* 漲跌照外觀設定的顏色，加 ▲ 不只靠顏色 */
.newsletter-sample__up {
  color: var(--price-up-color);
}

/* 數字不折行，窄的時候折左邊的名稱 */
.newsletter-sample__figures dd,
.newsletter-sample__end {
  flex: none;
  white-space: nowrap;
  text-align: right;
}

.newsletter-sample__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.newsletter-sample__list li {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}

.newsletter-sample__list li + li {
  border-top: 1px solid var(--app-divider);
}

.newsletter-sample__tag {
  display: inline-block;
  margin: 0 4px;
  padding: 0 8px;
  border: 1px solid var(--el-color-danger);
  border-radius: 999px;
  color: var(--el-color-danger);
}
</style>
