import { z } from "zod";

export const DocumentTemplateSchema = z.enum(["prd", "sop", "meeting_notes", "proposal", "none"]);
export type DocumentTemplate = z.infer<typeof DocumentTemplateSchema>;

export const DocumentSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  content: z.string(),
  parent_id: z.string().nullable().optional(),
  template: DocumentTemplateSchema,
  project_id: z.string().nullable().optional(),
  created_at: z.number(),
  updated_at: z.number(),
  tags: z.array(z.string()),
  metadata: z.string(),
});

export type Document = z.infer<typeof DocumentSchema>;

export interface CreateDocumentInput {
  title: string;
  content: string;
  parent_id?: string | null;
  template: DocumentTemplate;
  project_id?: string | null;
  tags: string[];
  metadata?: string;
}
