<script setup lang="ts">
const {
  data: project,
} = await useFetchProject()

const {
  data: cards,
} = await useFetchCards()

const {
  execute: add,
  status: addStatus,
} = useCardAdd()

const { data: queryParams } = useCardsQueryParams()

const fields = computed(() => (project.value?.fields || []).filter((field) => field.isVisible))

const {
  statuses,
  status,
} = useMultiAsyncDataStatus<string|number>()

const {
  checkedItems,
  isCheckedAll,
  isIndeterminate,
} = useTriStateCheckbox(computed(() => (cards.value.items ?? []).map(({ id }) => id)))

const buttonGroupCardsRef = useTemplateRef('buttonGroupCardsRef')

watch(
  () => useRoute().name,
  () => {
    checkedItems.value = []
  }
)
</script>

<template>
  <div v-if="project && cards">
    <HeaderMenu class="mx-4 max-w-screen-xl">
      <div class="flex items-center gap-1">
        <UButton
          icon="i-material-symbols-light-home"
          to="/"
          variant="link"
          :padded="false"
        >
          <span class="hidden md:inline">ホーム</span>
        </UButton>
        <UIcon
          name="i-material-symbols-light-chevron-right"
          class="w-6 h-6"
        />
        <TableViewProjectName
          class="grow"
          @update:status="statuses.set('name', $event)"
        />
        <ScanButton class="ml-4"/>
      </div>
      <div class="flex items-center gap-4">
        <UButton
          class="flex-none"
          icon="i-material-symbols-light-grid-view"
          :to="`/projects/${project?.id}/grid`"
          variant="outline"
        >
          <span class="hidden md:inline">グリッドビュー</span>
        </UButton>
        <UButton
          class="flex-none"
          icon="i-material-symbols-light-print"
          :to="`/projects/${project?.id}/print`"
          variant="outline"
        >
          <span class="hidden md:inline">カード印刷ビュー</span>
        </UButton>
        <TableViewFilter />
        <div class="grow" />
        <StatusIcon :status="status" />
        <UButton
          icon="i-material-symbols-light-settings"
          :to="`/projects/${project?.id}/settings`"
          variant="outline"
        >
          <span class="hidden md:inline">プロジェクト設定</span>
        </UButton>
      </div>
      <TableViewAlertImported />
    </HeaderMenu>
    <div class="relative col-span-3 overflow-auto p-4 landscape:px-8">
      <ButtonGroupCards
        v-if="buttonGroupCardsRef"
        v-model="checkedItems"
        :reference="buttonGroupCardsRef!"
        class="z-50 shadow lg:left-60 lg:right-auto"
      />
      <table class="table-auto border-separate border-spacing-2 whitespace-nowrap">
        <thead>
          <tr class="text-left">
            <th class="text-right p-1">
              <TableViewFieldName
                field-id="order"
                field-name="並び順"
              />
            </th>
            <td class="p-1" />
            <td
              ref="buttonGroupCardsRef"
              class="p-1"
            >
              <UCheckbox
                v-model="isCheckedAll"
                :indeterminate="isIndeterminate"
              />
            </td>
            <th class="p-1">
              <TableViewFieldName
                field-id="id"
                field-name="ID"
              />
            </th>
            <th
              v-for="field in fields"
              :key="field.id"
              class="p-1"
            >
              <TableViewFieldName
                :field-id="field.id"
                :field-name="field.name"
              />
            </th>
            <td class="p-1">
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
            v-for="card in cards.items"
            :key="card.id"
          >
            <td class="text-right p-1 pr-4">
              {{ card.order }}
            </td>
            <td class="p-1">
              <UButton
                :icon="card.images.length ? 'i-material-symbols-light-photo-library' : 'i-material-symbols-light-edit-note'"
                :to="{ path: `/projects/${card.projectId}/cards/${card.id}`, query: queryParams }"
                variant="outline"
              >
                <span class="hidden md:inline">カード入力</span>
              </UButton>
            </td>
            <td class="p-1">
              <UCheckbox
                v-model="checkedItems"
                :value="card.id"
              />
            </td>
            <td class="text-right p-1">
              {{ card.id }}
            </td>
            <td
              v-for="field in fields"
              :key="field.id"
              class="relative border-b border-gray-300 dark:border-gray-700 p-1"
            >
              <TableViewContent
                :card-id="card.id"
                :field-id="field.id"
                @update:status="statuses.set(card.id, $event)"
              />
            </td>
            <td class="space-x-2 p-1">
              <TableViewCardMenu :card="card" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="mx-4">
      <UButton
        icon="i-material-symbols-light-add"
        :loading="addStatus === 'pending'"
        @click="add()"
      >
        <span class="hidden md:inline">追加</span>
      </UButton>
    </div>
  </div>
</template>
