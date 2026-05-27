import { z } from "zod";

export const FileAttachmentSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  path: z.string(),
  mime_type: z.string(),
  size_bytes: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
  tags: z.array(z.string()),
  metadata: z.string(),
});
export type FileAttachment = z.infer<typeof FileAttachmentSchema>;

export const PdfAnnotationSchema = z.object({
  id: z.string(),
  file_id: z.string(),
  page: z.number().int().nonnegative(),
  text: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  color: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
});
export type PdfAnnotation = z.infer<typeof PdfAnnotationSchema>;
