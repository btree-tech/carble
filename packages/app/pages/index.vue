<script setup lang="ts">
import logoImage from '../assets/logo.svg'

const {
  data: projects,
  refresh,
  error,
} = await useFetchProjects()

// CESCHI-137
watch(error, async (error) => {
  if (!error) return
  if (error.data?.data?.redirectTo) {
    await navigateTo(error.data.data.redirectTo)
  } else {
    createError(error)
  }
}, { immediate: true })

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
    class: 'hidden md:table-cell'
  },
  {
    key: 'actions',
    class: 'w-32'
  }
]

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

const projectsInTable = computed(() => {
  return (projects.value || []).map((p) => ({
    ...p,
    updatedAt: { value: p.updatedAt, class: 'hidden md:table-cell' },
    actions: { class: 'text-right' },
  }))
})
</script>

<template>
  <div class="grid row-auto gap-y-4 py-4">
    <div class="flex items-center justify-between gap-4 px-4">
      <logoImage class="fill-zinc-500" />
      <ButtonProjectAdd />
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
            variant="outline"
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
          <NuxtTime
            :datetime="row.updatedAt.value"
            date-style="medium"
            time-style="medium"
          />
        </template>
        <template #actions-data="{ row }">
          <UButton
            color="red"
            icon="i-material-symbols-light-delete-forever"
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
