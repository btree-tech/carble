<script setup lang="ts">
const {
  data: project,
} = await useFetchProject()

const {
  data: cards,
} = await useFetchCards()

const fields = computed(() => (project.value?.fields || []).filter((field) => field.isVisible))

const {
  statuses,
  status,
} = useMultiAsyncDataStatus<string|number>()

const sortId = ref(0)

const sortDirection = ref<'asc'|'desc'>('asc')

const sortedCards = computed(() => {
  const result = sortId.value === 0
    ? [...cards.value]
    : [...cards.value].sort((a, b) => {
      const contentA = a.contents.find((c) => c.fieldId === sortId.value)?.body || ''
      const contentB = b.contents.find((c) => c.fieldId === sortId.value)?.body || ''
      return contentA.localeCompare(contentB)
    })

  return sortDirection.value === 'asc'
    ? result
    : result.reverse()
})

const getSortIcon = (fieldId: number) => {
  if (fieldId === sortId.value) {
    return sortDirection.value === 'asc'
      ? 'i-material-symbols-light-arrow-upward'
      : 'i-material-symbols-light-arrow-downward'
  }
  return 'i-material-symbols-light-swap-vert'
}

const onClickSortButton = (fieldId: number) => {
  if (sortId.value === fieldId) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortId.value = fieldId
    sortDirection.value = 'asc'
  }
}
</script>

<template>
  <div class="grid row-auto gap-y-4 px-4">
    <div>
      <UButton
        label="プロジェクト一覧に戻る"
        icon="i-material-symbols-light-door-open"
        to="/"
        variant="link"
        :padded="false"
      />
    </div>
    <div class="flex items-center gap-4">
      <TableViewProjectName
        class="grow"
        @update:status="statuses.set('name', $event)"
      />
      <StatusIcon :status="status" />
      <UButton
        icon="i-material-symbols-light-print"
        :to="`/projects/${project?.id}/print`"
        variant="soft"
      >
        <span class="hidden md:inline">印刷ビュー</span>
      </UButton>
      <TableViewMenu />
    </div>
    <ScanButton class="justify-self-end" />
    <div
      v-if="project"
      class="overflow-x-auto -mx-4 p-4 xl:mx-0 xl:p-0"
    >
      <table class="table-auto border-separate border-spacing-2 whitespace-nowrap">
        <thead>
          <tr class="text-left">
            <td />
            <th>
              <UButton
                label="ID"
                :icon="getSortIcon(0)"
                variant="ghost"
                color="gray"
                :trailing="true"
                @click="onClickSortButton(0)"
              />
            </th>
            <th
              v-for="field in fields"
              :key="field.id"
            >
              <UButton
                :label="field.name"
                :icon="getSortIcon(field.id)"
                variant="ghost"
                color="gray"
                :trailing="true"
                @click="onClickSortButton(field.id)"
              />
            </th>
            <td>
              <UPopover>
                <UButton
                  icon="i-material-symbols-light-more-horiz"
                  color="gray"
                  size="xs"
                />

                <template #panel>
                  <TableViewSortField>
                    <template #default="{ field }">
                      <TableViewEditField :field-id="field.id" />
                    </template>
                  </TableViewSortField>

                  <UDivider />

                  <FormAddField />
                </template>
              </UPopover>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="card in sortedCards"
            :key="card.id"
          >
            <td class="flex items-center gap-x-2">
              <UIcon
                name="i-material-symbols-light-image"
                :class="['w-6 h-6', { invisible: !card.images.length }]"
              />
              <UButton
                icon="i-material-symbols-light-list-alt"
                :to="`/projects/${card.projectId}/cards/${card.id}`"
              >
                <span class="hidden md:inline">カード</span>
              </UButton>
            </td>
            <td class="text-right">
              {{ card.id }}
            </td>
            <td
              v-for="field in fields"
              :key="field.id"
              class="relative border-b border-gray-300 dark:border-gray-700"
            >
              <TableViewContent
                :card-id="card.id"
                :field-id="field.id"
                @update:status="statuses.set(card.id, $event)"
              />
            </td>
            <td class="space-x-2">
              <DuplicateCard
                :project-id="project.id"
                :card-id="card.id"
              />
              <TableViewDeleteCard
                :project-id="project.id"
                :card-id="card.id"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <TableViewAddCard class="justify-self-start" />
  </div>
</template>
