<script setup lang="ts">
import type z from 'zod'

const props = defineProps<{
  card: z.infer<typeof cardSchema>
}>()

const emit = defineEmits<{
  change: [boolean]
}>()

const {
  data: selectionState,
  selectedIds,
} = useGridViewSelectionState()

const selected = computed({
  get: () => !!selectionState.value.get(props.card.id),
  set: (value) => emit('change', value),
})

const { data: setting } = useGridViewSetting()

const shiftKeyState = useKeyModifier('Shift')

const root = useTemplateRef('root')

onLongPress(
  root,
  () => {
    selected.value = !selected.value
  },
  {
    modifiers: {
      prevent: true,
    },
    onMouseUp: (_, __, isLongPress) => {
      if (!isLongPress) {
        if (shiftKeyState.value || selectedIds.value.length) {
          selected.value = !selected.value
        } else {
          navigateTo(`/projects/${props.card.projectId}/cards/${props.card.id}`)
        }
      }
    },
  },
)
</script>

<template>
  <button
    ref="root"
    type="button"
    class="group relative grid grid-rows-[1fr,auto] gap-0 text-left border w-40 h-40"
  >
    <GridViewCardContent
      :card="card"
      :field-id="setting.data.fields[0]"
      class="overflow-hidden border-b"
    />
    <GridViewCardContent
      :card="card"
      :field-id="setting.data.fields[1]"
      class="h-10 overflow-hidden"
    />
    <div
      v-if="selected"
      class="absolute inset-0 bg-primary-500 dark:bg-primary-600 opacity-25"
    />
    <div
      :class="[
        'absolute top-1 right-1 opacity-0 group-hover:opacity-100',
        { 'opacity-100': selectedIds.length },
      ]"
    >
      <UCheckbox
        v-model="selected"
        :ui="{ container: 'h-7', base: 'w-6 h-6' }"
        @pointerdown.stop
      />
    </div>
  </button>
</template>
