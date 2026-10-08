<script setup lang="ts">
// 現金循環的互動時間軸（2026-09-26「cash-cycle 我希望也比照 dividend-source 做成互動式教學」）。
//
// **視覺刻意不照抄瀑布圖。** StockDividendSegmentLine 的模型是「父項切出一刀、剩下的繼續切」，那對損益
// 表是對的——每一刀之後真的只剩下更少的錢。但現金循環不是層層下切，它是兩條同時在跑的時間軸：
//
//     貨進來 ────── 存貨 72.6 天 ──────┬── 收現 26.5 天 ──┐ 收到客戶的錢
//     貨進來 ─ 付現 21.0 天 ─┬─────── 現金轉換循環 78.0 天 ─┘
//                          └ 付錢給供應商
//
// 把下面那條疊在上面那條底下，`現金轉換循環 = 營運週期 − 付現天數` 就從一個要背的公式變成看得見的
// 事實：兩條軌道的起點相同，下面那條先結束的地方就是你付錢的時刻，剩下那段才是你自己的錢被綁住的
// 日子。瀑布圖畫不出這個「同時進行」的關係，它只能畫先後。
//
// **負數也因此自然成立**，不需要特例：長榮的付現 57.5 天比整趟營運週期 38.0 天還長，下面那條就比上面
// 那條長出去，多出來的 19.4 天畫在營運週期結束之後——那正是「生意都做完了、貨款還沒付出去」的意思。
// 這是先量過才決定的：抽樣 11 家可畫的公司裡就有 1 家是負的，不是邊緣案例。
//
// 動畫沿用本 repo 的約定：**CSS class 切換，不用 <Transition>**。原因是 SEO——scripts/check-click-depth.mjs
// 用 regex 讀原始 HTML、不跑瀏覽器，被 <Transition> 包住而尚未進場的內容在 SSR 裡不存在。所有元素永遠
// 在 DOM 裡，只切 class。

const props = defineProps<{
  inventoryDays: number | null
  receivablesDays: number | null
  payablesDays: number | null
  operatingCycle: number | null
  cashCycle: number | null
  periodLabel: string | null
}>()

const usable = computed(() =>
  props.inventoryDays !== null && props.receivablesDays !== null
  && props.payablesDays !== null && props.operatingCycle !== null && props.cashCycle !== null)

const inv = computed(() => props.inventoryDays ?? 0)
const rec = computed(() => props.receivablesDays ?? 0)
const pay = computed(() => props.payablesDays ?? 0)
const cycle = computed(() => props.operatingCycle ?? 0)
const cash = computed(() => props.cashCycle ?? 0)

// 兩條軌道共用同一個比例尺，否則「下面比上面長」這件事會被各自縮放抹掉——而那正是負數要表達的東西。
const span = computed(() => Math.max(cycle.value, pay.value, 1))
const pct = (value: number): string => `${Math.max((value / span.value) * 100, 0)}%`

// 下軌第一段的長度。兩段相加永遠等於 max(付現, 營運週期)，所以下軌的總長是真的而不是把兩個數字接起來。
//
// 這裡原本寫成「付現 + |CCC|」，正值時剛好對（21.0 + 78.0 = 99.0 = 營運週期），負值時就變成
// 57.5 + 19.4 = 76.9——那個數字不對應任何東西。負值的真相是：到第 38 天生意就做完收到錢了，但要到
// 第 57.5 天才付給供應商，所以那 19.4 天是「已經收到錢、還沒付出去」，它在付現那條線的**裡面**。
const headDays = computed(() => Math.min(pay.value, cycle.value))

const days = (value: number | null): string => (value === null ? '－' : `${value.toFixed(1)} 天`)

interface Step { title: string; explain: string }
const steps = computed<Step[]>(() => {
  if (!usable.value) return []
  return [
    {
      title: '第一步：貨進來，先放著',
      explain: `進了貨之後，平均要放 ${days(props.inventoryDays)}才賣得出去。這段時間錢已經變成倉庫裡的存貨，不能拿去做別的事。`
    },
    {
      title: '第二步：賣掉了，但錢還沒進來',
      explain: `賣出去之後還要再等 ${days(props.receivablesDays)}才收到客戶的錢。加上前面放貨的時間，一趟總共 ${days(props.operatingCycle)}——這就是營運週期。`
    },
    {
      title: '第三步：其實你沒有一開始就付錢',
      explain: cash.value < 0
        ? `進貨時供應商讓你晚 ${days(props.payablesDays)}再付，比整趟 ${days(props.operatingCycle)}還長。所以這門生意不用自己墊錢，還多出 ${days(Math.abs(cash.value))}的貨款可以先拿去用。`
        : `進貨時供應商讓你晚 ${days(props.payablesDays)}再付款，那幾天的資金是供應商墊的。整趟扣掉那幾天，剩下 ${days(props.cashCycle)}才是你自己要掏錢出來的日子——這就是現金轉換循環。`
    }
  ]
})

