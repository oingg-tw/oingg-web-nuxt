<script setup lang="ts">
// 帳號這一區每一頁的外殼（2026-11-16 從 /profile 拆成 /account 幾頁加側欄）：標題、側欄（AccountNav）、訪客導回首頁，然後才是頁面內容。
// 標題與側欄沒有個人資料，伺服器先畫；內容要等登入狀態還原
const props = defineProps<{ title: string }>()

const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const router = useRouter()

// 訪客沒有帳號可管理：彈回首頁，不顯示空頁。登入狀態只在瀏覽器裡、而且是 Firebase 非同步還原的，所以不能在伺服器端轉址；也要等
// authResolved——只看 currentUser 的話，直接載入這一頁會在使用者還原之前就被彈走（2026-10-08 實測，登入中的人重新整理也會回到首頁）。
// immediate 同時涵蓋「從沒登入」與「在這頁登出」
watch(
  [authResolved, currentUser],
  ([resolved, user]) => {
    if (resolved && !user) router.replace('/')
  },
  { immediate: true }
)
</script>

<template>
  <div class="account-shell">
    <h1 class="app-page__title app-page__title--app account-shell__title">{{ props.title }}</h1>
    <AccountNav />
    <slot v-if="currentUser" />
  </div>
</template>

<style scoped>
/* 手機一欄 480；電腦版用滿內容區，跟持股管理一樣從側欄旁邊開始（2026-11-16，使用者：「電腦版上看起來彆扭…在電腦版要RWD」，
   再來「重心不穩 而且又留白過多」：先試的 960 置中，離側欄一大段、標題欄底下整條空著）。各頁在內容區 960 以上排成並排的兩欄 */
.account-shell {
  container-type: inline-size;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}

@media (min-width: 768px) {
  .account-shell {
    max-width: none;
  }
}

.account-shell__title {
  margin: 0 0 16px;
}
</style>
