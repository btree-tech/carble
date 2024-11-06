<script setup lang="ts">
watch(
  () => useRoute().params.projectId,
  () => {
    useCardsQuery().value = ''
    useCardsSortId().value = 0
    useCardsSortDirection().value = 'asc'
  }
)
</script>

<template>
  <Title>Carble</Title>
  <NuxtPage class="max-w-screen-xl mx-auto py-4" />
  <UNotifications />
</template>
