<script setup lang="ts">
const { data: query } = useCardsQuery()

const input = ref(query.value)

const execute = async (value = input.value) => {
  await navigateTo(`?q=${value}&sort=${useCardsSortId().data.value}&direction=${useCardsSortDirection().data.value}`)
}

watch(
  query,
  () => {
    input.value = query.value
  }
)

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
    <div class="text-gray-500 dark:text-gray-400 hidden md:block">
      <span v-if="query === ''">全 {{ cards.total }} 件</span>
      <span v-else>{{ cards.items.length }} / {{ cards.total }} 件表示中</span>
    </div>
  </form>
</template>
