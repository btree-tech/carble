<script setup lang="ts">
const props = defineProps<{
  fieldId: number
}>()

const { data: project } = useProjectData()

const {
  execute,
  status,
} = useAsyncData(async () => {
  await $fetch(`/api/projects/${project.value.id}/fields/${props.fieldId}`, {
    method: 'delete',
  })
  const index = project.value.fields.findIndex((field) => field.id === props.fieldId)
  if (index >= 0) {
    project.value.fields.splice(index, 1)
  }
}, {
  immediate: false,
})
</script>

<template>
  <UButton
    icon="i-material-symbols-delete-forever"
    :loading="status === 'pending'"
    color="red"
    @click="execute"
  />
</template>
