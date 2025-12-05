<script setup lang="ts">
import type { VerticalNavigationLink } from '#ui/types';

const props = defineProps<{
  cards: number[]
}>()

const { projectId } = useRoute().params

const {
  data: projects,
} = useFetchProjects()

const toast = useToast()

const items = computed(() => [
  projects.value
    .filter(({ id }) => id !== Number(projectId))
    .map((project) => ({
      label: project.name ?? '',
      click: () => duplicate(project.id),
      disabled: !!project.imports.length,
      badge: project.imports.length ? 'インポート中' : undefined,
    })),
  [{
    label: '新しいプロジェクト',
    icon: 'i-material-symbols-light-add',
    click: () => duplicate(),
  }],
] satisfies VerticalNavigationLink[][])

const {
  executeImmediate: duplicate,
  status,
} = useAsyncStatus(async (to?: number) => {
  const { id: toProjectId } = await $fetch(`/api/projects/${projectId}/cards/duplicate`, {
    method: 'post',
    body: {
      id: props.cards,
      to,
    },
  })
  toast.add({
    id: 'cards-duplicate',
    title: '複製しました',
  })
  await navigateTo(`/projects/${toProjectId}`)
}, { immediate: false })
</script>

<template>
  <UPopover :popper="{ placement: 'bottom-start' }">
    <UButton
      label="複製"
      icon="i-material-symbols-light-content-copy"
      :loading="status === 'pending'"
      color="white"
      class="rounded-none"
    />

    <template #panel>
      <UVerticalNavigation
        :links="items"
        class="m-2"
      />
    </template>
  </UPopover>
</template>
