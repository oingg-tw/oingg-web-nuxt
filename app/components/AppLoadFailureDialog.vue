<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'

// 全站唯一的讀取失敗彈窗（2026-10-08）。使用者的兩個要求：
//   - 「全域統一彈窗 Loader 阻斷瀏覽，而非個別畫面各自出現訊息」→ 點外面、Esc 都關不掉，沒有 ×；全站只有這一個，
//     好幾份資料同時讀不到也只開一個，全部重讀成功才關
//   - 「告訴用戶我們可能發生甚麼事情，或是有可能網路問題，要多久，是否正在重新連線」→ 依原因換說法、照實寫
//     「已持續多久」與下一次重試的倒數。**不寫預估要多久**：我們不知道，寫了就是編的
// 出口：一直有「立即重試」；超過 5 分鐘、或錯誤是 4xx（重試多半沒用）時多一個「回首頁」，不讓人被困住。
//
// 狀態與回報方式在 composables/useLoadFailure.ts；錯誤分類在 utils/api-fetch.ts。

const { failures, startedAt } = useLoadFailureState()
const visible = computed(() => failures.value.length > 0)

// 描述哪一個原因：網路斷線最優先（那時其他錯誤多半也是它造成的），其次是重試沒用的 4xx
const PRIORITY: LoadFailureKind[] = ['offline', 'client', 'server', 'unavailable', 'timeout']
const primary = computed(() => [...failures.value].sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))[0] ?? null)
const autoRetry = computed(() => failures.value.some(entry => entry.kind !== 'client' && entry.kind !== 'offline'))

const MESSAGES: Record<LoadFailureKind, string> = {
  offline: '你的裝置目前沒有網路連線。連上之後會自動繼續，不用重新整理。',
  timeout: '伺服器這次回應得太慢，可能正在處理大量資料。',
  unavailable: '暫時連不上我們的伺服器，可能正在更新或短暫故障。',
  server: '伺服器處理這份資料時發生錯誤。',
  client: '這份資料的請求沒有被接受。'
}

// 重試間隔：5、10、20、30 秒，之後都 30 秒；bff 給了 Retry-After 就照它
const BACKOFF_SECONDS = [5, 10, 20, 30]
const GIVE_EXIT_AFTER_MS = 5 * 60_000
const attempt = ref(0)
const retrying = ref(false)
const nextRetryAt = ref<number | null>(null)
const now = ref(Date.now())
let timer: ReturnType<typeof setTimeout> | undefined
let ticker: ReturnType<typeof setInterval> | undefined

function schedule() {
  clearTimeout(timer)
  nextRetryAt.value = null
  if (!visible.value || !autoRetry.value) return
  const hinted = Math.max(0, ...failures.value.map(entry => entry.retryAfter ?? 0))
  const seconds = hinted || BACKOFF_SECONDS[Math.min(attempt.value, BACKOFF_SECONDS.length - 1)]!
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
  schedule()
}

function onOnline() {
  if (visible.value) retryNow()
}

watch(visible, (open) => {
  clearTimeout(timer)
  clearInterval(ticker)
  if (!open) {
    attempt.value = 0
    nextRetryAt.value = null
    return
  }
  now.value = Date.now()
  ticker = setInterval(() => (now.value = Date.now()), 1000)
  schedule()
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

const showExit = computed(() => elapsedMs.value >= GIVE_EXIT_AFTER_MS || (!autoRetry.value && primary.value?.kind === 'client'))

const retryButton = ref<{ ref?: HTMLElement }>()
function focusRetry() {
  retryButton.value?.ref?.focus()
}

function goHome() {
  navigateTo('/')
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    class="load-failure"
    width="min(440px, calc(100vw - 32px))"
    align-center
    append-to-body
    :show-close="false"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    aria-describedby="load-failure-message"
    @opened="focusRetry"
  >
    <template #header>
      <h2 class="load-failure__title">資料暫時讀不到</h2>
    </template>
    <p id="load-failure-message" class="load-failure__message">
      {{ primary ? MESSAGES[primary.kind] : '' }}<template v-if="primary?.kind === 'client' && primary.status">（錯誤 {{ primary.status }}）</template>
    </p>
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
      <el-button ref="retryButton" type="primary" :loading="retrying" @click="retryNow">立即重試</el-button>
    </template>
  </el-dialog>
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
</style>
