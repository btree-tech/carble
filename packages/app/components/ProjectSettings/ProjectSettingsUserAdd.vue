<script setup lang="ts">
import { users } from '@carble/db/schema'
import type { Form } from '#ui/types'
import type z from 'zod'

const schema = createUpdateSchema(users, {
  username: (s) => s.min(3, { error: '' }).max(30, { error: '' }),
}).pick({
  username: true,
})

const input = ref({
  username: '',
})

const form = useTemplateRef<Form<z.infer<typeof schema>>>('form')

const {
  status,
  execute,
} = useAsyncStatus(async () => {
  await $fetch(`/api/projects/${useRoute().params.projectId}/users`, {
    method: 'post',
    body: {
      username: input.value.username,
      status: 'invited',
    },
  })
  input.value.username = ''
  await refreshNuxtData(useFetchProjectUsersKey().data.value)
}, {
  immediate: false,
  onError: () => {
    form.value?.setErrors([
      { path: 'username', message: '存在しないIDです' },
    ])
  },
})
</script>

<template>
  <UForm
    ref="form"
    :schema="schema"
    :state="input"
    class="flex items-start gap-2"
    @submit="execute"
  >
    <UFormGroup
      name="username"
      eager-validation
    >
      <UInput
        v-model="input.username"
        placeholder="ユーザーIDを入力して招待"
      />
    </UFormGroup>
    <UButton
      type="submit"
      label="招待"
      :loading="status === 'pending'"
    />
  </UForm>
</template>
