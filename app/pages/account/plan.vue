<script setup lang="ts">
// 方案與用量（2026-11-16 從 /profile 的 #plan 拆出來，見 AccountPageShell；額度彈窗的「看專業版方案」連到這裡）。設定頁：不給搜尋引擎收錄
useSeoMeta({ title: '方案與用量', robots: 'noindex, nofollow' })

// 2026-10-06「完善付費方案」，使用者決定：只有免費＋專業版、價格等定價研究、這一輪不收款。所以這裡誠實地呈現「現在是什麼方案、額度
// 多少、用了多少」，升級按鈕停用、不寫價格（原本寫死的 NT$399／3,990 拿掉了）。
const { entitlement, entitlementFailure, isTrial, trialDaysLeft } = useEntitlement()

// 用量：entitlement 的 usage（業務中台 79b4d81）；舊版 業務中台 沒有這欄時只列上限。額度的名稱與單位是 QUOTA_ROWS（useEntitlement.ts），
// 免費 vs 專業版的對照表是 SharedPlanCompare（額度彈窗也用）
const usage = computed(() => entitlement.value?.usage)

const dateText = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }) : '')
const planName = computed(() => {
  const current = entitlement.value
  if (!current) return null
  if (current.tier === 'FREE') return '免費版'
  return isTrial.value ? '專業版（試用中）' : '專業版'
})
</script>

<template>
  <AccountPageShell title="方案與用量">
    <AccountSection title="你的方案">
      <!-- 方案卡片就是全站表格的卡片：方案名稱在卡片的標題列，下面是額度表 -->
      <SharedTable :label="`你的方案額度${usage ? '與目前用量' : ''}`" :ssr="false" table-class="plan-page__table">
        <template #header>
          <!-- 方案標題這一塊至少留「方案名稱＋一行說明」的高度（2026-10-18 全站量測）：方案在瀏覽器才讀到，原本讀取中只有一行字，
               讀到後變成名稱＋說明兩行，把下面的額度表推下去（1440 寬 0.007、375 寬 0.023）。免費版也寫一句（2026-11-16），名稱下面不是空白 -->
          <div class="plan-page__head">
            <template v-if="planName">
              <p class="plan-page__name">{{ planName }}</p>
              <p v-if="isTrial && trialDaysLeft !== null" class="plan-page__note">
                試用還剩 {{ trialDaysLeft }} 天（到 {{ dateText(entitlement?.trialEndsAt) }}）。試用結束後自動轉為免費版，你的資料都會保留。
              </p>
              <p v-else-if="entitlement?.source === 'subscription' && entitlement.currentPeriodEnd" class="plan-page__note">
                有效至 {{ dateText(entitlement.currentPeriodEnd) }}
              </p>
              <p v-else-if="entitlement?.tier === 'FREE'" class="plan-page__note">不用付費，也沒有期限。</p>
            </template>
            <!-- 讀不到時全站彈窗會說明並重讀（2026-10-11）；這裡只在還沒回來時說讀取中 -->
            <p v-else-if="!entitlementFailure" class="plan-page__note">方案資訊讀取中…</p>
          </div>
        </template>
        <thead>
          <tr>
            <th scope="col">項目</th>
            <th v-if="usage" scope="col">已使用</th>
            <th scope="col">上限</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in QUOTA_ROWS" :key="row.resource">
            <th scope="row">{{ row.label }}</th>
            <td v-if="usage">{{ usage[row.resource] ?? 0 }} {{ row.unit }}</td>
            <td>{{ quotaLimitText(entitlement ? entitlement.quotas[row.resource] ?? null : undefined, row.unit) }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </AccountSection>

    <!-- 「專業版即將開放」是一句說明，不是停用的按鈕（朗讀器會念成「按鈕，已停用」卻沒有任何可做的事） -->
    <AccountSection title="免費版與專業版">
      <template #description>專業版即將開放。</template>
      <SharedPlanCompare />
      <p class="plan-page__footnote">新註冊的帳號有 14 天專業版試用，不需要信用卡；到期自動轉為免費版，超過免費額度的部分可以看、可以刪，只是不能再新增。</p>
    </AccountSection>
  </AccountPageShell>
</template>

<style scoped>
.plan-page__name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.plan-page__note,
.plan-page__footnote {
  margin: 0;
  color: var(--el-text-color-regular);
}

/* 名稱（1.25rem）＋間距＋說明（1rem），行高照全站 1.5；跟卡片同樣的 12px 間距。說明的行數照試用說明：一行要 608px（2026-11-14 量的）。
   卡片扣框線 2 與內距 32：窄於 21.125rem（338px，370 寬以下的手機）三行，窄於 40.125rem（642px）兩行，再寬一行（2026-11-16 帳號區
   電腦版改成 960 寬、卡片在右邊那欄之後，原本留的兩行在電腦版是一塊空白）。三行是基本樣式，寬的才減。
   容器是 AccountSection 的內容欄 */
.plan-page__head {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: calc(1.25rem * 1.5 + 12px + 1rem * 1.5 * 3);
}

@container (min-width: 21.125rem) {
  .plan-page__head {
    min-height: calc(1.25rem * 1.5 + 12px + 1rem * 1.5 * 2);
  }
}

@container (min-width: 40.125rem) {
  .plan-page__head {
    min-height: calc(1.25rem * 1.5 + 12px + 1rem * 1.5);
  }
}

.plan-page__footnote {
  margin-top: 12px;
}

/* 表格的樣子是全站表格（SharedTable）；這張只有三欄，名稱長的那一格換行，手機上不用左右捲 */
.plan-page__table tbody th {
  white-space: normal;
}
</style>
