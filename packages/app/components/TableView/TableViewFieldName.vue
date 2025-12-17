<script setup lang="ts">
const props = defineProps<{
  fieldId: number|'id'|'order'
  fieldName: string|null
}>()

const { data: sortId } = useCardsSortId()

const { data: direction } = useCardsSortDirection()

const icon = computed(() => {
  if (props.fieldId === sortId.value) {
    return direction.value === 'asc'
      ? 'i-material-symbols-light-arrow-upward'
      : 'i-material-symbols-light-arrow-downward'
  }
  return 'i-material-symbols-light-swap-vert'
})

const url = computed(() => {
  const d = (props.fieldId === sortId.value && direction.value === 'asc')
    ? 'desc'
    : 'asc'
  return `?q=${useCardsQuery().data.value}&sort=${props.fieldId}&direction=${d}`
})
</script>

<template>
  <UButton
    :to="url"
    :label="fieldName || ''"
    :icon="icon"
    variant="ghost"
    color="gray"
    :trailing="true"
  />
</template>
