<script setup lang="ts">
const { projectId } = useRoute().params

const toast = useToast()

const {
  execute,
  status
} = useAsyncStatus(async () => {
  if (!window.confirm('削除してよろしいですか？')) return

  await $fetch(`/api/projects/${projectId}`, {
    method: 'delete',
  })

  toast.add({
    id: `/projects/${projectId}/delete`,
    title: 'プロジェクトを削除しました',
  })

  await navigateTo('/')
}, {
  immediate: false,
})
</script>

<template>
  <div>
    <UButton
      label="プロジェクトを削除する"
      icon="i-material-symbols-light-delete-forever"
      color="red"
      size="xl"
      :loading="status === 'pending'"
      class="mx-auto"
      @click="execute"
    />
  </div>
</template>
