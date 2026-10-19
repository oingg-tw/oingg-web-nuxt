<script setup lang="ts">
// 持股帳戶切換（2026-10-19，使用者：「holdings 這邊視覺上複雜度開始直線上升了…我的帳戶切換機制，如果放到 sidebar 是不是可以讓視覺簡潔點」）。
// 放在持股側欄（HoldingsNav → SectionNav 的 #after）的最下面：使用者選「側欄最下面」，帳戶要登入後才讀得到，放下面出現時不會把頁面連結
// 往下推。只有兩個以上帳戶時才畫——一個帳戶的人側欄跟原本一樣。新增、改名、刪除、排序在「帳戶管理」頁（/holdings/accounts）。
// 每列是按鈕不是連結：選的是「看哪個帳戶」，不是換頁；網址的 ?account= 由 HoldingsPageShell 同步（AppBottomNav 會在網址變動時收起）。
// 前面的實心／空心圓點表示「選一個」，跟上面的頁面連結分開；選中那一列再加粗體、底線、淡底色（同目前頁），不只靠顏色。
const { portfolios, selectedPortfolioId, selected, ready } = useHoldingsPortfolios()
const headingId = useId()
const items = computed(() => [{ id: null as string | null, name: '全部帳戶' }, ...portfolios.value.map(({ id, name }) => ({ id: id as string | null, name }))])
const activeId = computed(() => selected.value?.id ?? null)
</script>

<template>
  <div v-if="ready && portfolios.length > 1" class="account-switch" role="group" :aria-labelledby="headingId">
    <p :id="headingId" class="account-switch__heading">帳戶</p>
    <ul class="account-switch__list">
      <li v-for="item in items" :key="item.id ?? 'all'">
        <button
          type="button"
          class="account-switch__item"
          :aria-current="item.id === activeId ? 'true' : undefined"
          @click="selectedPortfolioId = item.id"
        >
          {{ item.name }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* 標題與分隔線同個股側欄的「自選指標」那一段（StockPageNavList 的 __heading） */
.account-switch__heading {
  margin: 8px 0 0;
  padding: 12px 20px 4px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.account-switch__list {
  margin: 0;
  padding: 0 0 8px;
  list-style: none;
}

/* 整列可點，48px 是本站的觸控下限（同側欄的頁面連結） */
.account-switch__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  padding: 8px 20px;
  border: none;
  background: none;
  color: var(--el-text-color-primary);
  font: inherit;
  font-size: 1rem;
  text-align: left;
  cursor: pointer;
}

.account-switch__item:hover {
  background: var(--el-fill-color-light);
}

.account-switch__item:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}

/* 圓點：空心＝沒選，實心＝選中 */
.account-switch__item::before {
  content: '';
  flex: none;
  box-sizing: border-box;
  width: 14px;
  height: 14px;
  border: 2px solid var(--el-text-color-secondary);
  border-radius: 50%;
}

.account-switch__item[aria-current] {
  font-weight: 700;
  color: var(--el-color-primary-dark-2);
  background: var(--el-color-primary-light-9);
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 2px;
}

.account-switch__item[aria-current]::before {
  border-color: currentColor;
  background: radial-gradient(circle, currentColor 0 3px, transparent 3.5px);
}
</style>
