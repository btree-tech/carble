<script setup lang="ts">
const signIn = async () => {
  await authClient.signIn.social({
    provider: 'google',
    callbackURL: '/',
    newUserCallbackURL: '/users/new',
  })
}
</script>

<template>
  <div class="">
    <HeaderMenu />
    <div>
      <UButton
        label="Googleでログイン"
        icon="i-logos-google-icon"
        color="white"
        size="xl"
        @click="signIn"
      />
    </div>
  </div>
</template>
