<script setup lang="ts">
import type { DropdownItem } from '#ui/types'
import logoImage from 'assets/logo.svg'

const {
  data: projects,
} = await useFetchProjects()

const {
  data: invitedProjects,
} = await useFetchProjectsInvited()

const session = authClient.useSession()

const sessionMenu = computed(() => [
  [
    {
      label: '設定',
      icon: 'i-material-symbols-light-settings',
      to: '/users/edit',
    },
  ],
  [
    {
      label: 'ログアウト',
      icon: 'i-material-symbols-light-logout',
      click: async () => {
        await authClient.signOut()
        await navigateTo('/login')
      },
    },
  ],
] satisfies DropdownItem[][])

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

const projectsInTable = computed(() => {
  return (projects.value || []).map((p) => ({
    ...p,
    updatedAt: { value: p.updatedAt, class: 'hidden md:table-cell' },
  }))
})
</script>

<template>
  <div class="grid row-auto gap-y-8 py-8">
    <div class="flex items-center justify-between gap-4">
      <h1><logoImage class="fill-zinc-500" /></h1>
      <UDropdown :items="sessionMenu">
        <UButton
          :label="session.data?.user.name"
          icon="i-material-symbols-light-person"
        />
      </UDropdown>
    </div>
    <div class="flex flex-col gap-y-4">
      <ProjectIndexAlertInvited
        v-for="project in invitedProjects"
        :key="project.id"
        :project="project"
      />
    </div>
    <div>
      <div class="flex items-center justify-end">
        <ButtonProjectAdd />
      </div>
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
      </UTable>
    </div>
  </div>
</template>
