<script setup lang="ts">
import type { ShareKind } from '~/composables/share/useShares'

// 分享連結（2026-10-19，使用者：「做好以後設計分享持股或是 watchlist 的機制」，選了：有連結就能看、免登入；內容即時；
// 分享時自己勾欄位、部位大小預設不勾；先做觀察清單再做持股）。觀察清單與持股共用這一顆（負責元件，見 CLAUDE.md）。
// 一個對象只有一條連結。2026-10-20 重新設計對話框（使用者：「分享彈跳視窗也請再設計，確保 UIUX」）：
//   - 連結列固定在最上面：還沒建立時這一列是「建立連結」，建立後同一列換成網址＋複製，下面的內容不跳；
//   - 有連結之後改勾選就直接存（旁邊寫「已儲存」），不用再按「更新欄位」——舊版建立後有兩顆主色按鈕、底部三顆按鈕；
//   - 底部只剩「取消」，或建立後的「關閉連結」（文字按鈕）＋「完成」。
// 關閉比照全站「可復原不先確認」：先關對話框（不疊對話框），undoToast 10 秒後才送 DELETE，這 10 秒內連結還能用。
const props = defineProps<{
  kind: ShareKind
  // 清單 id；持股是帳戶 id，null ＝ 全部帳戶
  targetId: string | null
  // 對話框標題用，例如清單名
  name: string
  // 可以分享的欄。sensitive 的預設不勾、放在下半部（部位大小、只有自己看得到的備註）
  columns: { key: string; label: string; sensitive?: boolean }[]
  sensitiveHeading: string
}>()

// 讀到自己有哪些連結之後才出現：讀不到就分不出「分享」還是「已分享」（業務中台 還沒上線這支時也是這樣，上線後自動出現）。
// 呼叫端把它放在靠右那一組的最左邊，出現時不推動旁邊的按鈕
const { shares, ensureShares, shareOf, saveShare, revokeShare } = useShares()
const currentUser = useCurrentUser()
onMounted(() => {
  watch(currentUser, () => void ensureShares(), { immediate: true })
})

// 關閉連結的那 10 秒，畫面上當作已經關了
const closing = ref<string | null>(null)
const active = computed(() => {
  const share = shareOf(props.kind, props.targetId)
  return share && share.token !== closing.value ? share : null
})
const origin = useRequestURL().origin
const url = computed(() => (active.value ? `${origin}/share/${active.value.token}` : ''))

const open = ref(false)
const chosen = ref<string[]>([])
const saving = ref(false)
const status = ref('')
const inputId = useId()
const copyButton = ref<{ ref?: HTMLElement } | null>(null)
// 系統分享選單只有部分瀏覽器有（手機），掛載後才知道，免得伺服器與瀏覽器畫的不一樣
const canShare = ref(false)
onMounted(() => (canShare.value = typeof navigator.share === 'function'))

function openDialog() {
  const stored = active.value?.columns.map(column => column.key)
  chosen.value = props.columns.filter(column => (stored ? stored.includes(column.key) : !column.sensitive)).map(column => column.key)
  status.value = ''
  open.value = true
}

// 照畫面上的欄位順序存（觀察清單換了欄位順序，分享出去的也跟著換）
const chosenColumns = () => props.columns.filter(column => chosen.value.includes(column.key)).map(({ key, label }) => ({ key, label }))
const unchanged = computed(() => !!active.value && active.value.columns.map(column => column.key).join() === chosenColumns().map(column => column.key).join())

async function save() {
  const creating = !active.value
  saving.value = true
  if (!creating) status.value = '儲存中…'
  const share = await saveShare(props.kind, props.targetId, chosenColumns())
  saving.value = false
  if (!share) {
    status.value = ''
    showErrorMessage(creating ? '連結沒有建立，請稍後再試' : '沒有存到，請稍後再試')
    // 沒存到就回到連結上真正的那一份，畫面不說謊
    if (active.value) chosen.value = active.value.columns.map(column => column.key)
    return
  }
  status.value = creating ? '已建立連結，可以複製或傳送' : '已儲存'
  // 建好之後鍵盤使用者下一步就是複製：焦點直接移過去
  if (creating) nextTick(() => copyButton.value?.ref?.focus())
}

