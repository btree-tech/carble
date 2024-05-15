import { resolve } from 'node:path'

export default function resolveStoragePath(base: string, ...paths: string[]) {
  const basePath = useStorage().getMount(base).driver.options.base
  return resolve(basePath, ...paths)
}
