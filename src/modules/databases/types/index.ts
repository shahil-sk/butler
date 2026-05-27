import { z } from "zod";

export const ColumnTypeSchema = z.enum(["text", "number", "date", "select", "relation"]);
export type ColumnType = z.infer<typeof ColumnTypeSchema>;

export const DatabaseColumnSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: ColumnTypeSchema,
  options: z.array(z.string()).optional(),
  related_table_id: z.string().optional(),
});
export type DatabaseColumn = z.infer<typeof DatabaseColumnSchema>;

export const DatabaseTableSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  columns: z.string(), // JSON string of DatabaseColumn[]
  project_id: z.string().nullable().optional(),
  created_at: z.number(),
  updated_at: z.number(),
  tags: z.array(z.string()),
  metadata: z.string(),
});
export type DatabaseTable = z.infer<typeof DatabaseTableSchema>;

export const DatabaseRecordSchema = z.object({
  id: z.string(),
  table_id: z.string(),
  values_json: z.string(), // JSON string of Record<string, any>
  created_at: z.number(),
  updated_at: z.number(),
  tags: z.array(z.string()),
  metadata: z.string(),
});
export type DatabaseRecord = z.infer<typeof DatabaseRecordSchema>;

export interface CreateDatabaseTableInput {
  name: string;
  columns: DatabaseColumn[];
  project_id?: string | null;
  tags: string[];
}

export interface CreateDatabaseRecordInput {
  table_id: string;
  values: Record<string, any>;
  tags: string[];
}
