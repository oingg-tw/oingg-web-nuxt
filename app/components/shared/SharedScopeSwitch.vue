<script setup lang="ts">
// 側欄最下面的「看哪一組」切換（2026-10-19）：持股的帳戶（HoldingsNav）、觀察清單的清單（WatchlistNav）。使用者先在持股說「我的帳戶切換
// 機制，如果放到 sidebar 是不是可以讓視覺簡潔點」，選了「側欄最下面」，再要觀察清單「比照持股那邊的設計辦理」——同一條規則兩個地方用，
// 所以抽成這一個（CLAUDE.md 的負責元件表）。呼叫端放進 SectionNav 的 #after，只有兩組以上時才畫（一組的人側欄跟原本一樣）。
// 每列是按鈕不是連結：選的是「看哪一組」，不是換頁（呼叫端決定要不要順便換頁）。前面的實心／空心圓點表示「選一個」，跟上面的頁面連結
// 分開；選中那一列的粗體、底線、淡底色同目前頁。列、組標題、分隔線的樣子在 main.css 的 .rail-*（全站側欄共用，2026-10-20）
defineProps<{
  // 這一段的標題，例如「帳戶」「清單」
  heading: string
  // id 是 null 的那一項是「全部」（持股的「全部帳戶」）
  items: { id: string | null; name: string }[]
  activeId: string | null
  // 還在讀（2026-10-20）：畫這麼多列骨架（上次的組數）。側欄是垂直置中的，這一段晚出現整個側欄會往上跳半段
  skeletonRows?: number
}>()
const emit = defineEmits<{ select: [id: string | null] }>()
const headingId = useId()
</script>

<template>
  <div class="rail-group" role="group" :aria-labelledby="headingId" :aria-busy="!!skeletonRows">
    <p :id="headingId" class="rail-heading">{{ heading }}</p>
    <ul class="rail-list scope-switch__list">
      <template v-if="skeletonRows">
        <li v-for="index in skeletonRows" :key="index" aria-hidden="true">
          <span class="rail-item scope-switch__item scope-switch__item--skeleton"><span class="app-skeleton app-skeleton--inline scope-switch__skeleton" /></span>
        </li>
      </template>
      <li v-for="item in items" v-else :key="item.id ?? '__all'">
        <button
          type="button"
          class="rail-item scope-switch__item"
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
/* 組標題底下直接接列，同清單裡的組 */
.scope-switch__list {
  padding-top: 0;
}

.scope-switch__item {
  gap: 10px;
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

.scope-switch__item[aria-current]::before {
  border-color: currentColor;
  background: radial-gradient(circle, currentColor 0 3px, transparent 3.5px);
}

.scope-switch__item--skeleton {
  cursor: default;
}

.scope-switch__item--skeleton:hover {
  background: none;
}

.scope-switch__skeleton {
  width: 5em;
}
</style>
