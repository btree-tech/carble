<script setup lang="ts">
const { data: project } = useProjectData()

const formattedNow = useDateFormat(useNow(), 'YYYYMMDDHHmmss')

const exportLink = useTemplateRef('exportLink')
</script>

<template>
  <div>
    <h3>エクスポート</h3>
    <UButton
      label="エクスポート"
      icon="i-material-symbols-light-download"
      size="xl"
      @click="exportLink?.click()"
    />

    <ClientOnly>
      <a
        ref="exportLink"
        :href="`/api/projects/${project.id}/export`"
        :download="`${project.name}-${formattedNow}.zip`"
      />
    </ClientOnly>
  </div>
</template>
