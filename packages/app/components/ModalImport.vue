<script setup lang="ts">
const isOpen = defineModel<boolean>()

const emit = defineEmits<{
  uploaded: [number]
}>()

const { files, open, onChange } = useFileDialog({
  accept: [
    'application/zip',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ].join(','),
  multiple: false,
  reset: true,
})

const {
  execute,
  status,
} = useAsyncData(async () => {
  const file = files.value?.item(0)
  if (!file) return

  const projectId = useRoute().params.projectId
    ? Number(useRoute().params.projectId)
    : (await $fetch(`/api/projects`, {
        method: 'post',
        body: {
          name: file.name,
        },
      })).id

  const formData = new FormData()
  formData.append('file', file)

  await $fetch(`/api/projects/${projectId}/imports`, {
    method: 'post',
    body: formData,
  })

  emit('uploaded', projectId)
}, {
  immediate: false,
})

onChange(async (files) => {
  if (!files?.length) return
  await execute()
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
          <p>xlsx,csv,zipファイルのいずれか（600MBまで）を選択してください。</p>
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
      </div>
    </UCard>
  </UModal>
</template>
