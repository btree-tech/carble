<script setup lang="ts">
const { projectId } = useRoute().params

const { data: project } = useProjectData()

const exportLink = ref<HTMLAnchorElement>()

const formattedNow = useDateFormat(useNow(), 'YYYYMMDDHHmmss')

const items = [[
  {
    label: 'インポート',
    icon: 'i-material-symbols-light-upload',
    click: () => {},
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
  {
    label: 'プロジェクト削除',
    icon: 'i-material-symbols-light-delete',
    click: () => {},
  }
]]
</script>

<template>
  <div>
    <UDropdown :items="items">
      <UButton
        icon="i-material-symbols-light-more-horiz"
        color="gray"
      />
    </UDropdown>

    <a
      ref="exportLink"
      :href="`/api/projects/${projectId}/export`"
      :download="`${project.name}-${formattedNow}.zip`"
    />
  </div>
</template>
