<script setup lang="ts">
import type { AsyncDataRequestStatus } from '#app/composables/asyncData'

const emit = defineEmits<{
  'update:status': [AsyncDataRequestStatus]
}>()

const { data: project } = useProjectData()

const debounced = refDebounced(computed(() => project.value.name), 200)

const { status } = useFetch(`/api/projects/${project.value.id}`, {
  method: 'put',
  body: {
    name: debounced,
  },
  immediate: false,
})

watch(status, (status) => {
  emit('update:status', status)
})
</script>

<template>
  <UInput v-model="project.name" />
</template>
