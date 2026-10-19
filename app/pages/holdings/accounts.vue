<script setup lang="ts">
// 帳戶管理（2026-10-19，使用者選「側欄加一頁帳戶管理」）：新增、改名、排序、刪除持股帳戶。切換在側欄最下面（HoldingsAccountSwitch），
// 只有兩個以上帳戶時才出現——所以一個帳戶的人要新增第二個，入口就是這一頁。
// 刪除帳戶＝連同它的所有交易一起刪（業務中台）。比照全站「可以復原的動作不先確認」：那一列先藏起來，提示寫明連交易一起刪，10 秒內可以
// 復原，時間到才送 DELETE。只剩一個帳戶時不給刪：交易一定要有帳戶放。上移、下移是真按鈕（不靠拖曳，WCAG 2.5.7）。
useSeoMeta({ title: '帳戶管理', robots: 'noindex, nofollow' })

const { portfolios, createPortfolio, renamePortfolio, deletePortfolio, reorderPortfolios } = useHoldingsPortfolios()
type Portfolio = (typeof portfolios.value)[number]

const pendingRemoval = ref<string[]>([])
const visible = computed(() => portfolios.value.filter(portfolio => !pendingRemoval.value.includes(portfolio.id)))
// 上移、下移、新增的結果念給螢幕閱讀器（按鈕本身不會說發生了什麼）
const status = ref('')

async function rename(portfolio: Portfolio) {
  const name = await promptPresetName(`幫「${portfolio.name}」改名`, portfolio.name, '改名')
  if (!name || name === portfolio.name) return
  await renamePortfolio(portfolio.id, name)
  status.value = `已改名為「${name}」`
}

// 業務中台的 reorder 要剛好是全部帳戶的 id：藏起來、等刪除的那幾個也要帶上
function move(portfolio: Portfolio, offset: -1 | 1) {
  const index = visible.value.indexOf(portfolio)
  const neighbor = visible.value[index + offset]
  if (!neighbor) return
  const ids = portfolios.value.map(item => item.id)
  const from = ids.indexOf(portfolio.id)
  const to = ids.indexOf(neighbor.id)
  ;[ids[from], ids[to]] = [ids[to]!, ids[from]!]
  void reorderPortfolios(ids)
  status.value = `「${portfolio.name}」移到第 ${index + offset + 1} 個`
}

function remove(portfolio: Portfolio) {
  if (visible.value.length <= 1) return
  pendingRemoval.value = [...pendingRemoval.value, portfolio.id]
  let undone = false
  undoToast(`已刪除「${portfolio.name}」和它的所有交易`, () => {
    undone = true
    pendingRemoval.value = pendingRemoval.value.filter(id => id !== portfolio.id)
  }, async () => {
    if (!undone) await deletePortfolio(portfolio.id)
    pendingRemoval.value = pendingRemoval.value.filter(id => id !== portfolio.id)
  })
}

const newName = ref('')
const creating = ref(false)
async function add() {
  const name = newName.value.trim()
  if (!name || creating.value) return
  creating.value = true
  const portfolio = await createPortfolio(name)
  creating.value = false
  if (!portfolio) return
  newName.value = ''
  status.value = `已新增「${portfolio.name}」`
}
</script>

<template>
  <HoldingsPageShell
    title="帳戶管理"
    subtitle="一個券商一個帳戶，持股與成本各自計算；在側欄切換要看哪個帳戶"
    guest-title="登入後管理你的持股帳戶"
    guest-text="帳戶與交易紀錄存在你的帳號裡，只有你看得到。"
  >
    <section class="accounts-page__section" aria-labelledby="accounts-list-title">
      <h2 id="accounts-list-title" class="accounts-page__title">你的帳戶</h2>
      <p v-if="!visible.length" class="accounts-page__text">第一次記交易或匯入時，會自動建立「我的帳戶」。</p>
      <ul v-else class="accounts-list">
        <li v-for="(portfolio, index) in visible" :key="portfolio.id" class="accounts-list__row">
          <span class="accounts-list__name">{{ portfolio.name }}</span>
          <div class="accounts-list__actions">
            <el-button link type="primary" :aria-label="`幫「${portfolio.name}」改名`" @click="rename(portfolio)">改名</el-button>
            <el-button link :disabled="index === 0" :aria-label="`把「${portfolio.name}」上移`" @click="move(portfolio, -1)">上移</el-button>
            <el-button link :disabled="index === visible.length - 1" :aria-label="`把「${portfolio.name}」下移`" @click="move(portfolio, 1)">下移</el-button>
            <el-button v-if="visible.length > 1" link type="danger" :aria-label="`刪除「${portfolio.name}」和它的所有交易`" @click="remove(portfolio)">刪除</el-button>
          </div>
        </li>
      </ul>
      <p class="visually-hidden" role="status">{{ status }}</p>
    </section>

    <section class="accounts-page__section" aria-labelledby="accounts-new-title">
      <h2 id="accounts-new-title" class="accounts-page__title">新增帳戶</h2>
      <form class="accounts-new" @submit.prevent="add">
        <label for="accounts-new-name" class="accounts-new__label">帳戶名稱（例如券商名稱）</label>
        <div class="accounts-new__row">
          <!-- 不加 size="large"：Element Plus 的 large 把輸入框字級寫死成 14px（全站下限 16px） -->
          <el-input id="accounts-new-name" v-model="newName" :maxlength="20" placeholder="例如：元大" />
          <el-button type="primary" native-type="submit" :loading="creating" :disabled="!newName.trim()">新增</el-button>
        </div>
      </form>
    </section>
  </HoldingsPageShell>
</template>

<style scoped>
.accounts-page__section {
  margin-top: 24px;
}

.accounts-page__title {
  margin: 0 0 12px;
  font-size: 1.125rem;
  font-weight: 600;
}

.accounts-page__text {
  margin: 0;
  color: var(--el-text-color-regular);
}

.accounts-list {
  max-width: 640px;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--el-border-color-lighter);
}

.accounts-list__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 16px;
  min-height: 56px;
  padding: 4px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.accounts-list__name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.accounts-list__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0 16px;
}

/* 觸控高度 44px（全站規則），el-button 相鄰時的 margin-left 由 gap 取代 */
.accounts-list__actions .el-button {
  min-height: 44px;
  margin: 0;
}

.accounts-new {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 480px;
}

.accounts-new__label {
  color: var(--el-text-color-regular);
}

.accounts-new__row {
  display: flex;
  gap: 8px;
}

.accounts-new__row .el-button {
  margin: 0;
}
</style>
