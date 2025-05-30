<script setup lang="ts">
import type { z } from 'zod'

const props = defineProps<{
  card: z.infer<typeof cardSchema>
  fieldId: number|string
}>()

const { data: project } = useProjectData()

const fieldName = computed(() => {
  if (props.fieldId === 'id') return 'ID'
  return project.value.fields.find((field) => field.id === Number(props.fieldId))?.name ?? ''
})

const body = computed(() => {
  if (props.fieldId === 'id') return [props.card.id]
  const content = props.card.contents.find((content) => content.fieldId === Number(props.fieldId))
  return (content?.body || '').split(/\r\n|\r|\n/)
})
</script>

<template>
  <div class="flex flex-col gap-y-0.5 mb-3">
    <div class="text-xs font-bold text-gray-500">{{ fieldName }}</div>
    <div class="text-xs break-all min-h-3">
      <template
        v-for="(line, i) in body"
        :key="i"
      >
        <br v-if="i > 0">
        {{ line }}
      </template>
    </div>
  </div>
</template>
