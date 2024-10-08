<script setup lang="ts">
const props = defineProps<{
  fieldId: number
  fieldName: string|null
}>()

const sortId = defineModel<number>('id')

const direction = defineModel<'asc'|'desc'>('direction')

const icon = computed(() => {
  if (props.fieldId === sortId.value) {
    return direction.value === 'asc'
      ? 'i-material-symbols-light-arrow-upward'
      : 'i-material-symbols-light-arrow-downward'
  }
  return 'i-material-symbols-light-swap-vert'
})

const onClick = () => {
  if (props.fieldId === sortId.value) {
    direction.value = direction.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortId.value = props.fieldId
    direction.value = 'asc'
  }
}
</script>

<template>
  <UButton
    :label="fieldName || ''"
    :icon="icon"
    variant="ghost"
    color="gray"
    :trailing="true"
    @click="onClick"
  />
</template>
