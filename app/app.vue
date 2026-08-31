<script setup lang="ts">
const isWide = useIsWideLayout()
const layoutName = computed(() => (isWide.value ? 'desktop' : 'mobile'))

// Mounted once, app-wide, so the mode/color → <html> sync (see useAppTheme.ts) is live from
// the very first page regardless of which one that happens to be.
useAppTheme()
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout :name="layoutName">
      <NuxtPage />
    </NuxtLayout>
    <UserLoginDialog />
  </div>
</template>
