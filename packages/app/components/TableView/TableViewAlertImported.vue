<script setup lang="ts">
const {
  projectId,
} = useRoute().params

const {
  data: importedData,
} = await useFetch(`/api/projects/${projectId}/imports`, {
  query: {
    unnotified: true,
    pageCount: 1,
  },
  transform: (data) => importsSchema.parse(data).items.at(0),
})

onMounted(async () => {
  if (importedData.value) {
    await $fetch(`/api/projects/${projectId}/imports/${importedData.value.id}`, {
      method: 'put',
      body: {
        notified: true,
      },
    })
  }
})
</script>

<template>
  <div
    v-if="importedData"
    class="p-4"
  >
    <UAlert
      v-if="importedData.status === 'DONE'"
      title="インポートが完了しました"
      :actions="[{ label: '詳細', to: `/projects/${projectId}/imports` }]"
      color="primary"
      variant="subtle"
    />
    <UAlert
      v-else
      title="インポートに失敗しました"
      :actions="[{ label: '詳細', to: `/projects/${projectId}/imports`, color: 'red' }]"
      color="red"
      variant="subtle"
    />
  </div>
</template>
