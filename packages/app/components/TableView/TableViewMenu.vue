<script setup lang="ts">
import type { DropdownItem } from '#ui/types'

const { projectId } = useRoute().params

const { data: project } = useProjectData()

const exportLink = ref<HTMLAnchorElement>()

const formattedNow = useDateFormat(useNow(), 'YYYYMMDDHHmmss')

const items = [[
  {
    label: 'インポート',
    icon: 'i-material-symbols-light-upload',
    click: () => {
      importModalIsOpen.value = true
    },
  },
  {
    label: 'インポート履歴',
    icon: 'i-material-symbols-light-history',
    to: `/projects/${projectId}/imports`,
  },
  {
    label: 'エクスポート',
    icon: 'i-material-symbols-light-download',
    click: () => {
      if (exportLink.value) {
        exportLink.value.click()
      }
    },
  },
]] satisfies DropdownItem[][]

const importModalIsOpen = ref(false)
</script>

<template>
  <div>
    <UDropdown :items="items">
      <UButton
        icon="i-material-symbols-light-more-horiz"
        color="gray"
      />
    </UDropdown>

    <TableViewImport v-model="importModalIsOpen" />

    <ClientOnly>
      <a
        ref="exportLink"
        :href="`/api/projects/${projectId}/export`"
        :download="`${project.name}-${formattedNow}.zip`"
      />
    </ClientOnly>
  </div>
</template>
