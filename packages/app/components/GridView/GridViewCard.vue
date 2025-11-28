<script setup lang="ts">
import type z from 'zod'

const props = defineProps<{
  card: z.infer<typeof cardSchema>
}>()

const {
  data: selectionState,
} = useGridViewSelectionState()

const selected = computed(() => selectionState.value.includes(props.card.id))

const { data: setting } = useGridViewSetting()
</script>

<template>
  <label class="group relative grid grid-rows-[1fr,auto,auto] border w-40 h-40">
    <GridViewCardContent
      :card="card"
      :field-id="setting.data.fields[0]"
      class="overflow-hidden border-b pointer-events-none"
    />
    <GridViewCardContent
      :card="card"
      :field-id="setting.data.fields[1]"
      class="h-9 overflow-hidden border-b pointer-events-none"
    />
    <UButton
      label="カード入力"
      :icon="card.images.length ? 'i-material-symbols-light-photo-library' : 'i-material-symbols-light-edit-note'"
      :to="`/projects/${card.projectId}/cards/${card.id}`"
      variant="link"
    />
    <div
      v-if="selected"
      class="absolute inset-0 bg-primary-500 dark:bg-primary-600 opacity-25"
    />
    <UCheckbox
      v-model="selectionState"
      :value="card.id"
      :input-class="selected ? '' : '!bg-none dark:!bg-gray-900 !border-gray-300 dark:!border-gray-700'"
      :ui="{ container: 'h-7', base: 'w-6 h-6' }"
      :class="[
        'absolute top-1 right-1 opacity-0 group-hover:opacity-100',
        { 'opacity-100': selectionState.length },
      ]"
    />
  </label>
</template>
