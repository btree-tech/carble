<script setup lang="ts">
import type { HorizontalNavigationLink } from '#ui/types'

const { data: project } = await useFetchProject()

const links = computed(() => [
  {
    label: '全般',
    to: `/projects/${project.value?.id}/settings`,
    exact: true,
  },
  ...(project.value?.users.at(0)?.role !== 'owner'
    ? []
    : [
      {
        label: 'インポート',
        to: `/projects/${project.value?.id}/settings/import`,
      },
      {
        label: 'ユーザー管理',
        to: `/projects/${project.value?.id}/settings/users`,
      },
      {
        label: 'プロジェクト削除',
        to: `/projects/${project.value?.id}/settings/delete`,
      },
    ])
] satisfies HorizontalNavigationLink[])
</script>

<template>
  <div>
    <HeaderMenu>
      <div class="flex items-center gap-x-4">
        <div class="grow truncate">
          {{ project?.name }}
        </div>
      </div>
      <div
        class="
          flex items-center gap-x-4
          landscape:col-span-2
        "
      >
        <UButton
          icon="i-material-symbols-light-table-view"
          :to="`/projects/${project?.id}`"
          variant="outline"
        >
          <span class="hidden md:inline">テーブルビュー</span>
        </UButton>
      </div>
      <UHorizontalNavigation :links="links" />
    </HeaderMenu>
    <div class="px-4 pt-8 py-16">
      <NuxtPage />
    </div>
  </div>
</template>
