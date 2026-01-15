import type { NuxtApp } from '#app'
import type { AsyncDataOptions, KeysOf } from '#app/composables/asyncData'
import type { DefaultAsyncDataValue } from '#app/defaults'

export default function<
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = DefaultAsyncDataValue,
>(
  key: MaybeRefOrGetter<string>,
  handler: (ctx?: NuxtApp) => Promise<ResT>,
  options?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>
) {
  return useAsyncData(key, handler, options)
}