<script setup lang="ts">
import type { z } from 'zod'

const props = defineProps<{
  card: z.infer<typeof cardSchema>
  fieldId: number|string
}>()

const { data: project } = useProjectData()

const fieldId = computed(() => Number(props.fieldId))

const field = computed(() => project.value.fields.find((field) => field.id === fieldId.value))

const body = computed(() => {
  const content = props.card.contents.find((content) => content.fieldId === fieldId.value)
  return (content?.body || '').split(/\r\n|\r|\n/)
})
</script>

<template>
  <div class="flex flex-col gap-y-0.5 mb-3">
    <div class="text-xs font-bold text-gray-500">{{ field?.name }}</div>
    <div class="text-xs break-all min-h-3">
      <template
        v-for="(line, i) in body"
        :key="line"
      >
        <br v-if="i > 0">
        {{ line }}
      </template>
    </div>
  </div>
</template>
