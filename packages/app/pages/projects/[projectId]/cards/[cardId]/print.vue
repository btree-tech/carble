<script setup lang="ts">
const {
  cardId,
} = useRoute().params

const {
  data: project,
} = await useFetchProject()

const {
  data: card,
} = useCard(cardId)

const query = useCardsQueryString()
</script>

<template>
  <PrintView :cards="[card]">
    <template #header-nav>
      <UButton
        icon="i-material-symbols-light-table-view"
        :to="`/projects/${project?.id}?${query}`"
        variant="outline"
      >
        <span class="hidden md:inline">テーブルビュー</span>
      </UButton>
      <UButton
        icon="i-material-symbols-light-list-alt"
        :to="`/projects/${project?.id}/cards/${cardId}?${query}`"
        variant="outline"
      >
        <span class="hidden md:inline">カード入力ビュー</span>
      </UButton>
    </template>
  </PrintView>
</template>
