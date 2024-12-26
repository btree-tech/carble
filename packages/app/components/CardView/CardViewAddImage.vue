<script setup lang="ts">
const {
  cardId,
} = useRoute().params

const { files, open, onChange } = useFileDialog({
  accept: 'image/*',
  multiple: false,
  capture: 'environment',
  reset: true,
})

const {
  execute,
  status,
} = useCardImageAdd(cardId)

onChange(async () => {
  await execute(files.value?.item(0))
})
</script>

<template>
  <UButton
    label="画像を追加"
    icon="i-material-symbols-light-add-a-photo"
    :loading="status === 'pending'"
    @click="open"
  />
</template>
