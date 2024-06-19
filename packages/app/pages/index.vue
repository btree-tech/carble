<script setup lang="ts">
const {
  data: projects,
  refresh,
} = await useFetchProjects()

const columns = [
  {
    key: 'name',
    label: 'プロジェクト名',
  },
  {
    key: 'updatedAt',
    label: '最終更新日時',
  },
  {
    key: 'actions',
  }
]

const isCreating = ref(false)
const onClickCreateButton = async () => {
  isCreating.value = true
  const project = await $fetch('/api/projects', {
    method: 'post',
  })
  await navigateTo(`/projects/${project.id}`)
  isCreating.value = false
}

const isDeleting = ref(new Map<number, boolean>())
const onClickDeleteButton = async (id: number) => {
  if (!window.confirm('削除してよろしいですか？')) return

  isDeleting.value.set(id, true)
  await $fetch(`/api/projects/${id}`, {
    method: 'delete',
  })
  await refresh()
  isDeleting.value.set(id, false)
}
</script>

<template>
  <div class="space-y-4">
    <UButton
      label="新規プロジェクト"
      icon="i-material-symbols-light-add"
      :loading="isCreating"
      @click="onClickCreateButton"
    />
    <UTable
      v-if="projects"
      :columns="columns"
      :rows="projects"
    >
      <template #name-data="{ row }">
        {{ row.name }}
        <UButton
          label="詳細"
          trailing-icon="i-material-symbols-light-arrow-forward"
          :to="`/projects/${row.id}`"
          class="ml-4"
        />
      </template>
      <template #updatedAt-data="{ row }">
        {{ new Date(row.updatedAt).toLocaleString() }}
      </template>
      <template #actions-data="{ row }">
        <UButton
          label="削除"
          :loading="isDeleting.get(row.id)"
          @click="onClickDeleteButton(row.id)"
        />
      </template>
    </UTable>
  </div>
</template>
