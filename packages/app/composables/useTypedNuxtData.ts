import type { z } from 'zod'

export default function<Schema extends z.ZodTypeAny>(key: string, nullable = false) {
  const result = useNuxtData<z.infer<Schema>>(key)
  if (!nullable && result.data === null) {
    throw new Error(`Return value of useNuxtData(${key}) is null`)
  }
  return {
    data: result.data as Ref<z.infer<Schema>>,
  }
}
