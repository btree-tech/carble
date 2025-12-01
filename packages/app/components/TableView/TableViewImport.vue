<script setup lang="ts">
const isOpen = defineModel<boolean>()

const onUploaded = async () => {
  await refreshNuxtData(getFetchProjectImportsInProgressKey())
}
</script>

<template>
  <ModalImport
    v-model="isOpen"
    @uploaded="onUploaded"
  />
</template>
