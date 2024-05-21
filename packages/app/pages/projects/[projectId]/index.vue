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
    <TableViewScan class="justify-self-end" />
    <div
      v-if="project"
      class="overflow-x-auto -mx-4 p-4 xl:mx-0 xl:p-0"
    >
      <table class="table-auto border-separate border-spacing-2 whitespace-nowrap">
        <thead>
          <tr class="text-left">
            <td />
            <th>ID</th>
            <th
              v-for="field in fields"
              :key="field.id"
            >
              {{ field.name }}
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
            v-for="card in cards"
            :key="card.id"
          >
            <td>
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
            <td>
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
