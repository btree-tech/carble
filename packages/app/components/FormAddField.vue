<script setup lang="ts">
defineProps<{
  autofocus?: boolean
}>()

const emit = defineEmits<{
  submitted: []
}>()

const { data: project } = useProjectData()

const input = reactive({
  name: '',
})

const {
  execute,
  status,
} = useAsyncData(async () => {
  const data = await $fetch(`/api/projects/${project.value.id}/fields`, {
    method: 'post',
    body: {
      ...input,
    },
  })
  project.value.fields.push(data)

  input.name = ''

  emit('submitted')
}, {
  immediate: false,
})
</script>

<template>
  <form
    class="m-4"
    @submit.prevent="execute()"
  >
    <div class="flex gap-2 items-end">
      <UFormGroup
        label="新しい項目を追加"
        name="name"
        class="grow"
      >
        <UInput
          v-model="input.name"
          :autofocus="autofocus"
          placeholder="項目名"
        />
      </UFormGroup>
      <UButton
        type="submit"
        label="追加"
        :disabled="!input.name"
        :loading="status === 'pending'"
      />
    </div>
  </form>
</template>
