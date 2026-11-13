<script setup lang="ts">
import { ArrowDown, Check } from '@element-plus/icons-vue'
import type { PresetSelectItem } from '~/components/screener/ScreenerPresetSelect.vue'

// 每一類的「欄位：<組合名>」選單（2026-11-07 觀察清單改版方案 A；2026-11-14 從觀察清單頁抽出來，持股總覽也用，使用者：「持股管理 也要有
// 地方可以切換顯示的欄位，共用欄位設定」）：寫著現在用哪一組，打開是這一類的欄位組合與到那一類篩選管理。選一組＝這一類的預設，篩選、
// 觀察清單、持股一起變（useWatchlistColumns 的 select）。
// 照頁首導覽（AppNavMenu）的可展開模式：按鈕的 aria-expanded 控制緊接在後的清單，Tab 自然走進去；Esc 關掉並回到按鈕，焦點離開或點外面
// 就關（同一頁幾個選單因此一次只開一個）。選了組合先關掉、焦點回到按鈕
const props = defineProps<{
  // 按鈕的 id；清單是 `${id}-menu`
  id: string
  items: PresetSelectItem[]
  activeId: string
  // 分段時的類別（「ETF」）：可及名稱念「ETF的欄位：看配息與成本」；不給就念按鈕上的字
  kindLabel?: string
  screenerPath: string
  // 「到普通股篩選管理」的「普通股」
  screenerLabel: string
  // 資料還沒到（骨架）：照樣畫、先不能按，到了不移動
  disabled?: boolean
}>()
const emit = defineEmits<{ select: [id: string] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const activeName = computed(() => props.items.find(item => item.id === props.activeId)?.name ?? '基本欄位')

function close(returnFocus = false) {
  open.value = false
  if (returnFocus) document.getElementById(props.id)?.focus()
}
function onFocusout(event: FocusEvent) {
  if (!root.value?.contains(event.relatedTarget as Node | null)) close()
}
function onPointerdown(event: PointerEvent) {
  if (open.value && !root.value?.contains(event.target as Node)) close()
}
onMounted(() => document.addEventListener('pointerdown', onPointerdown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerdown))

function pick(id: string) {
  close(true)
  emit('select', id)
}
</script>

<template>
  <div ref="root" class="column-set-menu" :class="{ 'is-open': open }" @keydown.esc="close(true)" @focusout="onFocusout">
    <el-button
      :id="id"
      class="column-set-menu__button"
      :aria-label="kindLabel ? `${kindLabel}的欄位：${activeName}` : undefined"
      :aria-expanded="open"
      :aria-controls="`${id}-menu`"
      :disabled="disabled"
      @click="open = !open"
    >
      <span class="column-set-menu__text">欄位：{{ activeName }}</span>
      <el-icon class="column-set-menu__chevron" :class="{ 'is-open': open }" aria-hidden="true"><ArrowDown /></el-icon>
    </el-button>
    <div v-show="open" :id="`${id}-menu`" class="column-set-menu__panel">
      <p :id="`${id}-sets`" class="rail-heading">顯示欄位</p>
      <ul class="rail-list column-set-menu__sets" :aria-labelledby="`${id}-sets`">
        <li v-for="item in items" :key="item.id">
          <button type="button" class="rail-item" :aria-current="item.id === activeId ? 'true' : undefined" @click="pick(item.id)">
            <el-icon class="column-set-menu__check" aria-hidden="true"><Check v-if="item.id === activeId" /></el-icon>{{ item.name }}
          </button>
        </li>
      </ul>
      <ul class="rail-list column-set-menu__more">
        <li><NuxtLink :to="screenerPath" class="rail-item">到{{ screenerLabel }}篩選管理</NuxtLink></li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
/* 清單掛在按鈕正下方、靠右對齊，列的樣子跟側欄一樣（.rail-item），同頁首導覽的下拉。放在哪裡（靠右）由呼叫端決定 */
.column-set-menu {
  position: relative;
}

.column-set-menu__text {
  max-width: min(16rem, calc(100vw - 120px));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.column-set-menu__chevron {
  margin-left: 4px;
  transition: transform 0.15s ease;
}

.column-set-menu__chevron.is-open {
  transform: rotate(180deg);
}

.column-set-menu__panel {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 20;
  width: max-content;
  min-width: 240px;
  max-width: calc(100vw - 32px);
  border: 1px solid var(--app-surface-border);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
  box-shadow: var(--el-box-shadow-light);
}

.column-set-menu__panel > .rail-heading {
  margin: 0;
  border-top: 0;
}

.column-set-menu__sets {
  padding-top: 0;
}

.column-set-menu__more {
  border-top: 1px solid var(--app-divider);
}

.column-set-menu__check {
  flex-shrink: 0;
}
</style>
