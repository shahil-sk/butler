/**
 * tests/service.test.ts — Unit tests for database service layer.
 * Mocks repository. Tests business logic only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Row, Column, View, RowWithCells } from '../types';

// ── Mock repository ───────────────────────────────────────────
vi.mock('../repository', () => ({
  listDatabases: vi.fn(),
  getDatabaseById: vi.fn(),
  insertDatabase: vi.fn(),
  updateDatabase: vi.fn(),
  deleteDatabase: vi.fn(),
  listColumns: vi.fn(),
  insertColumn: vi.fn(),
  updateColumn: vi.fn(),
  deleteColumn: vi.fn(),
  deleteCellsForColumn: vi.fn(),
  listRows: vi.fn(),
  getRowById: vi.fn(),
  insertRow: vi.fn(),
  updateRowPosition: vi.fn(),
  archiveRow: vi.fn(),
  deleteRow: vi.fn(),
  getCellsForRow: vi.fn(),
  getCellsForRows: vi.fn(),
  upsertCell: vi.fn(),
  listViews: vi.fn(),
  getViewById: vi.fn(),
  insertView: vi.fn(),
  updateView: vi.fn(),
  deleteView: vi.fn(),
  searchRows: vi.fn(),
}));

vi.mock('@/kernel/event-bus', () => ({
  eventBus: { emit: vi.fn() },
}));

vi.mock('@/shared/utils/nanoid', () => ({ nanoid: () => 'test-id' }));
vi.mock('@/shared/utils/time', () => ({ now: () => '2026-01-01T00:00:00.000Z' }));

import * as repo from '../repository';
import * as svc from '../service';

const mockDb = {
  id: 'db-1', name: 'Test DB', description: null, icon: null, cover: null,
  is_archived: false, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
};

const mockColumn = (overrides: Partial<Column> = {}): Column => ({
  id: 'col-1', database_id: 'db-1', name: 'Name', type: 'text',
  position: 0, width: 240, is_hidden: false, options: [],
  formula_expression: null, relation_target_db_id: null, rollup_column_id: null, rollup_fn: null,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const mockRow = (overrides: Partial<Row> = {}): Row => ({
  id: 'row-1', database_id: 'db-1', position: 0, is_archived: false,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const mockView = (overrides: Partial<View> = {}): View => ({
  id: 'view-1', database_id: 'db-1', name: 'Grid', type: 'grid',
  position: 0, filters: [], sorts: [], hidden_columns: [], group_by_column_id: null,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe('createDatabase', () => {
  it('inserts DB, default column, default view', async () => {
    vi.mocked(repo.insertDatabase).mockResolvedValue(mockDb);
    vi.mocked(repo.insertColumn).mockResolvedValue(mockColumn());
    vi.mocked(repo.insertView).mockResolvedValue(mockView());

    const result = await svc.createDatabase('Test DB');

    expect(repo.insertDatabase).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test DB' })
    );
    expect(repo.insertColumn).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Name', type: 'text', database_id: 'db-1' })
    );
    expect(repo.insertView).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Grid', type: 'grid', database_id: 'db-1' })
    );
    expect(result).toEqual(mockDb);
  });

  it('trims whitespace from name', async () => {
    vi.mocked(repo.insertDatabase).mockResolvedValue(mockDb);
    vi.mocked(repo.insertColumn).mockResolvedValue(mockColumn());
    vi.mocked(repo.insertView).mockResolvedValue(mockView());

    await svc.createDatabase('  Padded Name  ');
    expect(repo.insertDatabase).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Padded Name' })
    );
  });
});

describe('addColumn', () => {
  it('appends at end position', async () => {
    vi.mocked(repo.listColumns).mockResolvedValue([mockColumn(), mockColumn({ id: 'col-2', position: 1 })]);
    vi.mocked(repo.insertColumn).mockResolvedValue(mockColumn({ id: 'col-3', position: 2, name: 'Status', type: 'select' }));

    const col = await svc.addColumn('db-1', 'Status', 'select');

    expect(repo.insertColumn).toHaveBeenCalledWith(
      expect.objectContaining({ position: 2, name: 'Status', type: 'select' })
    );
    expect(col.type).toBe('select');
  });
});

describe('updateColumnWidth', () => {
  it('clamps width between 60 and 800', async () => {
    vi.mocked(repo.updateColumn).mockResolvedValue();

    await svc.updateColumnWidth('col-1', 10);
    expect(repo.updateColumn).toHaveBeenCalledWith('col-1', { width: 60 });

    await svc.updateColumnWidth('col-1', 9999);
    expect(repo.updateColumn).toHaveBeenCalledWith('col-1', { width: 800 });

    await svc.updateColumnWidth('col-1', 200);
    expect(repo.updateColumn).toHaveBeenCalledWith('col-1', { width: 200 });
  });
});

describe('addRow', () => {
  it('uses next position', async () => {
    vi.mocked(repo.listRows).mockResolvedValue([mockRow(), mockRow({ id: 'row-2', position: 1 })]);
    vi.mocked(repo.insertRow).mockResolvedValue(mockRow({ id: 'row-3', position: 2 }));

    const row = await svc.addRow('db-1');

    expect(repo.insertRow).toHaveBeenCalledWith(
      expect.objectContaining({ position: 2, database_id: 'db-1' })
    );
    expect(row.position).toBe(2);
  });
});

describe('getRowsWithCells — filtering', () => {
  it('equals filter keeps matching rows', async () => {
    const rows = [mockRow({ id: 'r1' }), mockRow({ id: 'r2' })];
    const cells = [
      { row_id: 'r1', column_id: 'col-1', value: 'Alice' },
      { row_id: 'r2', column_id: 'col-1', value: 'Bob' },
    ];
    vi.mocked(repo.listRows).mockResolvedValue(rows);
    vi.mocked(repo.getCellsForRows).mockResolvedValue(cells as any);

    const view = mockView({
      filters: [{ id: 'f1', column_id: 'col-1', operator: 'equals', value: 'Alice' }],
    });
    const columns = [mockColumn()];

    const result = await svc.getRowsWithCells('db-1', view, columns);
    expect(result).toHaveLength(1);
    expect(result[0].row.id).toBe('r1');
  });

  it('contains filter is case-insensitive', async () => {
    const rows = [mockRow({ id: 'r1' }), mockRow({ id: 'r2' })];
    const cells = [
      { row_id: 'r1', column_id: 'col-1', value: 'Hello World' },
      { row_id: 'r2', column_id: 'col-1', value: 'Goodbye' },
    ];
    vi.mocked(repo.listRows).mockResolvedValue(rows);
    vi.mocked(repo.getCellsForRows).mockResolvedValue(cells as any);

    const view = mockView({
      filters: [{ id: 'f1', column_id: 'col-1', operator: 'contains', value: 'world' }],
    });
    const result = await svc.getRowsWithCells('db-1', view, [mockColumn()]);
    expect(result).toHaveLength(1);
    expect(result[0].row.id).toBe('r1');
  });
});

describe('getRowsWithCells — sorting', () => {
  it('sorts asc by text', async () => {
    const rows = [mockRow({ id: 'r1', position: 0 }), mockRow({ id: 'r2', position: 1 })];
    const cells = [
      { row_id: 'r1', column_id: 'col-1', value: 'Zebra' },
      { row_id: 'r2', column_id: 'col-1', value: 'Apple' },
    ];
    vi.mocked(repo.listRows).mockResolvedValue(rows);
    vi.mocked(repo.getCellsForRows).mockResolvedValue(cells as any);

    const view = mockView({ sorts: [{ id: 's1', column_id: 'col-1', direction: 'asc' }] });
    const result = await svc.getRowsWithCells('db-1', view, [mockColumn()]);
    expect(result[0].row.id).toBe('r2'); // Apple first
    expect(result[1].row.id).toBe('r1'); // Zebra second
  });
});

describe('searchInDatabase', () => {
  it('returns empty array for blank query', async () => {
    const result = await svc.searchInDatabase('db-1', '   ');
    expect(result).toEqual([]);
    expect(repo.searchRows).not.toHaveBeenCalled();
  });

  it('maps matching row_ids to RowWithCells', async () => {
    vi.mocked(repo.searchRows).mockResolvedValue(['r1']);
    vi.mocked(repo.listRows).mockResolvedValue([mockRow({ id: 'r1' })]);
    vi.mocked(repo.getCellsForRows).mockResolvedValue([
      { row_id: 'r1', column_id: 'col-1', value: 'Found', id: 'c1', updated_at: '' },
    ]);

    const result = await svc.searchInDatabase('db-1', 'found');
    expect(result).toHaveLength(1);
    expect(result[0].cells['col-1']).toBe('Found');
  });
});
