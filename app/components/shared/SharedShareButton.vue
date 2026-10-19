<script setup lang="ts">
import type { ShareKind } from '~/composables/share/useShares'

// 分享連結（2026-10-19，使用者：「做好以後設計分享持股或是 watchlist 的機制」，選了：有連結就能看、免登入；內容即時；
// 分享時自己勾欄位、部位大小預設不勾；先做觀察清單再做持股）。觀察清單與持股共用這一顆（負責元件，見 CLAUDE.md）。
// 一個對象只有一條連結：還沒分享時「建立連結」；分享了之後同一個對話框可以複製、傳送、更新欄位、關閉連結。
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
  const share = await saveShare(props.kind, props.targetId, chosenColumns())
  saving.value = false
  if (!share) {
    showErrorMessage(creating ? '連結沒有建立，請稍後再試' : '欄位沒有更新，請稍後再試')
    return
  }
  status.value = creating ? '已建立連結，可以複製或傳送' : '已更新一起顯示的欄位'
  // 建好之後鍵盤使用者下一步就是複製：焦點直接移過去
  if (creating) nextTick(() => copyButton.value?.ref?.focus())
}

function closeLink() {
  const target = active.value
  if (!target) return
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
      <p class="share-dialog__note">拿到連結的人不用登入就能看，之後的變動也會跟著更新；隨時可以關掉連結。</p>
      <div v-if="active" class="share-dialog__link">
        <label class="share-dialog__label" :for="inputId">分享連結</label>
        <el-input :id="inputId" :model-value="url" readonly class="share-dialog__input" />
        <div class="share-dialog__actions">
          <el-button ref="copyButton" type="primary" @click="copyLink(url)">複製連結</el-button>
          <el-button v-if="canShare" @click="shareLink(name, url)">傳送…</el-button>
        </div>
      </div>
      <p class="share-dialog__heading">一起分享的內容（代號與名稱一定會有）</p>
      <SharedColumnChecklist v-model="chosen" :columns="columns" label="一起分享的內容" :sensitive-heading="sensitiveHeading" />
      <p class="visually-hidden" role="status">{{ status }}</p>
      <template #footer>
        <div class="share-dialog__footer">
          <el-button v-if="active" type="danger" plain @click="closeLink">關閉連結</el-button>
          <span class="share-dialog__spacer" />
          <el-button @click="open = false">{{ active ? '完成' : '取消' }}</el-button>
          <el-button v-if="active" type="primary" :loading="saving" :disabled="unchanged || !chosen.length" @click="save">更新欄位</el-button>
          <el-button v-else type="primary" :loading="saving" :disabled="!chosen.length" @click="save">建立連結</el-button>
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
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.share-dialog__link {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.share-dialog__label,
.share-dialog__heading {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.share-dialog__heading {
  margin: 0 0 4px;
}

.share-dialog__input :deep(.el-input__wrapper) {
  min-height: 44px;
}

.share-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.share-dialog__actions :deep(.el-button),
.share-dialog__footer :deep(.el-button) {
  min-height: 44px;
  margin: 0;
}

/* 關閉連結在左，其餘在右 */
.share-dialog__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.share-dialog__spacer {
  flex: 1;
}
</style>
