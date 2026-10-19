<script setup lang="ts">
// 側欄最下面的「看哪一組」切換（2026-10-19）：持股的帳戶（HoldingsNav）、觀察清單的清單（WatchlistNav）。使用者先在持股說「我的帳戶切換
// 機制，如果放到 sidebar 是不是可以讓視覺簡潔點」，選了「側欄最下面」，再要觀察清單「比照持股那邊的設計辦理」——同一條規則兩個地方用，
// 所以抽成這一個（CLAUDE.md 的負責元件表）。呼叫端放進 SectionNav 的 #after，只有兩組以上時才畫（一組的人側欄跟原本一樣）。
// 放在頁面連結下面：這些組要登入後才讀得到，放下面出現時不會把頁面連結往下推。
// 每列是按鈕不是連結：選的是「看哪一組」，不是換頁（呼叫端決定要不要順便換頁）。前面的實心／空心圓點表示「選一個」，跟上面的頁面連結
// 分開；選中那一列再加粗體、底線、淡底色（同目前頁），不只靠顏色。
defineProps<{
  // 這一段的標題，例如「帳戶」「清單」
  heading: string
  // id 是 null 的那一項是「全部」（持股的「全部帳戶」）
  items: { id: string | null; name: string }[]
  activeId: string | null
}>()
const emit = defineEmits<{ select: [id: string | null] }>()
const headingId = useId()
</script>

<template>
  <div class="scope-switch" role="group" :aria-labelledby="headingId">
    <p :id="headingId" class="scope-switch__heading">{{ heading }}</p>
    <ul class="scope-switch__list">
      <li v-for="item in items" :key="item.id ?? '__all'">
        <button
          type="button"
          class="scope-switch__item"
          :aria-current="item.id === activeId ? 'true' : undefined"
          @click="emit('select', item.id)"
        >
          {{ item.name }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* 標題與分隔線同個股側欄的「自選指標」那一段（StockPageNavList 的 __heading） */
.scope-switch__heading {
  margin: 8px 0 0;
  padding: 12px 20px 4px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.scope-switch__list {
  margin: 0;
  padding: 0 0 8px;
  list-style: none;
}

/* 整列可點，48px 是本站的觸控下限（同側欄的頁面連結） */
.scope-switch__item {
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

.scope-switch__item:hover {
  background: var(--el-fill-color-light);
}

.scope-switch__item:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}

/* 圓點：空心＝沒選，實心＝選中 */
.scope-switch__item::before {
  content: '';
  flex: none;
  box-sizing: border-box;
  width: 14px;
  height: 14px;
  border: 2px solid var(--el-text-color-secondary);
  border-radius: 50%;
}

.scope-switch__item[aria-current] {
  font-weight: 700;
  color: var(--el-color-primary-dark-2);
  background: var(--el-color-primary-light-9);
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 2px;
}

.scope-switch__item[aria-current]::before {
  border-color: currentColor;
  background: radial-gradient(circle, currentColor 0 3px, transparent 3.5px);
}
</style>
