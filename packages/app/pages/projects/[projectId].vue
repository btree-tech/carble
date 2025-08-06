<script setup lang="ts">
const isTableViewPage = computed(() => {
  return [
    'projects-projectId',
    'projects-projectId-imports',
  ].includes(useRoute().name as string)
})
</script>

<template>
  <TableViewGateImport
    :class="[
      'grid-cols-subgrid col-span-3 !col-start-1',
      {
        'grid-rows-[0,1fr] !gap-y-0': !isTableViewPage,
      },
    ]"
  >
    <TableView
      :class="{
        'col-span-3 grid grid-cols-1 grid-rows-subgrid row-span-3 py-4': isTableViewPage,
        'h-0 overflow-hidden': !isTableViewPage,
      }"
    />
    <NuxtPage class="col-start-2 grid grid-rows-[auto,1fr,auto] max-h-dvh py-4" />
  </TableViewGateImport>
</template>
