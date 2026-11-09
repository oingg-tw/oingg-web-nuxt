<script setup lang="ts">
import { ArrowLeft, ArrowRight, Share } from '@element-plus/icons-vue'
import { SHARE_EXPIRY_DAYS, type Share as ShareLink, type ShareExpiryDays, type ShareKind } from '~/composables/share/useShares'

// 分享連結（2026-10-19，使用者：「做好以後設計分享持股或是 watchlist 的機制」，選了：有連結就能看、免登入；內容即時；
// 分享時自己勾欄位、部位大小預設不勾；先做觀察清單再做持股）。觀察清單與持股共用這一顆（負責元件，見 CLAUDE.md）。
// 一個對象只有一條連結。2026-10-20 重新設計對話框（使用者：「分享彈跳視窗也請再設計，確保 UIUX」）：
//   - 連結列固定在最上面：還沒建立時這一列是「建立連結」，建立後同一列換成網址＋複製，下面的內容不跳；
//   - 有連結之後改勾選就直接存（旁邊寫「已儲存」），不用再按「更新欄位」——舊版建立後有兩顆主色按鈕、底部三顆按鈕；
//   - 底部只剩「取消」，或建立後的「關閉連結」（文字按鈕）＋「完成」。
// 關閉比照全站「可復原不先確認」：先關對話框（不疊對話框），undoToast 10 秒後才送 DELETE，這 10 秒內連結還能用。
// 期限（2026-11-09，業務中台 48a1c34，資安盤點 H1、L9）：7／30／90 天，每次存都從那天重新算。
// 方案 C（2026-11-09，使用者從 https://claude.ai/artifact/3HRHxKQiKwRMe9MZpLrSdW 選的，A 嫌層次太雜）：第一頁只有連結和一列
// 「連結設定」摘要；期限、欄位（持股還有分享頁的標題）在第二頁，同一個對話框換頁、不疊。每個天數旁邊寫選了會到哪天，再選一次同一個＝延長
const props = defineProps<{
  kind: ShareKind
  // 清單 id；持股是帳戶 id，null ＝ 全部帳戶
  targetId: string | null
  // 對話框標題用，例如清單名
  name: string
  // 可以分享的欄。sensitive 的預設不勾、放在下半部（部位大小、只有自己看得到的備註）；revealsCost：勾了看的人能用公開股價推算出平均成本
  //（報酬率、未實現損益——業務中台擋不了，只能提醒）
  columns: { key: string; label: string; sensitive?: boolean; revealsCost?: boolean }[]
  sensitiveHeading: string
  // 持股的帳戶（全部帳戶的分享列出包含哪幾個）
  accounts?: { id: string; name: string }[]
}>()

