<script setup lang="ts">
import type { DropdownItem, VerticalNavigationLink } from '#ui/types'
import type z from 'zod'

const props = defineProps<{
  card: z.infer<typeof cardSchema>
}>()

const {
  data: projects,
} = useFetchProjects()

const {
  execute: add,
  status: addStatus,
} = useCardAdd()

const {
  execute: duplicate,
  status: duplicateStatus,
  state: duplicatedCards,
} = useCardDuplicate()

const {
  execute: remove,
  status: removeStatus,
} = useCardRemove()

const { projectId } = useRoute().params

const projectSubMenuIsOpen = ref(false)

const duplicatesSubMenuIsOpen = ref(false)

const items = computed(() => [
  [
    {
      label: '直下に追加',
      click: () => add(props.card.id),
    },
  ],
  [
    {
      label: '直下に複製',
      click: () => duplicate(props.card.id, {
        toProjectId: props.card.projectId,
        nextToId: props.card.id,
      }),
    },
    {
      label: '末尾に複製',
      click: () => duplicate(props.card.id, { toProjectId: props.card.projectId }),
    },
    {
      label: '別プロジェクトに複製',
      icon: 'i-material-symbols-light-arrow-right',
      class: 'flex-row-reverse justify-between',
      click: () => projectSubMenuIsOpen.value = true,
    },
  ],
  [
    {
      label: '複製元カードを表示',
      disabled: !props.card.original,
      to: `/projects/${props.card.originalProjectId}/cards/${props.card.originalCardId}`,
    },
    {
      label: '複製先カードを表示',
      icon: 'i-material-symbols-light-arrow-right',
      disabled: !props.card.duplicates.length,
      class: 'flex-row-reverse justify-between',
      click: () => duplicatesSubMenuIsOpen.value = true,
    },
  ],
  [
    {
      label: '削除',
      click: () => remove(props.card.id),
    },
  ],
] satisfies DropdownItem[][])

const projectSubMenuItems = computed(() => [
  projects.value
    .filter(({ id }) => id !== Number(projectId))
    .map((project) => ({
      label: project.name ?? '',
      click: async () => {
        await duplicate(props.card.id, { toProjectId: project.id })
        await navigateTo(`/projects/${project.id}`)
      },
      disabled: !!project.imports.length,
      badge: project.imports.length ? 'インポート中' : undefined,
    })),
  [{
    label: '新しいプロジェクト',
    icon: 'i-material-symbols-light-add',
    click: async () => {
      await duplicate(props.card.id)
      await navigateTo(`/projects/${duplicatedCards.value[0].projectId}`)
    },
  }],
] satisfies VerticalNavigationLink[][])

const duplicateSubMenuItems = computed(() => [
  props.card.duplicates.map(({ id, projectId, project }) => ({
    label: `${project.name} - ID: ${id}`,
    to: `/projects/${projectId}/cards/${id}`
  }))
] satisfies VerticalNavigationLink[][])
</script>

<template>
  <div>
    <UDropdown :items="items">
      <UButton
        icon="i-material-symbols-light-more-horiz"
        color="gray"
        size="xs"
        :loading="addStatus === 'pending' || duplicateStatus === 'pending' || removeStatus === 'pending'"
      />
    </UDropdown>

    <UModal v-model="projectSubMenuIsOpen">
      <UCard>
        <template #header>別プロジェクトに複製</template>
        <UVerticalNavigation :links="projectSubMenuItems" />
      </UCard>
    </UModal>

    <UModal v-model="duplicatesSubMenuIsOpen">
      <UCard>
        <template #header>複製先カード</template>
        <UVerticalNavigation :links="duplicateSubMenuItems" />
      </UCard>
    </UModal>
  </div>
</template>
