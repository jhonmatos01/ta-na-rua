import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();

export const municipalities = pgTable(
  'municipalities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 150 }).notNull(),
    state: char('state', { length: 2 }).notNull(),
    ibgeCode: varchar('ibge_code', { length: 7 }).notNull(),
    latitude: numeric('latitude', { precision: 9, scale: 6 }).notNull(),
    longitude: numeric('longitude', { precision: 9, scale: 6 }).notNull(),
    active: boolean('active').default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('municipalities_ibge_code_uidx').on(table.ibgeCode),
    index('municipalities_state_name_idx').on(table.state, table.name),
    check('municipalities_latitude_chk', sql`${table.latitude} BETWEEN -90 AND 90`),
    check('municipalities_longitude_chk', sql`${table.longitude} BETWEEN -180 AND 180`),
  ],
);

export const neighborhoods = pgTable(
  'neighborhoods',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    municipalityId: uuid('municipality_id')
      .notNull()
      .references(() => municipalities.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    slug: varchar('slug', { length: 180 }).notNull(),
    active: boolean('active').default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('neighborhoods_municipality_slug_uidx').on(table.municipalityId, table.slug),
    index('neighborhoods_municipality_idx').on(table.municipalityId),
    index('neighborhoods_name_idx').on(table.name),
    index('neighborhoods_slug_idx').on(table.slug),
  ],
);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 140 }).notNull(),
    description: text('description').notNull(),
    icon: varchar('icon', { length: 120 }),
    active: boolean('active').default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('categories_code_uidx').on(table.code),
    uniqueIndex('categories_slug_uidx').on(table.slug),
    index('categories_active_name_idx').on(table.active, table.name),
  ],
);

export const departments = pgTable(
  'departments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    municipalityId: uuid('municipality_id')
      .notNull()
      .references(() => municipalities.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    active: boolean('active').default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('departments_municipality_name_uidx').on(table.municipalityId, table.name),
    index('departments_municipality_active_idx').on(table.municipalityId, table.active),
  ],
);
