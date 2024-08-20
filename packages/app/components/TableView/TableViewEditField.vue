<script setup lang="ts">
const props = defineProps<{
  fieldId: number
}>()

const { data: project } = useProjectData()

const index = computed(() => project.value.fields.findIndex((field) => field.id === props.fieldId))

const field = computed({
  get: () => project.value.fields[index.value],
  set: (value) => {
    project.value.fields[index.value] = value
  },
})

const {
  status: updateStatus,
} = useFetch(`/api/projects/${project.value.id}/fields/${props.fieldId}`, {
  method: 'put',
  body: {
    name: refDebounced(computed(() => field.value.name), 200),
  },
  immediate: false,
})

const {
  execute: toggleIsVisible,
  status: updateIsVisibleStatus,
} = useAsyncData(async () => {
  const newValue = !field.value.isVisible
  await $fetch(`/api/projects/${project.value.id}/fields/${props.fieldId}`, {
    method: 'put',
    body: {
      isVisible: newValue,
    },
  })
  field.value = {
    ...field.value,
    isVisible: newValue,
  }
}, {
  immediate: false,
})

const {
  execute: deleteField,
  status: deleteStatus,
} = useAsyncData(async () => {
  if (!window.confirm('削除してよろしいですか？')) return

  await $fetch(`/api/projects/${project.value.id}/fields/${props.fieldId}`, {
    method: 'delete',
  })
  if (index.value >= 0) {
    project.value.fields.splice(index.value, 1)
  }
}, {
  immediate: false,
})
</script>

<template>
  <div class="flex items-center gap-2">
    <UInput
      v-model="field.name"
      :loading="updateStatus === 'pending'"
      trailing
      class="w-40"
    />
    <UButton
      :icon="field.isVisible ? 'i-material-symbols-light-visibility': 'i-material-symbols-light-visibility-off'"
      :loading="updateIsVisibleStatus === 'pending'"
      color="gray"
      @click="toggleIsVisible"
    />
    <UButton
      icon="i-material-symbols-light-delete"
      :loading="deleteStatus === 'pending'"
      color="gray"
      @click="deleteField"
    />
  </div>
</template>
