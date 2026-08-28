<script setup lang="ts">
const isWide = useIsWideLayout()
const layoutName = computed(() => (isWide.value ? 'desktop' : 'mobile'))
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout :name="layoutName">
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
