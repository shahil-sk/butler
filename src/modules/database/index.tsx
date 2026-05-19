/**
 * index.tsx — Module entry + manifest export.
 * Follows Butler module architecture pattern exactly.
 */
import React, { lazy } from 'react';
import type { ModuleManifest } from '@/shared/types/module';

const DatabasePage = lazy(() =>
  import('./ui/DatabasePage').then(m => ({ default: m.DatabasePage }))
);

// Database list / home screen
const DatabaseListPage = lazy(() =>
  import('./ui/DatabaseListPage').then(m => ({ default: m.DatabaseListPage }))
);

export const databaseManifest: ModuleManifest = {
  id: 'database',
  name: 'Database',
  icon: 'Table2',
  routes: [
    {
      path: '/database',
      element: <DatabaseListPage />,
    },
    {
      path: '/database/:id',
      element: <DatabasePage db_id="" />, // db_id injected by router via useParams inside component
    },
  ],
  commands: [
    {
      id: 'database.new',
      label: 'New Database',
      icon: 'Plus',
      shortcut: [],
      action: () => {
        // Handled by DatabaseListPage's create flow
        window.dispatchEvent(new CustomEvent('butler:database:new'));
      },
    },
    {
      id: 'database.open',
      label: 'Open Databases',
      icon: 'Table2',
      shortcut: [],
      action: () => {
        window.location.hash = '/database';
      },
    },
  ],
  shortcuts: [],
};

export { DatabasePage } from './ui/DatabasePage';
export { DATABASE_MIGRATIONS } from './db';
export * from './types';
