<template>
  <Title>Carble</Title>
  <div
    class="
      grid grid-cols-[theme(spacing.4),1fr,theme(spacing.4)]
      xl:grid-cols-[1fr,1280px,1fr]
    "
  >
    <NuxtPage class="col-start-2 grid grid-rows-[auto,1fr,auto] gap-y-4 max-h-dvh print:py-0" />
  </div>
  <UNotifications />
</template>
