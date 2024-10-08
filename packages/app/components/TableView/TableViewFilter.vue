<script setup lang="ts">
const query = defineModel<string>({ default: '' })

const input = ref('')
</script>

<template>
  <form @submit.prevent="query = input">
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
          @click="query = input = ''"
        />
      </template>
    </UInput>
  </form>
</template>
