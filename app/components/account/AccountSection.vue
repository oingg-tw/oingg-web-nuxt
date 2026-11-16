<script setup lang="ts">
// 帳號區的一段（2026-11-16，使用者：「account 相關頁面都請重新設計。電腦版上看起來彆扭，Mobile first沒問題，但是在電腦版要RWD」）：
// 手機上標題在上、內容在下；內容欄夠寬時標題與說明在左、內容在右，跟一般的設定頁一樣，每一段對齊。帳號區的頁面都用它分段。
// id：站內連結要跳到這一段時給（例如電子報頁連到「登入方式」）
const props = defineProps<{ title: string; id?: string }>()
const headingId = props.id ?? useId()
</script>

<template>
  <section class="account-section" :aria-labelledby="headingId">
    <div class="account-section__head">
      <h2 :id="headingId" class="account-section__title">{{ title }}</h2>
      <p v-if="$slots.description" class="account-section__description"><slot name="description" /></p>
    </div>
    <div class="account-section__body"><slot /></div>
  </section>
</template>

<style scoped>
.account-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}

.account-section__head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.account-section__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.account-section__description {
  margin: 0;
  color: var(--el-text-color-secondary);
}

/* 內容欄自己也是容器：裡面的東西照這一欄的寬排（例如方案名稱下面留幾行） */
.account-section__body {
  container-type: inline-size;
  min-width: 0;
}

/* 容器是 AccountPageShell 的 .account-shell。720：標題欄 12rem（192px）＋間距 24＋內容至少 480（手機版整欄的寬）＝696，
   取全站表格切卡片的同一個數字 */
@container (min-width: 720px) {
  .account-section {
    display: grid;
    grid-template-columns: 12rem minmax(0, 1fr);
    gap: 24px;
    margin-top: 32px;
  }
}
</style>
