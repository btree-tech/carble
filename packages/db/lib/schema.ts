import { relations } from 'drizzle-orm'
import { foreignKey, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name'),
  ...timestamps,
})

export const projectsRelations = relations(projects, ({ many }) => ({
  cards: many(cards),
  fields: many(fields),
  contents: many(contents),
  images: many(images),
}))

export const cards = sqliteTable('cards', {
  id: integer('id').notNull(),
  projectId: integer('projectId').notNull().references(() => projects.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  createdAt: timestamps.createdAt,
}, ({ projectId, id }) => [
  primaryKey({ columns: [projectId, id] }),
])

export const cardsRelations = relations(cards, ({ one, many }) => ({
  project: one(projects, {
    fields: [cards.projectId],
    references: [projects.id],
  }),
  contents: many(contents),
  images: many(images),
}))

export const fields = sqliteTable('fields', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('projectId').notNull().references(() => projects.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  name: text('name'),
  isVisible: integer('isVisible', { mode: 'boolean' }).notNull().default(true),
  order: integer('order').notNull(),
  ...timestamps,
}, ({ projectId, order }) => [
  index('projectId_order_index').on(projectId, order),
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
