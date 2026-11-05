<script setup lang="ts">
// 額度用完的彈窗（2026-10-24，使用者：「這個直接改成彈窗，這樣有比較多的篇幅說服用戶買單」；原本是右下角一行提示）。全站一個，
// showQuotaReached（quota-notice.ts）打開。說服只用真的差別：兩個方案能存多少（SharedPlanCompare，數字來自 業務中台），卡住的那一列
// 標出來。不寫價格（還沒定）、不倒數；專業版還沒開放購買，所以主按鈕是「看專業版方案」（/profile#plan），不是「立即升級」。
// 觸發的地方都不在別的彈窗裡（篩選的新增對話框、指標挑選器都先關掉自己才送出），不會疊兩層；本來就在彈窗裡的額度說明照舊寫在那個
// 彈窗裡（SharedColumnSettings）
const notice = useQuotaNotice()
// 關的時候 notice 先清掉，標題留著這一則，淡出時字才不會變
const shown = ref(notice.value)
watch(notice, (value) => {
  if (value) shown.value = value
})
const label = computed(() => QUOTA_ROWS.find(row => row.resource === shown.value?.resource)?.label ?? '')
const open = computed({
  get: () => notice.value !== null,
  set: (value: boolean) => {
    if (!value) notice.value = null
  }
})

function seePlans() {
  open.value = false
  void navigateTo('/profile#plan')
}
</script>

<template>
  <!-- ClientOnly：只會在瀏覽器裡打開；伺服器也畫關著的 el-dialog 的話 z-index 對不上（同 AppLoadFailureDialog） -->
  <ClientOnly>
    <el-dialog v-model="open" class="quota-dialog" width="min(520px, calc(100vw - 32px))" append-to-body aria-describedby="quota-dialog-lead">
      <!-- titleId：el-dialog 的 aria-labelledby 指向它 -->
      <template #header="{ titleId }">
        <h2 :id="titleId" class="quota-dialog__title">{{ shown?.detail ?? `${label}已達免費版的上限` }}</h2>
      </template>
      <p id="quota-dialog-lead" class="quota-dialog__lead">升級專業版就不用挑著刪，下面每一項都能存得更多。</p>
      <SharedPlanCompare :highlight="shown?.resource" />
      <p class="quota-dialog__note">專業版即將開放。現在也可以先刪掉不需要的，空出位置。</p>
      <template #footer>
        <el-button @click="open = false">先不用</el-button>
        <el-button type="primary" @click="seePlans">看專業版方案</el-button>
      </template>
    </el-dialog>
  </ClientOnly>
</template>

<style scoped>
.quota-dialog__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.quota-dialog__lead {
  margin: 0 0 16px;
  line-height: 1.7;
}

.quota-dialog__note {
  margin: 16px 0 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}
</style>
