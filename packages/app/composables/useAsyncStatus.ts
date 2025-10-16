import type { AsyncDataRequestStatus } from '#app'
import type { UseAsyncStateOptions } from '@vueuse/core'

interface Options<Deep extends boolean = false, D = any> extends UseAsyncStateOptions<true, D> {
  default?: MaybeRef<D>
  deep?: Deep
}

export default function<
  Params extends any[] = any[],
  Deep extends boolean = false,
> (
  promise: Promise<unknown> | ((...args: Params) => Promise<unknown>),
  options?: Options<Deep>
) {
  const asyncState = useAsyncState(promise, options?.default, {
    ...options,
    shallow: options?.deep !== undefined ? options.deep : options?.shallow,
  })

  const status = computed<AsyncDataRequestStatus>(() => {
    if (asyncState.isLoading) return 'pending'
    if (asyncState.error) return 'error'
    if (asyncState.isReady) return 'success'
    return 'idle'
  })

  return {
    ...asyncState,
    status,
  }
}
