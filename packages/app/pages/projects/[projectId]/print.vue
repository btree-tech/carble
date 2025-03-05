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
    <div class="portrait:px-4">
      <UButton
        label="プロジェクト一覧に戻る"
        icon="i-material-symbols-light-door-open"
        to="/"
        variant="link"
        :padded="false"
      />
    </div>
    <div
      class="
        flex items-center gap-x-4
        portrait:px-4
      "
    >
      <div class="grow truncate">
        {{ project.name }}
      </div>
      <UButton
        icon="i-material-symbols-light-table-view"
        :to="`/projects/${project.id}`"
        variant="soft"
      >
        <span class="hidden md:inline">テーブルビュー</span>
      </UButton>
    </div>
    <PrintViewRenderer :cards="cards" />
  </div>
</template>
