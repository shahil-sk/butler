// ============================================================
// TASKS MODULE — Natural Language Parser
// Parses strings like "finish report tomorrow 3pm #work !high"
// into structured task fields.
// ============================================================

import type { Priority } from "@/shared/types";

export interface ParsedTaskInput {
  title:      string;
  dueDate?:   string;   // ISO date "YYYY-MM-DD"
  startTime?: string;   // "HH:MM" (24h)
  projectSlug?: string; // raw "#tag" slug (caller resolves to ID)
  priority?:  Priority;
}

// ── helpers ──────────────────────────────────────────────────

function isoFromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const DAY_NAMES = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const MONTH_NAMES = [
  "jan","feb","mar","apr","may","jun",
  "jul","aug","sep","oct","nov","dec",
];

/** Next occurrence of a given weekday (0=Sun) at or after today */
function nextWeekday(targetDay: number): Date {
  const d = todayDate();
  const diff = (targetDay - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
  return d;
}

// ── token extractors ─────────────────────────────────────────

/** Extract priority token and return {priority, cleaned} */
function extractPriority(input: string): { priority?: Priority; cleaned: string } {
  let priority: Priority | undefined;

  const cleaned = input.replace(/!(\w+)/g, (_, tag) => {
    const t = tag.toLowerCase();
    if (t === "urgent" || t === "u") { priority = "urgent"; return ""; }
    if (t === "high"   || t === "h") { priority = "high";   return ""; }
    if (t === "medium" || t === "m") { priority = "medium"; return ""; }
    if (t === "low"    || t === "l") { priority = "low";    return ""; }
    return `!${tag}`; // not a priority, keep it
  });

  return { priority, cleaned };
}

/** Extract project slug and return {projectSlug, cleaned} */
function extractProjectSlug(input: string): { projectSlug?: string; cleaned: string } {
  let projectSlug: string | undefined;

  const cleaned = input.replace(/#(\w[\w-]*)/g, (_, slug) => {
    if (!projectSlug) projectSlug = slug.toLowerCase();
    return "";
  });

  return { projectSlug, cleaned };
}

/** Extract time token like "3pm", "15:00", "at 9am", "at 9" */
function extractTime(input: string): { startTime?: string; cleaned: string } {
  let startTime: string | undefined;

  const cleaned = input.replace(
    /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b|\b(\d{1,2}):(\d{2})\s*(am|pm)?\b|\b(\d{1,2})\s*(am|pm)\b/gi,
    (match, h1, m1, mer1, h2, m2, mer2, h3, mer3) => {
      let hours: number;
      let mins = 0;
      const period = (mer1 || mer2 || mer3 || "").toLowerCase();

      if (h1 !== undefined) {
        hours = parseInt(h1, 10);
        mins  = m1 ? parseInt(m1, 10) : 0;
      } else if (h2 !== undefined) {
        hours = parseInt(h2, 10);
        mins  = parseInt(m2, 10);
      } else {
        hours = parseInt(h3, 10);
        mins  = 0;
      }

      if (period === "pm" && hours !== 12) hours += 12;
      if (period === "am" && hours === 12) hours = 0;

      if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return match;

      startTime = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
      return "";
    }
  );

  return { startTime, cleaned };
}

/** Extract date tokens. Returns {dueDate, cleaned} */
function extractDate(input: string): { dueDate?: string; cleaned: string } {
  let dueDate: string | undefined;
  let cleaned = input;

  // today / tomorrow / next week
  cleaned = cleaned.replace(/\btoday\b/gi, () => { dueDate ??= isoFromDate(todayDate()); return ""; });
  cleaned = cleaned.replace(/\btomorrow\b/gi, () => {
    if (!dueDate) { const d = todayDate(); d.setDate(d.getDate() + 1); dueDate = isoFromDate(d); }
    return "";
  });
  cleaned = cleaned.replace(/\bnext week\b/gi, () => {
    if (!dueDate) { const d = todayDate(); d.setDate(d.getDate() + 7); dueDate = isoFromDate(d); }
    return "";
  });

  // Named weekday: "monday", "next friday"
  cleaned = cleaned.replace(/\b(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, (_, day) => {
    if (!dueDate) dueDate = isoFromDate(nextWeekday(DAY_NAMES.indexOf(day.toLowerCase())));
    return "";
  });

  // ISO date: 2024-01-15
  cleaned = cleaned.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (_, iso) => {
    if (!dueDate) dueDate = iso;
    return "";
  });

  // Month + day: "jan 15" or "15 jan"
  const monthDayRe = new RegExp(
    `\\b(${MONTH_NAMES.join("|")})\\s+(\\d{1,2})\\b|\\b(\\d{1,2})\\s+(${MONTH_NAMES.join("|")})\\b`,
    "gi"
  );
  cleaned = cleaned.replace(monthDayRe, (_, m1, d1, d2, m2) => {
    if (dueDate) return "";
    const monthStr = m1 ?? m2;
    const dayNum   = parseInt(d1 ?? d2, 10);
    const monthIdx = MONTH_NAMES.indexOf(monthStr.toLowerCase().slice(0, 3));
    if (monthIdx === -1 || isNaN(dayNum)) return _;
    const year = new Date().getFullYear();
    const candidate = new Date(year, monthIdx, dayNum);
    if (candidate < todayDate()) candidate.setFullYear(year + 1);
    dueDate = isoFromDate(candidate);
    return "";
  });

  return { dueDate, cleaned };
}

// ── main export ───────────────────────────────────────────────

/** Parse a natural language task string into structured fields. */
export function parseNaturalTaskInput(raw: string): ParsedTaskInput {
  let s = raw.trim();

  const { priority,    cleaned: s1 } = extractPriority(s);
  const { projectSlug, cleaned: s2 } = extractProjectSlug(s1);
  const { startTime,   cleaned: s3 } = extractTime(s2);
  const { dueDate,     cleaned: s4 } = extractDate(s3);

  // Clean up extra whitespace, commas, trailing punctuation
  const title = s4.replace(/\s{2,}/g, " ").replace(/[,;]+/g, " ").trim();

  return {
    title:       title || raw.trim(),
    dueDate,
    startTime,
    projectSlug,
    priority,
  };
}
