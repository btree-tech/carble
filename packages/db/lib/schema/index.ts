import { relations } from 'drizzle-orm'
import { foreignKey, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { accounts, sessions, users } from './auth'

export * from './auth'

const timestamps = {
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}

export const usersToProjects = sqliteTable('usersToProjects', {
  userId: text('userId').notNull().references(() => users.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  projectId: integer('projectId').notNull().references(() => projects.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  role: text('role', { enum: ['owner'] }),
  status: text('status', { enum: ['invited'] }),
  ...timestamps,
}, ({ userId, projectId, role, status, createdAt }) => [
  primaryKey({ columns: [userId, projectId] }),
  index('usersToProjects_role_index').on(role),
  index('usersToProjects_status_index').on(status),
  index('usersToProjects_createdAt_index').on(createdAt),
])

export const usersToProjectsRelations = relations(usersToProjects, ({ one }) => ({
  project: one(projects, {
    fields: [usersToProjects.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [usersToProjects.userId],
    references: [users.id],
  }),
}))

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  projects: many(usersToProjects),
}))

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name'),
  ...timestamps,
})

export const projectsRelations = relations(projects, ({ many }) => ({
  users: many(usersToProjects),
  cards: many(cards),
  fields: many(fields),
  contents: many(contents),
  images: many(images),
  imports: many(imports),
}))

export const cards = sqliteTable('cards', {
  id: integer('id').notNull(),
  projectId: integer('projectId').notNull().references(() => projects.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  order: integer('order').notNull(),
  originalProjectId: integer('originalProjectId'),
  originalCardId: integer('originalCardId'),
  ...timestamps,
}, ({ projectId, id, order, originalProjectId, originalCardId }) => [
  primaryKey({ columns: [projectId, id] }),
  index('cards_projectId_order_index').on(projectId, order),
  foreignKey({
    columns: [originalProjectId, originalCardId],
    foreignColumns: [projectId, id],
  }).onUpdate('cascade').onDelete('set null'),
])

export const cardsRelations = relations(cards, ({ one, many }) => ({
  project: one(projects, {
    fields: [cards.projectId],
    references: [projects.id],
  }),
  contents: many(contents),
  images: many(images),
  original: one(cards, {
    fields: [cards.originalProjectId, cards.originalCardId],
    references: [cards.projectId, cards.id],
    relationName: 'duplicates',
  }),
  duplicates: many(cards, { relationName: 'duplicates' }),
}))

export const fields = sqliteTable('fields', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('projectId').notNull().references(() => projects.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  name: text('name'),
  isVisible: integer('isVisible', { mode: 'boolean' }).notNull().default(true),
  order: integer('order').notNull(),
  ...timestamps,
}, ({ projectId, order }) => [
  index('fields_projectId_order_index').on(projectId, order),
])

export const fieldsRelations = relations(fields, ({ one, many }) => ({
  project: one(projects, {
    fields: [fields.projectId],
    references: [projects.id],
  }),
  contents: many(contents),
}))

export const contents = sqliteTable('contents', {
  projectId: integer('projectId').notNull(),
  cardId: integer('cardId').notNull(),
  fieldId: integer('fieldId').notNull().references(() => fields.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  body: text('body'),
  ...timestamps,
}, ({ projectId, cardId, fieldId }) => [
  primaryKey({ columns: [projectId, cardId, fieldId] }),
  foreignKey({
    columns: [projectId, cardId],
    foreignColumns: [cards.projectId, cards.id],
  }).onUpdate('cascade').onDelete('cascade'),
])

export const contentsRelations = relations(contents, ({ one }) => ({
  project: one(projects, {
    fields: [contents.projectId],
    references: [projects.id],
  }),
  card: one(cards, {
    fields: [contents.projectId, contents.cardId],
    references: [cards.projectId, cards.id],
  }),
  field: one(fields, {
    fields: [contents.cardId],
    references: [fields.id],
  }),
}))

export const images = sqliteTable('images', {
  id: integer('id').notNull().primaryKey({ autoIncrement: true }),
  projectId: integer('projectId').notNull(),
  cardId: integer('cardId').notNull(),
  filename: text('filename').notNull().unique(),
  createdAt: timestamps.createdAt,
}, ({ projectId, cardId }) => [
  foreignKey({
    columns: [projectId, cardId],
    foreignColumns: [cards.projectId, cards.id],
  }).onUpdate('cascade').onDelete('cascade'),
])

export const imagesRelations = relations(images, ({ one }) => ({
  project: one(projects, {
    fields: [images.projectId],
    references: [projects.id],
  }),
  card: one(cards, {
    fields: [images.projectId, images.cardId],
    references: [cards.projectId, cards.id],
  }),
}))

export const imports = sqliteTable('imports', {
  id: integer('id').notNull().primaryKey({ autoIncrement: true }),
  projectId: integer('projectId').notNull().references(() => projects.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  originalFilename: text('originalFilename').notNull(),
  status: text('status', { enum: ['OPEN', 'IN_PROGRESS', 'DONE', 'ABORT', 'FORMAT_ERROR', 'SYSTEM_ERROR'] }).notNull(),
  message: text('message'),
  notifiedAt: integer('notifiedAt', { mode: 'timestamp' }),
  options: text('options', { mode: 'json' }).$type<{ update?: boolean }>().notNull().default({}),
  ...timestamps,
}, ({ status }) => [
  index('status_index').on(status),
])

export const importsRelations = relations(imports, ({ one }) => ({
  project: one(projects, {
    fields: [imports.projectId],
    references: [projects.id],
  }),
}))
