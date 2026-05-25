<script setup lang="ts">
import type { VerticalNavigationLink } from '#ui/types'

const props = defineProps<{
  cards: number[]
}>()

const { projectId } = useRoute().params

const {
  data: projects,
} = useProjectsData()

const {
  execute,
  status,
  state: duplicatedCards,
} = useCardDuplicate()

const items = computed(() => [
  projects.value
    .filter(({ id }) => id !== Number(projectId))
    .map((project) => ({
      label: project.name ?? '',
      click: async () => {
        await execute(props.cards, { toProjectId: project.id })
        await navigateTo(`/projects/${project.id}`)
      },
      disabled: !!project.imports.length,
      badge: project.imports.length ? 'インポート中' : undefined,
    })),
  [{
    label: '新しいプロジェクト',
    icon: 'i-material-symbols-light-add',
    click: async () => {
      await execute(props.cards)
      await navigateTo(`/projects/${duplicatedCards.value[0].projectId}/cards/${duplicatedCards.value[0].id}`)
    },
  }],
] satisfies VerticalNavigationLink[][])
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
