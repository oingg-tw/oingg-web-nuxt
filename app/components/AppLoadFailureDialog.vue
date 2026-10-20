<script setup lang="ts">
import { Close, Loading } from '@element-plus/icons-vue'

// 全站唯一的讀取失敗提示（2026-10-08）。使用者的兩個要求：
//   - 「全域統一彈窗 Loader 阻斷瀏覽，而非個別畫面各自出現訊息」→ 點外面、Esc 都關不掉，沒有 ×；全站只有這一個，
//     好幾份資料同時讀不到也只開一個，全部重讀成功才關
//   - 「告訴用戶我們可能發生甚麼事情，或是有可能網路問題，要多久，是否正在重新連線」→ 依原因換說法、照實寫
//     「已持續多久」與下一次重試的倒數。**不寫預估要多久**：我們不知道，寫了就是編的
// 2026-10-11 使用者：「太容易跳出來了，而且也不會自關掉」→
//   - 寬限期：失敗撐過 LOAD_FAILURE_GRACE_MS（期間 useLoadFailure 默默重試兩次）才顯示；斷線立即顯示
//   - 主要資料（scope page）開阻斷彈窗；只有次要資料（section）讀不到時，右下角出非阻斷提示，頁面照常可用
//   - 「先關閉」：背景照樣重試；同一批失敗不再彈出，新的主要資料失敗才再開；全部恢復就自己關
//   - 排程改成 immediate watch：首次載入的失敗早於這個元件掛上，原本的 watch(visible) 不觸發，沒有倒數也不自動重試
// 出口：一直有「立即重試」與「先關閉」；超過 5 分鐘多一個「回首頁」。
//
// 狀態與回報方式在 composables/useLoadFailure.ts；錯誤分類在 utils/api-fetch.ts。

const { failures, startedAt } = useLoadFailureState()
const hasFailures = computed(() => failures.value.length > 0)

const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | undefined
// 寬限期要靠時間推進才會「成熟」，所以有失敗就一直走秒
watch(hasFailures, (any) => {
  clearInterval(ticker)
  if (!any) return
  now.value = Date.now()
  ticker = setInterval(() => (now.value = Date.now()), 1000)
}, { immediate: true })

const matured = computed(() => failures.value.filter(entry => entry.kind === 'offline' || now.value - entry.since >= LOAD_FAILURE_GRACE_MS))
// 「先關閉」時正在顯示的鍵；鍵恢復後拿掉，之後再失敗會重新顯示
const dismissed = ref(new Set<string>())
const shown = computed(() => matured.value.filter(entry => !dismissed.value.has(entry.key)))
const blocking = computed(() => shown.value.filter(entry => entry.scope === 'page'))
const dialogVisible = computed(() => blocking.value.length > 0)
const noticeVisible = computed(() => !dialogVisible.value && shown.value.length > 0)

// 描述哪一個原因：網路斷線最優先（那時其他錯誤多半也是它造成的）
const PRIORITY: LoadFailureKind[] = ['offline', 'server', 'busy', 'unavailable', 'timeout', 'client']
const primary = computed(() => [...blocking.value].sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))[0] ?? null)
const autoRetry = computed(() => matured.value.some(entry => entry.kind !== 'offline'))

const MESSAGES: Record<LoadFailureKind, string> = {
  offline: '你的裝置目前沒有網路連線。連上之後會自動繼續，不用重新整理。',
  timeout: '伺服器這次回應得太慢，可能正在處理大量資料。',
  unavailable: '暫時連不上我們的伺服器，可能正在更新或短暫故障。',
  busy: '伺服器目前忙碌，正在處理大量請求，稍後會自動再試。',
  server: '伺服器處理這份資料時發生錯誤。',
  client: '這份資料的請求沒有被接受。'
}

// 寬限期之後的重試間隔：5、10、20、40 秒，之後都 60 秒（上游 502 期間一個分頁 4 分鐘打了約 150 次）。
// 業務中台給的 Retry-After 是下限。關掉彈窗或提示後照樣在背景跑。
const BACKOFF_SECONDS = [5, 10, 20, 40, 60]
const GIVE_EXIT_AFTER_MS = 5 * 60_000
const attempt = ref(0)
const retrying = ref(false)
const nextRetryAt = ref<number | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

function schedule() {
  clearTimeout(timer)
  nextRetryAt.value = null
  if (!autoRetry.value) return
  const hinted = Math.max(0, ...matured.value.map(entry => entry.retryAfter ?? 0))
  const seconds = Math.max(hinted, BACKOFF_SECONDS[Math.min(attempt.value, BACKOFF_SECONDS.length - 1)]!)
  nextRetryAt.value = Date.now() + seconds * 1000
  timer = setTimeout(retryNow, seconds * 1000)
}

async function retryNow() {
  if (retrying.value) return
  clearTimeout(timer)
  nextRetryAt.value = null
  retrying.value = true
  attempt.value += 1
  await retryLoadFailures()
  retrying.value = false
  await nextTick()
  if (matured.value.length) schedule()
}

function onOnline() {
  if (hasFailures.value) retryNow()
}