// 讀到自己有哪些連結之後才出現：讀不到就分不出「分享」還是「已分享」（業務中台 還沒上線這支時也是這樣，上線後自動出現）。
// 還在問的時候畫一個同樣大小的骨架（2026-10-20，使用者：「不要閃動」）：原本空著，手機上工具列換行，按鈕一出現就多長一行、把下面的
// 持股卡片往下推（/holdings 375 寬量到 0.0089）。讀不到就不畫（同原本）
const { shares, ensureShares, shareOf, saveShare, revokeShare } = useShares()
const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const checking = ref(true)
onMounted(() => {
  // 登入還在還原時骨架留著：原本 hydration 時還沒有使用者，骨架先收、登入好了又畫一次（check-reload-flash 抓到的）
  watch([authResolved, currentUser], async ([resolved]) => {
    if (!resolved) return
    checking.value = !shares.value
    await ensureShares()
    checking.value = false
  }, { immediate: true })
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
const nameId = useId()
const nameHintId = useId()
const copyButton = ref<{ ref?: HTMLElement } | null>(null)
// 持股分享頁的標題「○○分享的持股」（使用者 2026-10-20：分享時自己填，預設帶帳號名稱）。帳號名稱常是本名，所以只當預設、由分享者
// 看過再決定；已經有連結就用連結上存的（沒填是空的）。上限 15 字＝清單名 20 字扣掉「分享的持股」（訪客存成觀察清單時當清單名）
const displayName = ref('')
const nameToSend = () => (props.kind === 'holdings' ? displayName.value.trim() || null : null)
const expiresInDays = ref<ShareExpiryDays>(30)
const page = ref<'main' | 'settings'>('main')
const backButton = ref<{ ref?: HTMLElement } | null>(null)
const settingsRow = ref<HTMLElement | null>(null)
const periodLabelId = useId()
// 換頁時焦點跟著走：進第二頁到「回到分享」，回第一頁到「連結設定」那一列
function openSettings() {
  page.value = 'settings'
  nextTick(() => backButton.value?.ref?.focus())
}
function backToMain() {
  page.value = 'main'
  nextTick(() => settingsRow.value?.focus())
}
// 這條連結是幾天的：每次存都從那天重新算，所以是到期日減最後一次儲存。對不上（2026-11-09 以前建、沒有期限）就是預設的 30 天
const periodOf = (share: ShareLink | null): ShareExpiryDays => {
  if (!share?.expiresAt) return 30
  const days = Math.round((Date.parse(share.expiresAt) - Date.parse(share.updatedAt)) / 86_400_000)
  return SHARE_EXPIRY_DAYS.find(item => item === days) ?? 30
}
const expiryDate = (iso: string) => new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
// 全部帳戶的分享：存的那一刻有哪些帳戶就固定是哪些（還沒建立就是現在的帳戶）。2026-11-09 以前建的連結沒有這欄，不寫
const includedAccounts = computed(() => {
  if (props.kind !== 'holdings' || props.targetId !== null || !props.accounts?.length) return null
  const ids = active.value ? active.value.portfolioIds : props.accounts.map(account => account.id)
  return ids ? props.accounts.filter(account => ids.includes(account.id)).map(account => account.name) : null
})
const costColumns = computed(() => props.columns.filter(column => column.revealsCost && chosen.value.includes(column.key)).map(column => column.label))
// 第一頁的摘要：期限＋幾項；預設不分享的（部位大小、備註）勾了才寫出來
const summary = computed(() => {
  const sensitive = props.columns.filter(column => column.sensitive && chosen.value.includes(column.key)).map(column => column.label)
  const content = `分享 ${chosen.value.length} 項${sensitive.length ? `，含${sensitive.join('、')}` : ''}`
  if (!active.value) return `${expiresInDays.value} 天內有效・${content}`
  return `${active.value.expiresAt ? `${periodOf(active.value)} 天有效（${expiryDate(active.value.expiresAt)} 到期）` : '目前不會過期'}・${content}`
})
// 選了會到哪一天：選了就從今天重新算
const periodDate = (days: number) => expiryDate(new Date(Date.now() + days * 86_400_000).toISOString())
// 再選一次同一個天數＝延長。換天數交給 v-model 和下面的 watch；這裡只看 radio 的 input 自己的 click（點文字時瀏覽器會再點一次 input，
// 文字那一下不算；鍵盤的空白鍵也是 input 的 click）。Element Plus 在 input 上 stopPropagation，所以在外層用捕獲階段看
function onPeriodClick(event: MouseEvent) {
  const input = event.target as HTMLInputElement
  if (input.tagName !== 'INPUT' || Number(input.value) !== expiresInDays.value || !active.value || saving.value) return
  void save()
}
// 系統分享選單只有部分瀏覽器有（手機），掛載後才知道，免得伺服器與瀏覽器畫的不一樣
const canShare = ref(false)
onMounted(() => (canShare.value = typeof navigator.share === 'function'))

function openDialog() {
  const stored = active.value?.columns.map(column => column.key)
  chosen.value = props.columns.filter(column => (stored ? stored.includes(column.key) : !column.sensitive)).map(column => column.key)
  // 切 15 字時不把 emoji 切成半個（LINE 暱稱常有）
  displayName.value = active.value ? (active.value.displayName ?? '') : (currentUser.value?.displayName ?? '').slice(0, 15).replace(/[\uD800-\uDBFF]$/, '')
  expiresInDays.value = periodOf(active.value)
  status.value = ''
  page.value = 'main'
  open.value = true
}

// 照畫面上的欄位順序存（觀察清單換了欄位順序，分享出去的也跟著換）
const chosenColumns = () => props.columns.filter(column => chosen.value.includes(column.key)).map(({ key, label }) => ({ key, label }))
const unchanged = computed(() => !!active.value
  && active.value.columns.map(column => column.key).join() === chosenColumns().map(column => column.key).join()
  && (active.value.displayName ?? null) === nameToSend()
  && periodOf(active.value) === expiresInDays.value)

async function save() {
  const creating = !active.value
  saving.value = true
  // 關閉的那 10 秒內又按「建立連結」（使用者 2026-10-20：「關閉分享以後再建立連結，就看不到連結了」）：一個對象只有一條連結，
  // 舊的還沒刪，PUT 會拿回同一個 token——畫面當它已關而不顯示，10 秒到了還把它刪掉。先真的關掉舊的，再建一條新網址：
  // 同一條網址復活的話，拿到舊網址的人又看得到了
  if (creating) await pendingClose?.()
  if (!creating) status.value = '儲存中…'
  const share = await saveShare(props.kind, props.targetId, chosenColumns(), nameToSend(), expiresInDays.value)
  saving.value = false
  if (!share) {
    status.value = ''
    showErrorMessage(creating ? '連結沒有建立，請稍後再試' : '沒有存到，請稍後再試')
    // 沒存到就回到連結上真正的那一份，畫面不說謊
    if (active.value) {
      chosen.value = active.value.columns.map(column => column.key)
      displayName.value = active.value.displayName ?? ''
      expiresInDays.value = periodOf(active.value)
    }
    return
  }
  status.value = creating ? '已建立連結，可以複製或傳送' : '已儲存'
  // 建好之後鍵盤使用者下一步就是複製：焦點直接移過去
  if (creating) nextTick(() => copyButton.value?.ref?.focus())
}

// 有連結之後改勾選、改標題、換期限就直接存；連點、連打只送最後一次。一項都沒勾不存（連結至少要有一項內容）
let saveTimer: ReturnType<typeof setTimeout> | undefined
watch([chosen, displayName, expiresInDays], () => {
  clearTimeout(saveTimer)
  if (!open.value || !active.value || unchanged.value) return
  if (!chosen.value.length) {
    status.value = '至少要分享一項，這次沒有存'
    return
  }
  saveTimer = setTimeout(() => void save(), 500)
})
onBeforeUnmount(() => clearTimeout(saveTimer))

// 真的送出 DELETE：提示收掉（逾時、Esc），或那 10 秒內又按了建立連結（save 會先收掉提示、等它刪完）。只送一次
let pendingClose: (() => Promise<void>) | null = null

function closeLink() {
  const target = active.value
  if (!target) return
  clearTimeout(saveTimer)
  open.value = false
  closing.value = target.token
  let sent: Promise<void> | null = null
  const commit = () => (sent ??= revokeShare(target.token).then((ok) => {
    closing.value = null
    if (!ok) showErrorMessage('分享連結沒有關掉，請稍後再試')
  }))
  const toast = undoToast(`已關閉「${props.name}」的分享連結`, () => (closing.value = null), () => {
    pendingClose = null
    // 按了復原就不送
    if (closing.value === target.token) void commit()
  })
  pendingClose = () => {
    pendingClose = null
    toast.close()
    return commit()
  }
}
</script>

<template>
  <!-- 包一層：呼叫端的 class 才套得上；對話框本身 teleport 到 body，不佔這裡的版面 -->
  <span v-if="!shares && checking" class="app-skeleton shared-share__skeleton" aria-hidden="true" />
  <span v-else-if="shares" class="shared-share">
    <!-- 分享的 icon（2026-10-23，使用者：「holdings 分享按鈕 加上 icon」；觀察清單同一顆） -->
    <el-button class="shared-share__button" :icon="Share" aria-haspopup="dialog" @click="openDialog">{{ active ? '已分享' : '分享' }}</el-button>
    <el-dialog v-model="open" width="min(480px, 92vw)">
      <template #header="{ titleId, titleClass }">
        <div class="share-dialog__header">
          <el-button v-if="page === 'settings'" ref="backButton" link :icon="ArrowLeft" aria-label="回到分享" class="share-dialog__back" @click="backToMain" />
          <h2 :id="titleId" :class="titleClass">{{ page === 'settings' ? '連結設定' : `分享「${name}」` }}</h2>
        </div>
      </template>

      <template v-if="page === 'main'">
        <p class="share-dialog__note">有連結的人不用登入就能看。</p>
        <!-- 連結列：建立前是「建立連結」，建立後同一列換成網址與複製，高度一樣，下面的「連結設定」不跳 -->
        <div class="share-dialog__link">
          <template v-if="active">
            <label class="visually-hidden" :for="inputId">分享連結</label>
            <el-input :id="inputId" :model-value="url" readonly class="share-dialog__input" />
            <el-button ref="copyButton" type="primary" @click="copyLink(url)">複製連結</el-button>
            <el-button v-if="canShare" @click="shareLink(name, url)">傳送…</el-button>
          </template>
          <el-button v-else type="primary" class="share-dialog__create" :loading="saving" :disabled="!chosen.length" @click="save">建立連結</el-button>
        </div>
        <button ref="settingsRow" type="button" class="app-card share-dialog__settings" @click="openSettings">
          <span class="share-dialog__settings-text">
            <span class="share-dialog__settings-title">連結設定</span>
            <span class="share-dialog__settings-summary">{{ summary }}</span>
          </span>
          <el-icon aria-hidden="true"><ArrowRight /></el-icon>
        </button>
      </template>

      <template v-else>
        <!-- 持股：名字接在「分享的持股」前面，看得到標題整句長怎樣 -->
        <div v-if="kind === 'holdings'" class="share-dialog__name">
          <label :for="nameId">分享頁的標題</label>
          <el-input :id="nameId" v-model="displayName" maxlength="15" :aria-describedby="nameHintId">
            <template #append>分享的持股</template>
          </el-input>
          <p :id="nameHintId" class="share-dialog__hint">預設是你的帳號名稱，有連結的人都看得到；留空就只寫「分享的持股」。</p>
        </div>
        <h3 :id="periodLabelId" class="share-dialog__heading">有效期限</h3>
        <el-radio-group v-model="expiresInDays" class="share-dialog__periods" :aria-labelledby="periodLabelId" @click.capture="onPeriodClick">
          <el-radio v-for="days in SHARE_EXPIRY_DAYS" :key="days" :value="days" class="share-dialog__period">
            <span class="share-dialog__period-days">{{ days }} 天</span><span class="share-dialog__period-date">到 {{ periodDate(days) }}</span>
          </el-radio>
        </el-radio-group>
        <p class="share-dialog__hint">選了就從今天重新算，也就是延長；到期後連結就打不開。</p>
        <h3 class="share-dialog__heading share-dialog__content-heading">分享內容</h3>
        <!-- 建立前列現在的帳戶，建立後列連結存著的 -->
        <p v-if="includedAccounts" class="share-dialog__hint share-dialog__accounts">包含的帳戶：{{ includedAccounts.join('、') }}。之後新增的帳戶，要再儲存一次才會加入。</p>
        <SharedColumnChecklist v-model="chosen" :columns="columns" label="要分享的內容" :sensitive-heading="sensitiveHeading" />
        <p class="share-dialog__hint">代號與名稱一定會分享；內容有變動時，分享頁最多晚 10 分鐘更新。</p>
        <p v-if="costColumns.length" class="share-dialog__hint share-dialog__cost">勾了{{ costColumns.join('、') }}，看的人可以用公開的股價推算出你的平均成本。</p>
      </template>

      <template #footer>
        <div class="share-dialog__footer">
          <el-button v-if="page === 'main' && active" type="danger" link class="share-dialog__close-link" @click="closeLink">關閉連結</el-button>
          <span class="share-dialog__status" role="status">{{ status }}</span>
          <el-button v-if="page === 'settings'" @click="backToMain">完成</el-button>
          <el-button v-else @click="open = false">{{ active ? '完成' : '取消' }}</el-button>
        </div>
      </template>
    </el-dialog>
  </span>
</template>

<style scoped>
/* 跟工具列上其他按鈕同高（本站觸控下限 44px）；寬度固定：讀到「已分享」時字變長，不推動旁邊的按鈕。6.5rem 放得下 icon＋「已分享」 */
.shared-share__button {
  min-height: 44px;
  min-width: 6.5rem;
}

/* 跟上面的按鈕一樣大 */
.shared-share__skeleton {
  display: inline-block;
  width: 6.5rem;
  height: 44px;
  vertical-align: middle;
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

.share-dialog__header {
  display: flex;
  align-items: center;
  gap: 4px;
}

.share-dialog__header h2 {
  margin: 0;
}

/* 返回鍵：觸控 44px，左邊對齊對話框的內容（往外推 12px，箭頭跟下面的字對齊） */
.share-dialog__back {
  width: 44px;
  min-height: 44px;
  margin: -10px 0 -10px -12px;
  font-size: 1.125rem;
}

/* 「連結設定」那一列：整列是一顆按鈕，樣子是全站卡片（.app-card），這裡只管版面 */
.share-dialog__settings {
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
  min-height: 64px;
  padding: 12px 16px;
  color: var(--el-text-color-regular);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.share-dialog__settings:hover {
  border-color: var(--el-color-primary);
}

.share-dialog__settings-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.share-dialog__settings-title {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.share-dialog__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* 天數一列一個，旁邊寫選了會到哪天 */
.share-dialog__periods {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin-top: 4px;
}

.share-dialog__period {
  height: 48px;
  margin-right: 0;
  border-bottom: 1px solid var(--app-divider);
}

.share-dialog__period-days {
  display: inline-block;
  width: 4rem;
  color: var(--el-text-color-primary);
}

.share-dialog__period-date {
  color: var(--el-text-color-regular);
}

.share-dialog__content-heading {
  margin-top: 24px;
}

.share-dialog__hint.share-dialog__accounts {
  margin: 4px 0 0;
}

.share-dialog__hint.share-dialog__cost {
  color: var(--el-text-color-primary);
}

.share-dialog__status {
  flex: 1;
  color: var(--el-text-color-regular);
  text-align: right;
}

.share-dialog__hint {
  margin: 8px 0 0;
  color: var(--el-text-color-regular);
}

.share-dialog__name {
  margin: 8px 0 16px;
}

.share-dialog__name label {
  display: block;
  margin-bottom: 4px;
}

.share-dialog__name :deep(.el-input__wrapper) {
  min-height: 44px;
}

/* 「分享的持股」是標題的一部分：一般文字色（Element 附加格的 info 灰對比不到 4.5:1，axe 量到） */
.share-dialog__name :deep(.el-input-group__append) {
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
</style>
