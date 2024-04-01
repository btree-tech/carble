<script setup lang="ts">
const items = [[
  {
    label: 'インポート',
    icon: 'i-material-symbols-light-upload',
    click: () => {},
  },
  {
    label: 'エクスポート',
    icon: 'i-material-symbols-light-download',
    click: () => {},
  },
  {
    label: 'プロジェクト削除',
    icon: 'i-material-symbols-light-delete',
    click: () => {},
  }
]]
</script>

<template>
  <UDropdown :items="items">
    <UButton
      icon="i-material-symbols-light-more-horiz"
      color="gray"
    />
  </UDropdown>
</template>
