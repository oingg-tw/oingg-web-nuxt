<script setup lang="ts">
// 站內信（2026-11-16，使用者：「站內信用作重大變更，等等全站的通知」→「站內信按照建議實作」；設計 https://claude.ai/artifact/EG27Jgn2v1TYyWvymRztqX）：
// 管理站發更新紀錄時選「站內信」的那幾則（GET /release-notes 的 channel 是 inbox），一般更新只放更新紀錄。只給登入的人，近 12 個月，
// 更早的在更新紀錄。打開就算看過（POST /users/me/inbox/seen）：這一次還標「未讀」，下次不標。未讀的就是最新的那幾則（上次看過之後才
// 發布的），幾則用 GET /users/me 的 unseenInboxCount——這一頁自己再問一次，不等開站那一支回來。不寄 email（使用者：「不佔用戶email這種
// 私人空間」）。設定頁：不給搜尋引擎收錄，也不進 sitemap
useSeoMeta({ title: '站內信', robots: 'noindex, nofollow' })

const currentUser = useCurrentUser()
const authedFetch = useAuthedFetch()
const unseen = useInboxUnseen()
// 在瀏覽器讀（內容只畫給登入的人）；跟全站橫幅同一支 /api/cached
const { data, error, refresh } = useFetch<{ items: ReleaseNote[] }>('/api/cached/release-notes', { key: 'release-notes-inbox', server: false })
watchLoadFailure('inbox-notes', () => error.value, refresh)
const notes = computed(() => inboxNotes(data.value?.items ?? [], Date.now()))
const kindLabel = (kind: string) => RELEASE_KIND_LABELS[kind as ReleaseKind] ?? ''

// 打開時有幾則未讀：標「未讀」用這個數字，之後歸零不影響這一次
const unseenAtOpen = ref(0)
let marked = false
watch(currentUser, async (user) => {
  if (!user || marked) return
  marked = true
  try {
    const me = await authedFetch<{ user?: { unseenInboxCount?: number } }>('/users/me')
    unseenAtOpen.value = me.user?.unseenInboxCount ?? 0
    if (!unseenAtOpen.value) return
    const seen = await authedFetch<{ unseenInboxCount: number }>('/users/me/inbox/seen', { method: 'POST' })
    unseen.value = seen.unseenInboxCount
  } catch {
    // 沒記到：數字留著，下次打開再記
  }
}, { immediate: true })
</script>

<template>
  <AccountPageShell title="站內信">
    <p class="inbox-page__lead">網站有重大變更時通知你；每一則也都在更新紀錄裡。</p>
    <!-- 讀的時候兩張同樣大小的骨架卡 -->
    <ol v-if="!data && !error" class="inbox-page__list" aria-hidden="true">
      <li v-for="n in 2" :key="n" class="app-card inbox-page__item">
        <span class="app-skeleton app-skeleton--text inbox-page__skeleton-meta" />
        <span class="app-skeleton app-skeleton--text inbox-page__skeleton-title" />
        <span class="app-skeleton app-skeleton--text" />
      </li>
    </ol>
    <ol v-else-if="notes.length" class="inbox-page__list">
      <li v-for="(note, index) in notes" :key="note.id" class="app-card inbox-page__item">
        <p class="inbox-page__meta">
          <span v-if="index < unseenAtOpen" class="inbox-page__tag"><span class="inbox-page__dot" aria-hidden="true" />未讀</span>
          {{ kindLabel(note.kind) }}<template v-if="kindLabel(note.kind)">・</template><time :datetime="note.publishedAt">{{ taipeiDate(note.publishedAt) }}</time>
        </p>
        <h2 class="inbox-page__title" :class="{ 'is-seen': index >= unseenAtOpen }">{{ note.title }}</h2>
        <ul v-if="note.changes.length" class="inbox-page__changes">
          <li v-for="(change, i) in note.changes" :key="i">
            <NuxtLink v-if="sitePath(change.path)" :to="sitePath(change.path)!" class="inbox-page__link">{{ change.text }}</NuxtLink>
            <template v-else>{{ change.text }}</template>
          </li>
        </ul>
      </li>
    </ol>
    <p v-else class="inbox-page__empty">目前沒有站內信。網站有重大變更時會寄到這裡。</p>
    <p class="inbox-page__footnote">只列近 12 個月；更早的在<NuxtLink to="/changelog" class="inbox-page__link">更新紀錄</NuxtLink>。</p>
  </AccountPageShell>
</template>

<style scoped>
.inbox-page__lead,
.inbox-page__footnote,
.inbox-page__empty {
  margin: 0;
  color: var(--el-text-color-regular);
}

/* 一則一張卡；內容區寬時兩欄，跟帳號區其他頁一樣用滿寬度（2026-11-16，使用者：「重心不穩 而且又留白過多」） */
.inbox-page__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
  align-items: start;
  gap: 16px;
  margin: 16px 0;
  padding: 0;
  list-style: none;
}

.inbox-page__empty {
  margin: 16px 0;
}

.inbox-page__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
}

.inbox-page__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
}

/* 「未讀」是字加圓點，不只靠顏色 */
.inbox-page__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border: 1px solid var(--el-color-primary-dark-2);
  border-radius: 999px;
  font-weight: 600;
  color: var(--el-color-primary-dark-2);
}

.inbox-page__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.inbox-page__title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
}

.inbox-page__title.is-seen {
  font-weight: 500;
}

.inbox-page__changes {
  margin: 0;
  padding-left: 1.25em;
  color: var(--el-text-color-primary);
}

.inbox-page__changes li + li {
  margin-top: 4px;
}

.inbox-page__link {
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
}

.inbox-page__skeleton-meta {
  width: 8rem;
}

.inbox-page__skeleton-title {
  width: 60%;
}
</style>
