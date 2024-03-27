import { relations } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

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
}))

export const cards = sqliteTable('cards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('projectId').notNull().references(() => projects.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  number: integer('number').notNull(),
  createdAt: timestamps.createdAt,
}, ({ projectId, number }) => ({
  unique: unique().on(projectId, number),
}))

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
}, ({ projectId, order }) => ({
  orderIndex: index('projectId_order_index').on(projectId, order),
}))

export const fieldsRelations = relations(fields, ({ one, many }) => ({
  project: one(projects, {
    fields: [fields.projectId],
    references: [projects.id],
  }),
  contents: many(contents),
}))

export const contents = sqliteTable('contents', {
  cardId: integer('cardId').notNull().references(() => cards.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  fieldId: integer('fieldId').notNull().references(() => fields.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  body: text('body'),
  ...timestamps,
}, ({ cardId, fieldId }) => ({
  primaryKey: primaryKey({ columns: [cardId, fieldId] }),
}))

export const contentsRelations = relations(contents, ({ one }) => ({
  card: one(cards, {
    fields: [contents.cardId],
    references: [cards.id],
  }),
  field: one(fields, {
    fields: [contents.cardId],
    references: [fields.id],
  }),
}))

export const images = sqliteTable('images', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('projectId').notNull().references(() => projects.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  cardId: integer('cardId').notNull().references(() => cards.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  createdAt: timestamps.createdAt,
}, ({ projectId, cardId, filename }) => ({
  unique: unique().on(projectId, cardId, filename),
}))

export const imagesRelations = relations(images, ({ one }) => ({
  card: one(cards, {
    fields: [images.cardId],
    references: [cards.id],
  }),
}))
