import type { Migration } from '@/kernel/db';
import schemaSql from './schema.sql?raw';

export const DATABASE_MIGRATIONS: Migration[] = [
  {
    version: 1,
    module: 'database',
    up: schemaSql,
    down: `
      DROP TRIGGER IF EXISTS db_cells_au;
      DROP TRIGGER IF EXISTS db_cells_ad;
      DROP TRIGGER IF EXISTS db_cells_ai;
      DROP TABLE IF EXISTS db_fts;
      DROP TABLE IF EXISTS db_cells;
      DROP TABLE IF EXISTS db_views;
      DROP TABLE IF EXISTS db_rows;
      DROP TABLE IF EXISTS db_columns;
      DROP TABLE IF EXISTS databases;
    `,
  },
];
