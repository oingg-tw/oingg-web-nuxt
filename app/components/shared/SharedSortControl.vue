<script setup lang="ts">
// 卡片版面的排序列：有框的「排序」下拉加方向鈕，全站只有這一個（2026-11-15，使用者看過總表選 C「比照現行篩選」：三個篩選、
// 觀察清單與分享頁、持股的損益與指標、已實現損益長一樣；11/14 的方案 A 一行字收掉）。電腦版沒有它：表頭本身就是排序按鈕
defineProps<{
  options: { value: string, label: string }[]
  // 空字串＝預設順序（allowNone 才有這一項）
  field: string | null
  order: 'ascending' | 'descending' | null
  // 有「預設順序」（不排序）這一項：篩選、觀察清單有；持股一定照某一欄排
  allowNone?: boolean
}>()
const emit = defineEmits<{ field: [value: string], toggle: [] }>()
</script>

<template>
  <div class="sort-control">
    <!-- 標籤疊在選單框裡（不攔點擊），名稱照樣是「排序」 -->
    <label class="sort-control__field">
      <span class="sort-control__label">排序</span>
      <select class="app-select sort-control__select" aria-label="排序" :value="field ?? ''" @change="emit('field', ($event.target as HTMLSelectElement).value)">
        <option v-if="allowNone" value="">預設順序</option>
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    </label>
    <!-- 方向一直在（沒選排序欄位時停用），選了欄位不會多冒出一個選單把版面推開。圖示是全站的排序圖示（沒排序兩個三角形、排序中只留
         那個方向；使用者 2026-10-21 的規範），不用文字箭頭：↑↓ 的高低跟著字型跑，跟旁邊的字對不齊 -->
    <el-button class="sort-control__direction" :disabled="!field" @click="emit('toggle')">
      <span class="visually-hidden">排序方向：</span><SharedSortIcon class="sort-control__icon" :state="field ? order : null" />{{ order === 'ascending' ? '小到大' : '大到小' }}
    </el-button>
  </div>
</template>

<style scoped>
/* 排序與方向相隔 8px（2026-11-02，使用者：「排序與 大到小 中間的間距 要調整」；scripts/check-screener-spacing.mjs）。
   高度跟著方向鈕（Element 的尺寸：滑鼠 32px、字級 110／120% 40px、觸控 44px）：原生選單（.app-select）本來固定 44px，
   用滑鼠看手機版面時比旁邊的按鈕高一截（2026-10-22，使用者：「手機版 排序 小到大 高度不對」）。觸控時全站規則把 select 撐到 44px */
.sort-control {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.sort-control__field {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
}

.sort-control__label {
  position: absolute;
  top: 50%;
  left: 12px;
  transform: translateY(-50%);
  color: var(--el-text-color-secondary);
  pointer-events: none;
}

/* 左邊留給疊上去的「排序」兩個字。名稱放不下時尾巴是「…」：320 寬時「近12個月總費用率估算」原本被切成「近12個月總費」，
   看不出被切掉（2026-11-15） */
.sort-control__select {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  padding-left: calc(12px + 2em + 8px);
  text-overflow: ellipsis;
}

/* 同寬（「欄位設定」四個字的寬度），跟上面幾列右邊的按鈕對齊 */
.sort-control__direction {
  flex: none;
  min-width: 6em;
  margin: 0;
}

.sort-control__icon {
  margin-right: 6px;
}
</style>
