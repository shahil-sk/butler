import { z } from "zod";

export const NoteSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  content: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
  tags: z.array(z.string()),
  metadata: z.string(),
});

export type Note = z.infer<typeof NoteSchema>;

export const NoteLinkSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  target_id: z.string(),
});

export type NoteLink = z.infer<typeof NoteLinkSchema>;

export const BacklinkSchema = z.object({
  id: z.string(),
  title: z.string(),
});

export type Backlink = z.infer<typeof BacklinkSchema>;

export interface CreateNoteInput {
  title: string;
  content: string;
  tags: string[];
  metadata: string;
}
