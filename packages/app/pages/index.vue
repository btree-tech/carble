<script setup lang="ts">
import logoImage from "../assets/logo.svg";

const {
  data: projects,
  refresh,
} = await useFetchProjects()

const columns = [
  {
    key: 'view',
    class: 'w-12 md:w-28'
  },
  {
    key: 'name',
    label: 'プロジェクト名',
    class: 'w-3/5'
  },
  {
    key: 'updatedAt',
    label: '最終更新日時',
    class: 'hidden md:block'
  },
  {
    key: 'actions',
    class: 'w-32'
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
const projectsInTable = (projects.value || []).map((p) => {
  return {
    ...p,
    updatedAt: { value: new Date(p.updatedAt).toLocaleString(), class: 'hidden md:block' },
    actions: { value: p.actions, class: 'text-right' }
  }
})
</script>

<template>
  <div class="grid row-auto gap-y-4 px-4">
    <div class="flex items-center justify-between gap-4 px-4">
      <logo-image style="fill: gray"></logo-image>
      <div class="justify-self-end">
        <UButton
          icon="i-material-symbols-light-add"
          :loading="isCreating"
          @click="onClickCreateButton"
        >
          <span class="hidden md:inline">新規プロジェクト</span>
        </UButton>
      </div>
    </div>
    <div>
      <UTable
        v-if="projectsInTable"
        :columns="columns"
        :rows="projectsInTable"
        :ui="{ base: 'w-full', td: { base: '' } }"
      >
        <template #view-data="{ row }">
          <UButton
            variant="soft"
            icon="i-material-symbols-light-table"
            :to="`/projects/${row.id}`"
          >
            <span class="hidden md:inline">詳細</span>
          </UButton>
        </template>
        <template #name-data="{ row }">
          <span>
            {{ row.name }}
          </span>
        </template>
        <template #updatedAt-data="{ row }">
          {{ row.updatedAt.value }}
        </template>
        <template #actions-data="{ row }">
          <UButton
            color="red"
            icon="i-material-symbols-delete-forever"
            :loading="isDeleting.get(row.id)"
            @click="onClickDeleteButton(row.id)"
          >
            <span class="hidden md:inline">削除</span>
          </UButton>
        </template>
      </UTable>
    </div>
  </div>
</template>
