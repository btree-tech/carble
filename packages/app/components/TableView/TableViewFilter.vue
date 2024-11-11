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
</script>

<template>
  <form @submit.prevent="execute()">
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
  </form>
</template>
