<script setup lang="ts">
import { users } from '@carble/db/schema'
import { createUpdateSchema } from 'drizzle-zod'
import type { z } from 'zod'

const session = authClient.useSession()

const {
  status: updateStatus,
  execute: update,
} = useAsyncStatus(async () => {
  if (form.value?.errors.length) return

  await authClient.updateUser({
    ...input.value,
  })
  await navigateTo('/')
}, { immediate: false })

const {
  state: isAvailable,
  status: isAvailableStatus,
  execute: executeIsAvailable,
} = useAsyncStatus(async () => {
  if (!input.value.username) return true
  if (input.value.username === session.value.data?.user.username) return true
  const { data } = await authClient.isUsernameAvailable({
    username: input.value.username,
  })
  return data?.available
}, { immediate: false })

const form = useTemplateRef('form')

const schema = createUpdateSchema(users, {
  name: (s) => s.min(1, { message: '必須です' }),
  username: (s) => s
    .min(3, { abort: true, message: '3文字以上30文字以下で設定してください' })
    .max(30, { abort: true, message: '3文字以上30文字以下で設定してください' })
    .regex(/^[a-zA-Z0-9_]+$/, { abort: true, message: '利用できない文字が含まれています' })
    .superRefine(async (_, context) => {
      await executeIsAvailable()
      if (!isAvailable.value) {
        context.addIssue({
          code: 'custom',
          message: '既に使われています',
        })
      }
    }),
}).pick({
  name: true,
  username: true,
}).default({
  name: '',
  username: '',
})

const input = ref<z.infer<typeof schema>>({
  name: '',
  username: '',
})

watch(
  () => session.value.data?.user,
  async (data) => {
    if (!data) return
    input.value = await schema.parseAsync(data)
  },
  {
    immediate: true,
    deep: true,
  },
)
</script>

<template>
  <UForm
    ref="form"
    :schema="schema"
    :state="input"
    class="w-96 space-y-6 mx-auto"
    @submit="update"
  >
    <UFormGroup
      name="username"
      label="ユーザーID"
      help="利用可能な文字: 半角英数およびハイフン（-）"
      eager-validation
    >
      <UInput
        v-model="input.username!"
        placeholder="carble"
        :loading="isAvailableStatus === 'pending'"
        trailing
      />
    </UFormGroup>
    <UFormGroup
      label="名前"
      name="name"
      eager-validation
    >
      <UInput
        v-model="input.name"
      />
    </UFormGroup>
    <UButton
      type="submit"
      label="保存"
      :disabled="!!form?.errors.length"
      :loading="updateStatus === 'pending'"
      block
    />
  </UForm>
</template>
