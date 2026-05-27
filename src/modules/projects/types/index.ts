import { z } from "zod";

export const ProjectStatusSchema = z.enum(["active", "on-hold", "completed", "archived"]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  status: ProjectStatusSchema,
  budget_hours: z.number().nonnegative().default(0),
  created_at: z.number(),
  updated_at: z.number(),
  tags: z.array(z.string()),
  metadata: z.string(),
});

export type Project = z.infer<typeof ProjectSchema>;

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  status: ProjectStatus;
  budget_hours: number;
  tags: string[];
  metadata?: string;
}
