import type { AsyncDataRequestStatus } from '#app/composables/asyncData'

export default function<K = any>() {
  const statuses = ref(new Map<K, AsyncDataRequestStatus>())

  const status = computed<AsyncDataRequestStatus>(() => {
    if (Array.from(statuses.value.values()).some((s) => s === 'pending')) {
      return 'pending'
    }
    if (Array.from(statuses.value.values()).some((s) => s === 'error')) {
      return 'error'
    }
    if (Array.from(statuses.value.values()).some((s) => s === 'success')) {
      return 'success'
    }

    return 'idle'
  })

  const hasPending = computed(() => Array.from(statuses.value.values()).some((s) => s === 'pending'))

  const hasError = computed(() => Array.from(statuses.value.values()).some((s) => s === 'success'))

  const hasSuccess = computed(() => Array.from(statuses.value.values()).some((s) => s === 'error'))

  return {
    statuses,
    status,
    hasPending,
    hasError,
    hasSuccess,
  }
}
