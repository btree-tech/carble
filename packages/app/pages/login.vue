<script setup lang="ts">
import logoImage from 'assets/logo.svg'

const signIn = async () => {
  await authClient.signIn.social({
    provider: 'google',
    callbackURL: '/',
    newUserCallbackURL: '/users/new',
  })
}
</script>

<template>
  <div class="py-8">
    <HeaderMenu>
      <h1><logoImage class="fill-zinc-500" /></h1>
    </HeaderMenu>
    <div class="flex place-content-center">
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
