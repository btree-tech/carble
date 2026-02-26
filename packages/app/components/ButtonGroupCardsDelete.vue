<script setup lang="ts">
const props = defineProps<{
  cards: number[]
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
      ids: props.cards,
    },
  })
  await useFetchCards().refresh()
}, { immediate: false })
</script>

<template>
  <UButton
    label="削除"
    icon="i-material-symbols-light-delete-forever"
    color="white"
    :loading="status === 'pending'"
    class="rounded-e-md"
    @click="execute"
  />
</template>