const anyMatured = computed(() => matured.value.length > 0)
watch(anyMatured, (any) => {
  if (any) {
    if (!retrying.value) schedule()
    return
  }
  clearTimeout(timer)
  nextRetryAt.value = null
}, { immediate: true })

// 期間才出現可自動重試的失敗（原本只有斷線、沒有倒數）也要開始倒數
watch(autoRetry, (canRetry) => {
  if (canRetry && anyMatured.value && nextRetryAt.value === null && !retrying.value) schedule()
})

watch(() => failures.value.map(entry => entry.key), (keys) => {
  if (!keys.length) attempt.value = 0
  if ([...dismissed.value].some(key => !keys.includes(key))) dismissed.value = new Set([...dismissed.value].filter(key => keys.includes(key)))
})

onMounted(() => window.addEventListener('online', onOnline))
onBeforeUnmount(() => {
  window.removeEventListener('online', onOnline)
  clearTimeout(timer)
  clearInterval(ticker)
})

const elapsedMs = computed(() => (startedAt.value === null ? 0 : Math.max(0, now.value - startedAt.value)))
const elapsedText = computed(() => {
  const seconds = Math.floor(elapsedMs.value / 1000)
  return seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
})

const statusText = computed(() => {
  if (retrying.value) return '正在重新連線…'
  if (primary.value?.kind === 'offline') return '等待網路恢復，連上後會自動重新連線。'
  if (nextRetryAt.value !== null) {
    const seconds = Math.max(0, Math.ceil((nextRetryAt.value - now.value) / 1000))
    return `第 ${attempt.value + 1} 次自動重新連線：${seconds} 秒後`
  }
  return '可以按「立即重試」再試一次。'
})

const showExit = computed(() => elapsedMs.value >= GIVE_EXIT_AFTER_MS)

function dismiss() {
  dismissed.value = new Set([...dismissed.value, ...shown.value.map(entry => entry.key)])
}

const retryButton = ref<{ ref?: HTMLElement }>()
function focusRetry() {
  retryButton.value?.ref?.focus()
}

function goHome() {
  navigateTo('/')
}
</script>

<template>
  <!-- ClientOnly：這個彈窗只會在瀏覽器裡打開。SSR 若也渲染它，app.vue 就有兩個關閉中的 el-dialog，Element Plus 的
       z-index 計數在伺服器與瀏覽器對不上（2026-10-08 實測：每一頁都多一個 Hydration style mismatch 警告） -->
  <ClientOnly>
  <el-dialog
    :model-value="dialogVisible"
    class="load-failure"
    width="min(440px, calc(100vw - 32px))"
    append-to-body
    :show-close="false"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    aria-describedby="load-failure-message"
    @opened="focusRetry"
  >
    <!-- titleId：el-dialog 的 aria-labelledby 指向它；自訂標題沒接上時對話框沒有名稱（axe aria-dialog-name，2026-10-11 量到） -->
    <template #header="{ titleId }">
      <h2 :id="titleId" class="load-failure__title">資料暫時讀不到</h2>
    </template>
    <p id="load-failure-message" class="load-failure__message">{{ primary ? MESSAGES[primary.kind] : '' }}</p>
    <!-- 倒數每秒變一次，刻意不放 live region：螢幕閱讀器會每秒念一次 -->
    <p class="load-failure__status">
      <el-icon v-if="retrying" class="is-loading" aria-hidden="true"><Loading /></el-icon>
      {{ statusText }}
    </p>
    <p class="load-failure__meta">
      已持續 {{ elapsedText }}<template v-if="primary?.requestId">・參考編號 {{ primary.requestId }}</template>
    </p>
    <template #footer>
      <el-button v-if="showExit" @click="goHome">回首頁</el-button>
      <el-button @click="dismiss">先關閉</el-button>
      <el-button ref="retryButton" type="primary" :loading="retrying" @click="retryNow">立即重試</el-button>
    </template>
  </el-dialog>
  <!-- 次要資料讀不到：右下角、不擋頁面。role="status" 在出現時念一次；倒數不放進來（會每秒念） -->
  <div v-if="noticeVisible" class="load-failure-notice" role="status">
    <p class="load-failure-notice__text">部分資料暫時讀不到，正在自動重試。</p>
    <el-button :loading="retrying" @click="retryNow">立即重試</el-button>
    <button type="button" class="load-failure-notice__close" aria-label="關閉讀取失敗提示" @click="dismiss">
      <el-icon aria-hidden="true"><Close /></el-icon>
    </button>
  </div>
  </ClientOnly>
</template>

<style scoped>
.load-failure__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.load-failure__message {
  margin: 0 0 12px;
  line-height: 1.7;
}

.load-failure__status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 4px;
  font-variant-numeric: tabular-nums;
}

.load-failure__meta {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.load-failure-notice {
  position: fixed;
  right: 16px;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100vw - 32px);
  padding: 8px 4px 8px 16px;
  border: 1px solid var(--el-border-color);
  border-left: 4px solid var(--el-color-warning);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
  box-shadow: var(--el-box-shadow-light);
}

.load-failure-notice__text {
  margin: 0;
  line-height: 1.5;
}

.load-failure-notice__close {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--el-text-color-regular);
  cursor: pointer;
}

.load-failure-notice__close:hover {
  background: var(--el-fill-color-light);
}
</style>