const index = ref(0)
// SSR 先渲染「三步的說明全部列出」的版本，掛載後才換成互動版。爬蟲與無 JS 的讀者拿到完整內容。
const interactive = ref(false)
onMounted(() => { interactive.value = true })

const step = computed(() => steps.value[index.value] ?? null)
const atStart = computed(() => index.value === 0)
const atEnd = computed(() => index.value >= steps.value.length - 1)
// 互動模式下才逐步揭露；SSR 版一次全給，否則爬蟲只看得到第一步的圖。
const shown = computed(() => (interactive.value ? index.value : steps.value.length - 1))

// 連點鎖，跟 StockDividendSegmentLine 同一個做法與同一個理由：飛行中改 index 會讓還在跑的 transition
// 目標被換掉。長度從 CSS 變數算出來而不是在 JS 裡另寫一份，prefers-reduced-motion 時歸零不鎖。
const rootEl = ref<HTMLElement | null>(null)
const busy = ref(false)
let unlockTimer: ReturnType<typeof setTimeout> | null = null

function lock() {
  const el = rootEl.value
  if (!el || typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const ms = (Number.parseFloat(getComputedStyle(el).getPropertyValue('--grow')) || 0) * 1000
  if (ms <= 0) return
  busy.value = true
  if (unlockTimer) clearTimeout(unlockTimer)
  unlockTimer = setTimeout(() => { busy.value = false }, ms)
}

onBeforeUnmount(() => { if (unlockTimer) clearTimeout(unlockTimer) })

function goPrev() { if (busy.value || atStart.value) return; index.value -= 1; lock() }
function goNext() { if (busy.value || atEnd.value) return; index.value += 1; lock() }

const chartLabel = computed(() => {
  if (!usable.value) return ''
  if (shown.value === 0) return `存貨週轉天數 ${days(props.inventoryDays)}`
  if (shown.value === 1) return `存貨週轉天數 ${days(props.inventoryDays)} 加應收帳款收現天數 ${days(props.receivablesDays)}，營運週期 ${days(props.operatingCycle)}`
  return `營運週期 ${days(props.operatingCycle)} 減應付帳款付現天數 ${days(props.payablesDays)}，現金轉換循環 ${days(props.cashCycle)}`
})
</script>

<template>
  <div v-if="usable" ref="rootEl" class="cctl" :class="`cctl--step${shown}`">
    <p class="cctl__title">{{ interactive ? step?.title : `${periodLabel ?? ''} 的錢，從進貨到收回來怎麼走` }}</p>

    <!-- clip 不用 hidden：hidden 會讓這裡變成捲動容器，那是 axe 的 scrollable-region-focusable 會走的
         路徑，而這個圖只靠按鈕前進、不該有 tabindex。 -->
    <div class="cctl__viewport" role="img" :aria-label="chartLabel">
      <!-- 上軌：這門生意本身的節奏 -->
      <div class="cctl__track">
        <div class="cctl__seg cctl__seg--inv" :style="{ '--w': pct(inv) }">
          <span class="cctl__seg-name">存貨</span>
          <span class="cctl__seg-days">{{ inv.toFixed(1) }}</span>
        </div>
        <div class="cctl__seg cctl__seg--rec" :style="{ '--w': pct(rec) }">
          <span class="cctl__seg-name">收現</span>
          <span class="cctl__seg-days">{{ rec.toFixed(1) }}</span>
        </div>
      </div>
      <p class="cctl__track-label cctl__track-label--top">營運週期 {{ cycle.toFixed(1) }} 天</p>

      <!-- 下軌：錢實際上什麼時候離開公司。起點跟上軌對齊，這個對齊就是整張圖的重點。 -->
      <div class="cctl__track cctl__track--pay">
        <div class="cctl__seg cctl__seg--pay" :style="{ '--w': pct(headDays) }">
          <span class="cctl__seg-name">{{ cash < 0 ? '收款前' : '付現' }}</span>
          <span class="cctl__seg-days">{{ headDays.toFixed(1) }}</span>
        </div>
        <div class="cctl__seg cctl__seg--cash" :class="{ 'is-negative': cash < 0 }" :style="{ '--w': pct(Math.abs(cash)) }">
          <span class="cctl__seg-name">{{ cash < 0 ? '還沒付' : '自己墊' }}</span>
          <span class="cctl__seg-days">{{ cash.toFixed(1) }}</span>
        </div>
      </div>
      <p class="cctl__track-label cctl__track-label--pay">現金轉換循環 {{ cash.toFixed(1) }} 天</p>
    </div>

    <div v-if="interactive" class="cctl__note">
      <p class="cctl__explain" aria-live="polite">{{ step?.explain }}</p>
    </div>
    <div v-else class="cctl__note">
      <p v-for="item in steps" :key="item.title" class="cctl__explain">
        <strong>{{ item.title }}</strong>：{{ item.explain }}
      </p>
    </div>

    <div v-if="interactive" class="cctl__controls">
      <el-button :disabled="atStart" @click="goPrev">上一步</el-button>
      <p class="cctl__progress">{{ periodLabel ? `${periodLabel} · ` : '' }}第 {{ index + 1 }} 步，共 {{ steps.length }} 步</p>
      <el-button type="primary" :disabled="atEnd" @click="goNext">下一步</el-button>
    </div>
  </div>
</template>

<style scoped>
.cctl {
  /* 一拍就好。瀑布圖需要三拍是因為它要把三欄甩過大半個版面；這裡的段落只是從零長出來，沒有長距離
     位移，多拍反而拖慢。 */
  --grow: 0.45s;
  --ease: cubic-bezier(0.33, 0, 0.67, 1);
  --row: 44px;

  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cctl__title {
  margin: 0;
  font-weight: 700;
  font-size: 1.125rem;
}

.cctl__viewport {
  /* 高度固定，不隨步驟變（「不應該不斷變更高度導致畫面UI彈跳」2026-09-25）。三步裡最高的那一步
     就是全部，所以一開始就撐好。 */
  overflow: clip;
  padding: 4px 0;
}

.cctl__track {
  display: flex;
  height: var(--row);
}

.cctl__track--pay {
  margin-top: 8px;
}

.cctl__seg {
  width: var(--w);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  overflow: clip;
  white-space: nowrap;
  border-radius: 6px;
  transition: width var(--grow) var(--ease), opacity var(--grow) var(--ease);
}

.cctl__seg-name {
  font-size: 1rem;
  line-height: 1.2;
}

.cctl__seg-days {
  font-size: 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.cctl__seg--inv {
  background: var(--el-color-primary);
  color: var(--app-on-primary);
}

/* dark-2 不是 light-3：淺色模式白字壓在 light-3 上只有 2.0:1（2026-10-08） */
.cctl__seg--rec {
  background: var(--el-color-primary-dark-2);
  color: var(--app-on-primary);
  margin-left: 2px;
}

.cctl__seg--pay {
  background: var(--el-fill-color-darker);
  color: var(--el-text-color-primary);
}

.cctl__seg--cash {
  /* 中性色，不用 success／warning：這個站不做評等，而「自己墊幾天」本身沒有好壞方向性，帶語意色
     等於替讀者判斷。同一組色階裡的第三階，跟上軌區分開但不暗示任何評價。 */
  background: var(--el-color-primary-light-5);
  color: var(--el-text-color-primary);
  margin-left: 2px;
}

/* 負數那一段的意思跟正數相反（已經收到錢、還沒付出去），所以用外框而不是實心區分——形狀的差別，
   不是好壞的差別。 */
.cctl__seg--cash.is-negative {
  background: transparent;
  border: 2px dashed var(--el-color-primary);
  color: var(--el-text-color-primary);
}

.cctl__track-label {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  transition: opacity var(--grow) var(--ease);
}

/* 逐步揭露：用 class 切換而不是 v-if，元素永遠在 DOM 裡（SEO 與動畫都靠這個）。
   第一步只有存貨；第二步加上收現與營運週期；第三步才出現下面那條付款軌道。 */
.cctl--step0 .cctl__seg--rec,
.cctl--step0 .cctl__track-label--top,
.cctl--step0 .cctl__track--pay,
.cctl--step0 .cctl__track-label--pay,
.cctl--step1 .cctl__track--pay,
.cctl--step1 .cctl__track-label--pay {
  width: 0;
  opacity: 0;
}

.cctl--step0 .cctl__track-label--top,
.cctl--step0 .cctl__track-label--pay,
.cctl--step1 .cctl__track-label--pay {
  width: auto;
}

/* 整條軌道收起來時高度也要歸零，否則下面的說明會先空一塊等它出現。 */
.cctl--step0 .cctl__track--pay,
.cctl--step1 .cctl__track--pay {
  height: 0;
  margin-top: 0;
  overflow: clip;
}

.cctl__note {
  min-height: calc(1.8em * 3);
}

.cctl__explain {
  margin: 0 0 8px;
  line-height: 1.8;
}

.cctl__explain:last-child {
  margin-bottom: 0;
}

.cctl__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.cctl__controls :deep(.el-button) {
  min-height: 48px;
}

.cctl__progress {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}
</style>
