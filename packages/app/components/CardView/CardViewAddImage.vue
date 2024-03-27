<script setup lang="ts">
const {
  projectId,
  cardId,
} = useRoute().params

const { data: card } = useCardData()

const { files, open, reset, onChange } = useFileDialog({
  accept: 'image/*',
  multiple: false,
  capture: 'environment',
})

const {
  execute,
  status,
} = useAsyncData(async () => {
  const file = files.value?.item(0)
  if (!file) return

  const formData = new FormData()
  formData.append('image', file)

  const data = await $fetch(`/api/projects/${projectId}/cards/${cardId}/images`, {
    method: 'post',
    body: formData,
  })
  card.value.images.push(cardSchema.shape.images.element.parse(data))

  reset()
})

onChange(async () => {
  await execute()
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
