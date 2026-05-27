import { z } from "zod";

export const MoodScoreSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type MoodScore = z.infer<typeof MoodScoreSchema>;

export const LifeAreasSchema = z.object({
  health: z.number().min(1).max(10),
  relationships: z.number().min(1).max(10),
  work: z.number().min(1).max(10),
  learning: z.number().min(1).max(10),
});
export type LifeAreas = z.infer<typeof LifeAreasSchema>;

export const JournalEntrySchema = z.object({
  id: z.string(),
  date: z.string(), // YYYY-MM-DD
  mood: z.number(),
  mood_notes: z.string().nullable(),
  gratitude: z.array(z.string()),
  life_areas: z.string(), // serialized JSON string of LifeAreas
  created_at: z.number(),
  updated_at: z.number(),
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

export const ReviewSchema = z.object({
  id: z.string(),
  period: z.string(), // YYYY-Www or YYYY-MM
  type: z.enum(["weekly", "monthly"]),
  responses: z.string(), // serialized JSON string of responses
  created_at: z.number(),
  updated_at: z.number(),
});
export type Review = z.infer<typeof ReviewSchema>;

export interface SaveJournalInput {
  date: string;
  mood: number;
  mood_notes: string | null;
  gratitude: string[];
  life_areas: string;
}

export interface SaveReviewInput {
  period: string;
  type: "weekly" | "monthly";
  responses: string;
}
