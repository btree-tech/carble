<script setup lang="ts">
const isOpen = defineModel<boolean>()

const onUploaded = async () => {
  clearNuxtData(getFetchProjectKey())
  await refreshNuxtData(getFetchProjectImportsInProgressKey())
}
</script>

<template>
  <ModalImport
    v-model="isOpen"
    @uploaded="onUploaded"
  />
</template>
