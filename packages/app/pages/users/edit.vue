<script setup lang="ts">
const {
  status,
  execute,
} = useAsyncStatus(async () => {
  if (!window.confirm('本当に削除しますか？')) return

  await authClient.deleteUser()
  await navigateTo('/login')
}, { immediate: false })
</script>

<template>
  <div class="">
    <HeaderMenu />
    <div class="w-96 space-y-8 mx-auto">
      <FormUserEdit />
      <UDivider />
      <UButton
        label="ユーザーデータを削除"
        icon="i-material-symbols-light-delete-forever"
        color="red"
        block
        :loading="status === 'pending'"
        @click="execute"
      />
    </div>
  </div>
</template>
