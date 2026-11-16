<script setup lang="ts">
// 帳號區的一段（2026-11-16）：標題、說明在上，內容在下。電腦版由頁面把幾段排成並排的欄（使用者：「重心不穩 而且又留白過多」，
// 先前標題放左邊一欄的排法，左欄底下整條是空的）。id：站內連結要跳到這一段時給（例如電子報頁連到「登入方式」）
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
  min-width: 0;
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

/* 內容欄自己也是容器：裡面的東西照這一欄的寬排（例如個人資料卡橫排或直排、方案名稱下面留幾行） */
.account-section__body {
  container-type: inline-size;
  min-width: 0;
}
</style>
