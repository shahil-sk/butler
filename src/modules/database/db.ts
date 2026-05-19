import type { Migration } from '@/kernel/db';

// Read schema at build time via Vite's ?raw import
// (consistent with how other modules expose migrations)
import schemaSql from './schema.sql?raw';

export const DATABASE_MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: schemaSql,
  },
];
