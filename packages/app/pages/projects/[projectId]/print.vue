<script setup lang="ts">
const { data: project } = await useFetchProject()

const { data: cards } = await useFetchCards()
</script>

<template>
  <div
    v-if="project"
    class="
      grid gap-x-8 gap-y-4 max-h-dvh grid-rows-[auto,auto,1fr,auto]
      landscape:px-4
      print:hidden
    "
  >
    <div
      class="
        flex items-center gap-x-4
        portrait:px-4
      "
    >
      <div class="grow truncate">
        {{ project.name }}
      </div>
    </div>
    <div
      class="
        flex items-center gap-x-4
        landscape:col-span-2
        portrait:px-4
      "
    >
      <UButton
        icon="i-material-symbols-light-table-view"
        :to="`/projects/${project.id}`"
        variant="outline"
      >
        <span class="hidden md:inline">テーブルビュー</span>
      </UButton>
    </div>
    <PrintViewRenderer :cards="cards" />
  </div>
</template>
