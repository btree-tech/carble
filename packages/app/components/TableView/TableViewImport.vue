<script setup lang="ts">
const isOpen = defineModel<boolean>()

const { projectId } = useRoute().params

const { files, open, reset, onChange } = useFileDialog({
  accept: [
    'application/zip',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ].join(','),
  multiple: false,
})

const {
  execute,
  status,
  error,
} = useAsyncData(async () => {
  const file = files.value?.item(0)
  if (!file) return

  const formData = new FormData()
  formData.append('file', file)

  await $fetch(`/api/projects/${projectId}/import`, {
    method: 'put',
    body: formData,
  })
}, {
  immediate: false,
})

const errorMessage = computed(() => JSON.parse((error.value?.data as any)?.message))

onChange(async (files) => {
  if (!files?.length) return

  await execute()
  if (status.value === 'success') {
    await refreshNuxtData([FetchProjectKey, getFetchCardsKey(projectId)])
    isOpen.value = false
  }

  reset()
})
</script>

<template>
  <UModal
    v-model="isOpen"
    :prevent-close="status === 'pending'"
  >
    <UCard>
      <template #header>インポート</template>

      <div class="grid grid-cols-1 gap-y-4">
        <div class="prose dark:prose-invert">
          <p>xlsx,csv,zipファイルのいずれかを選択してください。</p>
          <ul>
            <li><var>ID</var>列に入力された数値と同IDのカードが存在する場合、そのカードの内容を上書きします</li>
            <li>zipファイルを選択し、かつ<var>画像ファイル</var>列が存在する場合、列で指定された画像ファイルを取り込みます</li>
          </ul>
        </div>
        <div class="text-center">
          <UButton
            label="ファイルを選択"
            icon="i-material-symbols-light-upload"
            size="xl"
            :loading="status === 'pending'"
            class="mx-auto"
            @click="open"
          />
        </div>
        <UAlert
          v-if="status === 'error'"
          color="red"
          title="エラーがあります"
        >
          <template #description>
            <ul class="list-inside list-disc">
              <li
                v-for="message in errorMessage"
                :key="message"
              >
                {{ message }}
              </li>
            </ul>
          </template>
        </UAlert>
      </div>
    </UCard>
  </UModal>
</template>
