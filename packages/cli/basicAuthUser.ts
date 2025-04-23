import { connect } from '@carble/db'
import { fields, projects } from '@carble/db/schema'
import { createId } from '@paralleldrive/cuid2'
import { ArgsDef, defineCommand, runMain, showUsage } from 'citty'
import { inArray } from 'drizzle-orm'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

const basicAuthUserSchema = z.array(
  z.object({
    id: z.number(),
    password: z.string().default(createId),
  })
  .transform(({ id, password }) => ({
    username: `project-${id}`,
    password,
  }))
)

const basicAuthProjectIdSchema = z.array(
  z.object({
    username: z.string().startsWith('project-'),
    password: z.string(),
  })
  .transform(({ username }) => username.replace('project-', ''))
  .pipe(z.coerce.number())
)

const pathArgs = {
  dbPath: {
    type: 'string',
    default: process.env.DB_PATH ?? resolve(__dirname, '../storage/dev.db'),
  },
  storagePath: {
    type: 'string',
    default: process.env.DB_PATH ? resolve(process.env.DB_PATH, '../') : resolve(__dirname, '../storage'),
  },
} as const satisfies ArgsDef

const generate = defineCommand({
  args: {
    ...pathArgs,
    count: {
      type: 'string',
      default: '100',
    },
  },
  setup: ({ args }) => {
    if (!Number.isInteger(Number(args.count))) {
      throw `Invalid value for argument: \`--count\` (\`${args.count}\`). Expected a number.`
    }
  },
  run: async ({ args }) => {
    await connect(args.dbPath).transaction(async (tx) => {
      const maxProject = await tx.query.projects.findFirst({
        orderBy: ({ id }, { desc }) => desc(id),
      })
      const maxProjectId = maxProject?.id ?? 0

      const insertProjectValues = Array.from({ length: Number(args.count) }).map((_, i) => ({
        id: maxProjectId + 1 + i,
        name: `プロジェクト${maxProjectId + i + 1}`,
      }))
      const insertFieldValues = insertProjectValues.flatMap(({ id: projectId }) => [
        {
          projectId,
          name: 'みだし',
          order: 1,
        },
        {
          projectId,
          name: 'メモ',
          order: 2,
        },
      ])

      await tx.insert(projects).values(insertProjectValues)
      await tx.insert(fields).values(insertFieldValues)

      const jsonPath = resolve(args.storagePath, './basicauth-users.json')
      const existsUsers = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, { encoding: 'utf8' })) : []
      const users = [
        ...existsUsers,
        ...basicAuthUserSchema.parse(insertProjectValues),
      ]

      writeFileSync(resolve(args.storagePath, './basicauth-users.json'), JSON.stringify(users, null, 2))
      writeFileSync('./basicauth-users.csv', users.map((user) => `${user.username},${user.password}`).join('\n'))
    })
  },
})

const clean = defineCommand({
  args: {
    ...pathArgs,
  },
  run: async ({ args }) => {
    const jsonPath = resolve(args.storagePath, './basicauth-users.json')
    if (!existsSync(jsonPath)) throw `\`${jsonPath}\` does not exist.`

    const data = JSON.parse(readFileSync(jsonPath, { encoding: 'utf8' }))
    const projectIds = basicAuthProjectIdSchema.parse(data)

    await connect(args.dbPath).transaction(async (tx) => {
      await tx.delete(projects)
        .where(inArray(projects.id, projectIds))

      unlinkSync(jsonPath)
    })
  },
})

const main = defineCommand({
  subCommands: {
    generate,
    clean,
  },
  run: async ({ args }) => {
    if (!args._.length) {
      await showUsage(main)
    } else {
      console.log('done.')
    }
  },
})

runMain(main)
