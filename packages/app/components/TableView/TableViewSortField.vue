<script setup lang="ts">
import { useSortable } from '@vueuse/integrations/useSortable'
import { fields as fieldsTable } from '@carble/db/schema'

defineSlots<{
  default(props: { field: typeof fieldsTable.$inferSelect }): any
}>()

const { data: project } = useProjectData()

const fields = computed({
  get: () => project.value.fields,
  set: (fields) => {
    project.value = {
      ...project.value,
      fields: fields.map((field, i) => ({
        ...field,
        order: i + 1,
      })),
    }
  },
})

const { status } = useAsyncData(async () => {
  await $fetch(`/api/projects/${project.value.id}/fields`, {
    method: 'put',
    body: fields.value.map((field) => ({
      id: field.id,
      order: field.order,
    })),
  })
}, {
  immediate: false,
  watch: [fields],
})

const container = ref<HTMLDivElement>()

useSortable(container, fields, {
  handle: '.handle',
})
</script>

<template>
  <div class="m-4 space-y-1">
    <div class="text-sm font-bold">
      項目を編集
    </div>
    <div
      ref="container"
      class="flex flex-col gap-y-2 relative"
    >
      <div
        v-for="field in fields"
        :key="field.id"
        class="flex items-center gap-2"
      >
        <UButton
          icon="i-material-symbols-light-drag-indicator"
          variant="ghost"
          color="gray"
          class="handle cursor-grab active:cursor-grabbing"
        />
        <slot :field="field" />
      </div>
      <div
        v-if="status === 'pending'"
        class="absolute inset-0 grid place-content-center bg-white dark:bg-gray-900 opacity-75"
      >
        <UIcon
          name="i-material-symbols-light-progress-activity"
          class="animate-spin"
        />
      </div>
    </div>
  </div>
</template>
