<script setup lang="ts">
const {
  data: project,
} = await useFetchProject()

const { data: cards } = await useFetchCards()
</script>

<template>
  <PrintView :cards="cards">
    <template #header-nav>
      <UButton
        icon="i-material-symbols-light-table-view"
        :to="`/projects/${project?.id}`"
        variant="outline"
      >
        <span class="hidden md:inline">テーブルビュー</span>
      </UButton>
    </template>
  </PrintView>
</template>
