<script setup lang="ts">
import type z from 'zod'

const props = defineProps<{
  cards: z.infer<typeof cardsSchema>
}>()

const emit = defineEmits<{
  deleted: []
}>()

const { projectId } = useRoute().params

const {
  execute,
  status,
} = useAsyncStatus(async () => {
  if (!confirm('削除してよろしいですか？')) return

  await $fetch(`/api/projects/${projectId}/cards`, {
    method: 'delete',
    body: {
      ids: props.cards.map(({ id }) => id),
    },
  })
  await useFetchCards().refresh()
  emit('deleted')
}, { immediate: false })
</script>

<template>
  <UButton
    label="削除"
    icon="i-material-symbols-light-delete-forever"
    color="white"
    :loading="status === 'pending'"
    @click="execute"
  />
</template>
