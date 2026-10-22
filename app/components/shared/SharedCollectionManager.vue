<script setup lang="ts">
// 「幾組東西」的管理頁內容（2026-10-19）：持股的帳戶管理（/holdings/accounts）、觀察清單的清單管理（/watchlist/lists）。使用者先在持股選了
// 「側欄加一頁帳戶管理」，再要觀察清單「比照持股那邊的設計辦理」——同一套操作兩個地方用，所以抽成這一個（CLAUDE.md 的負責元件表）。
//   - 每一組一列：名稱｜改名、上移、下移、刪除，都是真按鈕（排序不靠拖曳，WCAG 2.5.7）
//   - 刪除比照全站「可以復原的動作不先確認」：呼叫端先把那一組從自己的清單拿掉（hide，側欄跟著馬上消失——2026-10-22 使用者：「sidebar
//     沒有馬上刪掉。我認為應馬上刪掉，用戶點選還原再還原」），提示寫明會一起刪掉什麼（deleteMessage），10 秒內可以復原（放回原位），
//     時間到才呼叫 remove，沒刪成（回 false）也放回去。只剩一組時不給刪
//   - 下面一個新增表單。同名、額度、名稱長度的提示由呼叫端的 create 處理（它回 null 就是沒建成）
// 改名用 promptPresetName（同篩選器，1～20 字）。上移、下移、新增的結果念給螢幕閱讀器。
interface Item { id: string; name: string }
const props = defineProps<{
  items: Item[]
  // 「你的帳戶」「你的清單」
  listTitle: string
  // 一組都沒有時的說明
  emptyText: string
  // 「新增帳戶」「新增清單」
  addTitle: string
  // 輸入框的標籤與提示
  nameLabel: string
  placeholder: string
  // 刪除後的提示與刪除鈕的可及名稱，寫明會一起刪掉什麼：「已刪除「元大」和它的所有交易」
  deleteMessage: (name: string) => string
  deleteLabel: (name: string) => string
  create: (name: string) => Promise<Item | null>
  rename: (id: string, name: string) => Promise<unknown>
  // 先從清單（含側欄）拿掉，回傳還原的函式
  hide: (id: string) => () => void
  // 真的刪；回 false 是沒刪成
  remove: (id: string) => Promise<boolean>
  // 要剛好是全部的 id（業務中台的 reorder 規則）
  reorder: (ids: string[]) => Promise<unknown>
  // 資料還沒到：畫這麼多列骨架（useLayoutHint 記住的組數），0＝資料到了（2026-10-20，使用者：「載入之前，可以讓用戶看的出來畫面結構」）
  skeletonRows?: number
}>()

const uid = useId()
// 已經藏起來、還在 10 秒復原期間的：清單裡沒有了，但伺服器上還在，重新排序要帶上（業務中台要全部的 id）
const pendingRemoval = ref<Item[]>([])
const status = ref('')

async function renameItem(item: Item) {
  const name = await promptPresetName(`幫「${item.name}」改名`, item.name, '改名')
  if (!name || name === item.name) return
  await props.rename(item.id, name)
  status.value = `已改名為「${name}」`
}

// 藏起來、等刪除的那幾組接在最後（reorder 要全部的 id）
function move(item: Item, offset: -1 | 1) {
  const index = props.items.indexOf(item)
  const neighbor = props.items[index + offset]
  if (!neighbor) return
  const ids = props.items.map(each => each.id)
  ;[ids[index], ids[index + offset]] = [ids[index + offset]!, ids[index]!]
  void props.reorder([...ids, ...pendingRemoval.value.map(each => each.id)])
  status.value = `「${item.name}」移到第 ${index + offset + 1} 個`
}

function removeItem(item: Item) {
  if (props.items.length <= 1) return
  const restore = props.hide(item.id)
  pendingRemoval.value = [...pendingRemoval.value, item]
  const settle = () => { pendingRemoval.value = pendingRemoval.value.filter(each => each.id !== item.id) }
  let undone = false
  undoToast(props.deleteMessage(item.name), () => {
    undone = true
    settle()
    restore()
  }, async () => {
    if (undone) return
    const removed = await props.remove(item.id)
    settle()
    if (!removed) restore()
  })
}

