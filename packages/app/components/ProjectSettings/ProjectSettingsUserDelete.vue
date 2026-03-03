<script setup lang="ts">
import type z from 'zod'

const props = defineProps<{
  user: z.infer<typeof projectUserSchema>
}>()

const { projectId } = useRoute().params

const {
  status,
  execute,
} = useAsyncStatus(async () => {
  if (!window.confirm('削除してよろしいですか？')) return
  await $fetch(`/api/projects/${projectId}/users/${props.user.id}`, {
    method: 'delete',
  })
  refreshNuxtData(useFetchProjectUsersKey().data.value)
}, { immediate: false })
</script>

<template>
  <UButton
    color="red"
    icon="i-material-symbols-light-delete-forever"
    :loading="status === 'pending'"
    @click="execute"
  >
    <span class="hidden md:inline">削除</span>
  </UButton>
</template>
