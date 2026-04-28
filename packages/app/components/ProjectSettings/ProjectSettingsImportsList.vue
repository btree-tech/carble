<script setup lang="ts">
import type { Expanded, TableColumn, TableRow } from '#ui/types'
import type { imports } from '@carble/db/schema'

const {
  projectId,
} = useRoute().params

const page = ref(1)

const {
  data,
  status,
} = await useFetch(`/api/projects/${projectId}/imports`, {
  query: {
    page,
  },
  transform: (data) => importsSchema.parse(data),
  default: () => importsSchema.parse(undefined),
})

const columns = computed(() => [
  {
    key: 'createdAt',
    label: 'インポート日時',
  },
  {
    key: 'originalFilename',
    label: 'ファイル名',
  },
  {
    key: 'statusText',
    label: '結果',
    class: 'hidden md:table-cell'
  },
] satisfies TableColumn[])

const items = computed<TableRow[]>(() => {
  const statusTexts = {
    OPEN: '未処理',
    IN_PROGRESS: 'インポート中',
    DONE: 'インポート済',
    FORMAT_ERROR: 'フォーマットエラー',
    SYSTEM_ERROR: 'システムエラー',
    ABORT: '中止',
  } satisfies Record<typeof imports.$inferSelect.status, string>

  const statusColors = {
    OPEN: '',
    IN_PROGRESS: '',
    DONE: 'green',
    FORMAT_ERROR: 'red',
    SYSTEM_ERROR: 'red',
    ABORT: 'yellow',
  } satisfies Record<typeof imports.$inferSelect.status, string>

  return data.value.items.map((item) => ({
    ...item,
    statusText: statusTexts[item.status],
    statusColor: statusColors[item.status],
    disabledExpand: !['FORMAT_ERROR', 'SYSTEM_ERROR'].includes(item.status),
  }))
})

const expand = ref({
  openedRows: [],
  row: null,
} satisfies Expanded<TableRow>)
</script>

<template>
  <div class="max-w-screen-lg">
    <h3>インポート履歴</h3>
    <UTable
      v-if="items"
      v-model:expand="expand"
      :columns="columns"
      :rows="items"
      :loading="status === 'pending'"
      :class="['not-prose my-4', $style.table]"
    >
      <template #createdAt-data="{ row }">
        <NuxtTime
          :datetime="row.createdAt"
          date-style="medium"
          time-style="medium"
        />
      </template>
      <template #statusText-data="{ row }">
        <UBadge
          :label="row.statusText"
          size="sm"
          :color="row.statusColor"
          variant="subtle"
        />
      </template>
      <template #expand="{ row }">
        <pre class="text-sm m-4">{{ row.message }}</pre>
      </template>
    </UTable>

    <div class="grid place-content-center">
      <UPagination
        v-model="page"
        :page-count="data.pageCount"
        :total="data.total"
      />
    </div>
  </div>
</template>

<style lang="postcss" module>
.table button[disabled] {
  @apply hidden;
}
</style>
