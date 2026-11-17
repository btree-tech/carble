import type { Page } from '@playwright/test'
import type { Account } from '../support/db'
import type { ProductApi, Project, Card } from '../support/api'
import { createSampleProject, VISUAL_NAMES, visualUsername } from '../support/visual'
import { test as base } from './index'

type VisualFixtures = {
  /** 名前を固定したオーナー（VRT の画面に写る名前を毎回同じにする） */
  visualOwner: Account
  visualPage: Page
  visualApi: ProductApi
  /** visualOwner の見本のプロジェクト（support/visual.ts の createSampleProject） */
  sample: { project: Project, cards: Card[] }
}

/** VRT（*.visual.spec.ts）のテスト */
export const test = base.extend<VisualFixtures>({
  visualOwner: async ({ newAccount }, use) => {
    await use(await newAccount({ suffix: 'owner', username: visualUsername('owner'), name: VISUAL_NAMES.owner }))
  },

  visualPage: async ({ pageAs, visualOwner }, use) => {
    await use(await pageAs(visualOwner))
  },

  visualApi: async ({ apiAs, visualOwner }, use) => {
    await use(await apiAs(visualOwner))
  },

  sample: async ({ visualApi, visualPage }, use) => {
    await use(await createSampleProject(visualApi, visualPage))
  },
})

export { expect } from '@playwright/test'
