<script setup lang="ts">
// 摘要卡星號按下去的選單內容（2026-10-19 多組觀察清單，使用者選「點星號跳出清單勾選」）：每一組一個勾選框，勾了就加入、
// 取消就移除（移除照樣有復原提示）；最下面可以新增一組並直接加入。一組都沒有時，列出「我的觀察清單」，勾下去才建立。
// 用的是 popover 不是對話框：個股頁上可能已經開著別的對話框（不疊對話框）。
const props = defineProps<{ code: string; name: string }>()
const emit = defineEmits<{ close: [] }>()

const { watchlists, listsContaining, addStock, removeStock, createWatchlist } = useStocks()
const inLists = computed(() => listsContaining(props.code))
const uid = useId()

function toggle(listId: string, checked: boolean) {
  if (checked) void addStock(props.code, props.name, listId)
  else removeStock(props.code, props.name, listId)
}

const newName = ref('')
const creating = ref(false)
const newInput = ref<{ focus: () => void } | null>(null)
async function createAndAdd() {
  const name = newName.value.trim()
  if (!name || creating.value) return
  creating.value = true
  const list = await createWatchlist(name)
  creating.value = false
  if (!list) return
  newName.value = ''
  // 「新增」按鈕清空後變停用，焦點會掉到頁面上（Esc 就關不掉選單）：放回輸入框，也方便接著再建一組
  newInput.value?.focus()
  await addStock(props.code, props.name, list.id)
}
</script>

<template>
  <div class="watchlist-picker" role="group" :aria-labelledby="`${uid}-title`" @keydown.esc.stop="emit('close')">
    <p :id="`${uid}-title`" class="watchlist-picker__title">加入觀察清單</p>
    <div class="watchlist-picker__lists">
      <template v-if="watchlists.length">
        <el-checkbox
          v-for="list in watchlists"
          :key="list.id"
          :model-value="inLists.includes(list.id)"
          @change="(checked) => toggle(list.id, !!checked)"
        >
          {{ list.name }}
        </el-checkbox>
      </template>
      <!-- 還沒有任何一組：勾下去由 addStock 先建「我的觀察清單」再加入 -->
      <el-checkbox v-else :model-value="false" @change="() => addStock(code, name)">我的觀察清單</el-checkbox>
    </div>
    <form class="watchlist-picker__new" @submit.prevent="createAndAdd">
      <label :for="`${uid}-new`" class="watchlist-picker__label">新增一組並加入</label>
      <div class="watchlist-picker__row">
        <el-input :id="`${uid}-new`" ref="newInput" v-model="newName" :maxlength="20" placeholder="例如：存股名單" />
        <el-button native-type="submit" :loading="creating" :disabled="!newName.trim()">新增</el-button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.watchlist-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.watchlist-picker__title {
  margin: 0;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.watchlist-picker__lists {
  display: flex;
  flex-direction: column;
}

/* 一列一組；觸控高度跟全站一樣 44px */
.watchlist-picker__lists :deep(.el-checkbox) {
  height: auto;
  min-height: 44px;
  margin-right: 0;
  white-space: normal;
}

.watchlist-picker__new {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.watchlist-picker__label {
  color: var(--el-text-color-regular);
}

.watchlist-picker__row {
  display: flex;
  gap: 8px;
}

.watchlist-picker__row .el-button {
  margin: 0;
}
</style>
