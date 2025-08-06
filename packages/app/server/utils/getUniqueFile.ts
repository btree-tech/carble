import { createId } from '@paralleldrive/cuid2'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export default function getUniqueFile(dir: string, suffix = '') {
  const result = {
    name: '',
    path: '',
  }

  do {
    result.name = `${createId()}${suffix}`
    result.path = resolve(dir, result.name)
  } while (existsSync(result.path))

  return result
}
