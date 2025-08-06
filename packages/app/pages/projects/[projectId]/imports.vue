<script setup lang="ts">
import type { AccordionItem } from '#ui/types'
import type { imports } from '@carble/db/schema'

const {
  projectId,
} = useRoute().params

const page = ref(1)

const {
  data,
} = await useFetch(`/api/projects/${projectId}/imports`, {
  query: {
    page,
  },
  transform: (data) => importsSchema.parse(data),
  default: () => importsSchema.parse(undefined),
})

const items = computed<AccordionItem[]>(() => {
  const statusTexts = {
    OPEN: '未処理',
    IN_PROGRESS: 'インポート中',
    DONE: 'インポート済',
    FORMAT_ERROR: 'フォーマットエラー',
    SYSTEM_ERROR: 'システムエラー',
    ABORT: '中止',
  } satisfies Record<typeof imports.$inferSelect.status, string>

  return data.value.items.map((item, i) => ({
    label: item.createdAt.toLocaleString(),
    content: '',
    defaultOpen: !i,
    data: item,
    statusText: statusTexts[item.status],
    isError: ['FORMAT_ERROR', 'SYSTEM_ERROR'].includes(item.status),
  }))
})

const isOpen = computed({
  get: () => true,
  set: async (value) => {
    if (!value) {
      await navigateTo(`/projects/${projectId}`)
    }
  },
})
</script>

<template>
  <UModal v-model="isOpen">
    <UCard>
      <template #header>インポート履歴</template>

      <UAccordion :items="items">
        <template #item="{ item }">
          <dl class="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 mx-4">
            <dt class="font-bold">ファイル名</dt>
            <dd>{{ item.data.originalFilename }}</dd>
            <dt class="font-bold">結果</dt>
            <dd>{{ item.statusText }}</dd>
            <template v-if="item.isError">
              <dt class="font-bold">詳細</dt>
              <dd>{{ item.data.message }}</dd>
            </template>
          </dl>
        </template>
      </UAccordion>

      <template #footer>
        <div class="grid place-content-center">
          <UPagination
            v-model="page"
            :page-count="data.pageCount"
            :total="data.total"
          />
        </div>
      </template>
    </UCard>
  </UModal>
</template>