// 有連結之後改勾選就直接存；連點只送最後一次。一項都沒勾不存（連結至少要有一項內容）
let saveTimer: ReturnType<typeof setTimeout> | undefined
watch(chosen, () => {
  clearTimeout(saveTimer)
  if (!open.value || !active.value || unchanged.value) return
  if (!chosen.value.length) {
    status.value = '至少要分享一項，這次沒有存'
    return
  }
  saveTimer = setTimeout(() => void save(), 500)
})
onBeforeUnmount(() => clearTimeout(saveTimer))

function closeLink() {
  const target = active.value
  if (!target) return
  clearTimeout(saveTimer)
  open.value = false
  closing.value = target.token
  undoToast(`已關閉「${props.name}」的分享連結`, () => (closing.value = null), async () => {
    // 按了復原
    if (closing.value !== target.token) return
    const ok = await revokeShare(target.token)
    closing.value = null
    if (!ok) showErrorMessage('分享連結沒有關掉，請稍後再試')
  })
}
</script>

<template>
  <!-- 包一層：呼叫端的 class 才套得上；對話框本身 teleport 到 body，不佔這裡的版面 -->
  <span v-if="shares" class="shared-share">
    <el-button class="shared-share__button" aria-haspopup="dialog" @click="openDialog">{{ active ? '已分享' : '分享' }}</el-button>
    <el-dialog v-model="open" :title="`分享「${name}」`" width="min(480px, 92vw)" align-center>
      <p class="share-dialog__note">有連結的人不用登入就能看，內容會即時更新。</p>

      <!-- 連結列：建立前是「建立連結」，建立後同一列換成網址與複製，高度一樣，下面不會跳 -->
      <div class="share-dialog__link">
        <template v-if="active">
          <label class="visually-hidden" :for="inputId">分享連結</label>
          <el-input :id="inputId" :model-value="url" readonly class="share-dialog__input" />
          <el-button ref="copyButton" type="primary" @click="copyLink(url)">複製連結</el-button>
          <el-button v-if="canShare" @click="shareLink(name, url)">傳送…</el-button>
        </template>
        <el-button v-else type="primary" class="share-dialog__create" :loading="saving" :disabled="!chosen.length" @click="save">建立連結</el-button>
      </div>

      <div class="share-dialog__content-head">
        <p class="share-dialog__heading">要分享哪些內容？</p>
        <span class="share-dialog__status" role="status">{{ status }}</span>
      </div>
      <SharedColumnChecklist v-model="chosen" :columns="columns" label="要分享的內容" :sensitive-heading="sensitiveHeading" />
      <p class="share-dialog__hint">代號與名稱一定會分享。</p>

      <template #footer>
        <div class="share-dialog__footer">
          <el-button v-if="active" type="danger" link class="share-dialog__close-link" @click="closeLink">關閉連結</el-button>
          <span class="share-dialog__spacer" />
          <el-button @click="open = false">{{ active ? '完成' : '取消' }}</el-button>
        </div>
      </template>
    </el-dialog>
  </span>
</template>

<style scoped>
/* 跟工具列上其他按鈕同高（本站觸控下限 44px）；寬度固定：讀到「已分享」時字變長，不推動旁邊的按鈕 */
.shared-share__button {
  min-height: 44px;
  min-width: 5.5rem;
}

.share-dialog__note {
  margin: 0 0 16px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

/* 連結列：網址框吃剩下的寬度，按鈕放不下就換行（手機上「傳送…」會到下一行） */
.share-dialog__link {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 44px;
  margin-bottom: 20px;
}

.share-dialog__input {
  flex: 1 1 12rem;
}

.share-dialog__input :deep(.el-input__wrapper) {
  min-height: 44px;
}

.share-dialog__link :deep(.el-button) {
  min-height: 44px;
  margin: 0;
}

.share-dialog__create {
  flex: 1;
}

.share-dialog__content-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.share-dialog__heading {
  margin: 0;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.share-dialog__status {
  color: var(--el-text-color-regular);
}

.share-dialog__hint {
  margin: 8px 0 0;
  color: var(--el-text-color-regular);
}

.share-dialog__footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.share-dialog__footer :deep(.el-button) {
  min-height: 44px;
  margin: 0;
}

.share-dialog__spacer {
  flex: 1;
}
</style>
