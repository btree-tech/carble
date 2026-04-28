<script setup lang="ts">
const emit = defineEmits<{
  upload: []
}>()

const { files, open } = useFileDialog({
  accept: [
    'application/zip',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ].join(','),
  multiple: false,
})

const update = ref(false)

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
  formData.append('update', `${update.value}`)

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

const updateModalIsOpen = ref(false)
</script>

<template>
  <div>
    <div class="not-prose flex flex-col items-start gap-6">
      <UFormGroup>
        <label class="inline-flex items-center gap-2 cursor-pointer">
          <UButton
            label="ファイルを選択"
            color="gray"
            @click="open"
          />
          <span>
            {{ files?.item(0)?.name }}
          </span>
        </label>

        <template #help>
          <div>xlsx,csv,zipファイルのいずれか（600MBまで）を選択してください</div>
          <div>zipファイルを選択し、かつ<var>画像ファイル</var>列が存在する場合、列で指定された画像ファイルを取り込みます</div>
        </template>
      </UFormGroup>
      <UFormGroup v-if="$route.params.projectId">
        <UCheckbox
          v-model="update"
          label="同じIDのカードを上書きする"
          @change="updateModalIsOpen = true"
        />
      </UFormGroup>
      <UButton
        label="インポート"
        icon="i-material-symbols-light-upload"
        :disabled="!files?.length"
        :loading="status === 'pending'"
        @click="execute"
      />
    </div>

    <UModal
      v-if="update"
      v-model="updateModalIsOpen"
    >
      <UCard :ui="{ footer: { base: 'text-right' } }">
        ID列に入力された数値と同IDのカードが存在する場合、そのカードの内容を上書きします。<br>
        これからデータの更新を行います。現状のプロジェクトの状態を残しておきたい場合はバックアップを残しておくこと（プロジェクトデータの「エクスポート」）をお勧めします。

        <template #footer>
          <UButton
            label="OK"
            class="mx-auto"
            @click="updateModalIsOpen = false"
          />
        </template>
      </UCard>
    </UModal>
  </div>
</template>
