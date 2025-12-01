<script setup lang="ts">
import type { DropdownItem } from '#ui/types'

const importModalIsOpen = ref(false)

const items = computed(() => [[
  {
    label: '空白のプロジェクト',
    icon: 'i-material-symbols-light-add',
    click: () => executeImmediate(),
  },
  {
    label: 'ファイルをインポート',
    icon: 'i-material-symbols-light:upload',
    click: () => importModalIsOpen.value = true
  }
]] satisfies DropdownItem[][])

const {
  executeImmediate,
  status,
} = useAsyncStatus(async () => {
  const project = await $fetch('/api/projects', {
    method: 'post',
    body: {
      fields: true,
    },
  })
  await navigateTo(`/projects/${project.id}`)
}, { immediate: false })

const onUploaded = async (projectId: number) => {
  await navigateTo(`/projects/${projectId}`)
}
</script>

<template>
  <div>
    <UDropdown :items="items">
      <UButton
        trailing-icon="i-material-symbols-light-arrow-drop-down"
        :loading="status === 'pending'"
      >
        <span class="hidden md:inline">新規プロジェクト</span>
      </UButton>
    </UDropdown>
    <ModalImport
      v-model="importModalIsOpen"
      @uploaded="onUploaded"
    />
  </div>
</template>
