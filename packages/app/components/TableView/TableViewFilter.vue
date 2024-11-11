<script setup lang="ts">
const query = useCardsQuery()

const input = ref(query.value)

const execute = async (value = input.value) => {
  await navigateTo(`?q=${value}&sort=${useCardsSortId().value}&direction=${useCardsSortDirection().value}`)
}

watch(
  query,
  () => {
    input.value = query.value
  }
)

const { data: project } = useProjectData()

const { data: cards } = useCardsData()
</script>

<template>
  <form
    class="flex items-center gap-2"
    @submit.prevent="execute()"
  >
    <UInput
      v-model="input"
      icon="i-material-symbols-light-search"
      :ui="{ icon: { trailing: { pointer: '' } } }"
    >
      <template #trailing>
        <UButton
          v-show="input !== ''"
          color="gray"
          variant="link"
          icon="i-material-symbols-light-close"
          :padded="false"
          @click="execute('')"
        />
      </template>
    </UInput>
    <span class="text-gray-500 dark:text-gray-400">{{ cards.length }} / {{project.cards.length }} 件表示中</span>
  </form>
</template>
