<script setup lang="ts">
const emit = defineEmits<{
  upload: []
}>()

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
} = useAsyncStatus(async () => {
  const file = files.value?.item(0)
  if (!file) return

  emit('upload')

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

  clearNuxtData(getFetchProjectKey())
  await refreshNuxtData(getFetchProjectImportsInProgressKey())
  await navigateTo(`/projects/${projectId}`)
}, {
  immediate: false,
})

onChange(async (files) => {
  if (files?.length) {
    await execute()
    reset()
  }
})
</script>

<template>
  <div>
    <div>
      <p>xlsx,csv,zipファイルのいずれか（600MBまで）を選択してください。</p>
      <ul>
        <li><var>ID</var>列に入力された数値と同IDのカードが存在する場合、そのカードの内容を上書きします</li>
        <li>zipファイルを選択し、かつ<var>画像ファイル</var>列が存在する場合、列で指定された画像ファイルを取り込みます</li>
      </ul>
    </div>
    <UButton
      label="ファイルを選択"
      icon="i-material-symbols-light-upload"
      size="xl"
      :loading="status === 'pending'"
      class="mx-auto"
      @click="open"
    />
  </div>
</template>