const newName = ref('')
const creating = ref(false)
async function add() {
  const name = newName.value.trim()
  if (!name || creating.value) return
  creating.value = true
  const created = await props.create(name)
  creating.value = false
  if (!created) return
  newName.value = ''
  status.value = `已新增「${created.name}」`
}
</script>

<template>
  <section class="collection-manager__section" :aria-labelledby="`${uid}-list`">
    <h2 :id="`${uid}-list`" class="collection-manager__title">{{ listTitle }}</h2>
    <!-- 讀的時候（skeletonRows）：上次那麼多列，名稱是骨架、按鈕照畫但不能按，列高跟資料到了一樣（2026-10-20） -->
    <ul v-if="skeletonRows" class="collection-manager__list" aria-hidden="true">
      <li v-for="index in skeletonRows" :key="index" class="collection-manager__row">
        <span class="collection-manager__name"><span class="app-skeleton app-skeleton--inline collection-manager__skeleton" /></span>
        <div class="collection-manager__actions">
          <el-button link type="primary" disabled tabindex="-1">改名</el-button>
          <el-button link disabled tabindex="-1">上移</el-button>
          <el-button link disabled tabindex="-1">下移</el-button>
          <el-button v-if="skeletonRows > 1" link type="danger" disabled tabindex="-1">刪除</el-button>
        </div>
      </li>
    </ul>
    <p v-else-if="!items.length" class="collection-manager__text">{{ emptyText }}</p>
    <ul v-else class="collection-manager__list">
      <li v-for="(item, index) in items" :key="item.id" class="collection-manager__row">
        <span class="collection-manager__name">{{ item.name }}</span>
        <div class="collection-manager__actions">
          <el-button link type="primary" :aria-label="`幫「${item.name}」改名`" @click="renameItem(item)">改名</el-button>
          <el-button link :disabled="index === 0" :aria-label="`把「${item.name}」上移`" @click="move(item, -1)">上移</el-button>
          <el-button link :disabled="index === items.length - 1" :aria-label="`把「${item.name}」下移`" @click="move(item, 1)">下移</el-button>
          <el-button v-if="items.length > 1" link type="danger" :aria-label="deleteLabel(item.name)" @click="removeItem(item)">刪除</el-button>
        </div>
      </li>
    </ul>
    <p class="visually-hidden" role="status">{{ status }}</p>
  </section>

  <section class="collection-manager__section" :aria-labelledby="`${uid}-add`">
    <h2 :id="`${uid}-add`" class="collection-manager__title">{{ addTitle }}</h2>
    <form class="collection-manager__new" @submit.prevent="add">
      <label :for="`${uid}-name`" class="collection-manager__label">{{ nameLabel }}</label>
      <div class="collection-manager__new-row">
        <!-- 不加 size="large"：Element Plus 的 large 把輸入框字級寫死成 14px（全站下限 16px） -->
        <el-input :id="`${uid}-name`" v-model="newName" :maxlength="20" :placeholder="placeholder" />
        <el-button type="primary" native-type="submit" :loading="creating" :disabled="!newName.trim() || !!skeletonRows">新增</el-button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.collection-manager__section {
  margin-top: 24px;
}

.collection-manager__title {
  margin: 0 0 12px;
  font-size: 1.125rem;
  font-weight: 600;
}

.collection-manager__text {
  margin: 0;
  color: var(--el-text-color-regular);
}

.collection-manager__list {
  max-width: 640px;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--el-border-color-lighter);
}

.collection-manager__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 16px;
  min-height: 56px;
  padding: 4px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.collection-manager__name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.collection-manager__skeleton {
  width: 6em;
}

.collection-manager__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0 16px;
}

/* 觸控高度 44px（全站規則），el-button 相鄰時的 margin-left 由 gap 取代 */
.collection-manager__actions .el-button {
  min-height: 44px;
  margin: 0;
}

.collection-manager__new {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 480px;
}

.collection-manager__label {
  color: var(--el-text-color-regular);
}

.collection-manager__new-row {
  display: flex;
  gap: 8px;
}

.collection-manager__new-row .el-button {
  margin: 0;
}
</style>
