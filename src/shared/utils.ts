import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday, parseISO, addDays, addWeeks, addMonths, addYears } from "date-fns";
import type { ISODate, ISODateTime, ID, RecurrenceRule } from "./types";

// ── Styling ──────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── ID generation ────────────────────────────────────────────
// nanoid-compatible without the dep: crypto.randomUUID stripped to 21 chars

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

export function generateId(): ID {
  const bytes = crypto.getRandomValues(new Uint8Array(21));
  return Array.from(bytes)
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join("");
}

// ── Date helpers ─────────────────────────────────────────────

export function now(): ISODateTime {
  return new Date().toISOString();
}

export function today(): ISODate {
  return format(new Date(), "yyyy-MM-dd");
}

export function toISODate(date: Date): ISODate {
  return format(date, "yyyy-MM-dd");
}

export function fromISODate(date: ISODate): Date {
  return parseISO(date);
}

export function getNextRecurrenceDate(currentDateStr: string, rule: RecurrenceRule): string | undefined {
  const currentDate = parseISO(currentDateStr);
  const interval = rule.interval || 1;
  let nextDate = currentDate;

  switch (rule.frequency) {
    case "daily":
      nextDate = addDays(currentDate, interval);
      break;
    case "weekly":
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        const sortedDays = [...rule.daysOfWeek].sort((a, b) => a - b);
        const currentDay = currentDate.getDay();
        const nextDayInWeek = sortedDays.find((d) => d > currentDay);
        if (nextDayInWeek !== undefined) {
          nextDate = addDays(currentDate, nextDayInWeek - currentDay);
        } else {
          const firstDayOfList = sortedDays[0];
          const daysToNextWeek = (7 - currentDay) + firstDayOfList + (interval - 1) * 7;
          nextDate = addDays(currentDate, daysToNextWeek);
        }
      } else {
        nextDate = addWeeks(currentDate, interval);
      }
      break;
    case "monthly":
      if (rule.dayOfMonth && rule.dayOfMonth >= 1 && rule.dayOfMonth <= 31) {
        let currentMonthTarget = new Date(currentDate.getFullYear(), currentDate.getMonth(), rule.dayOfMonth);
        // ensure day isn't past end of month
        if (currentMonthTarget.getMonth() !== currentDate.getMonth()) {
          currentMonthTarget = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        }
        if (currentMonthTarget > currentDate) {
          nextDate = currentMonthTarget;
        } else {
          nextDate = addMonths(currentMonthTarget, interval);
        }
      } else {
        nextDate = addMonths(currentDate, interval);
      }
      break;
    case "yearly":
      nextDate = addYears(currentDate, interval);
      break;
    default:
      nextDate = addDays(currentDate, interval);
      break;
  }

  if (rule.endDate) {
    const end = parseISO(rule.endDate);
    if (nextDate.getTime() > end.getTime()) {
      return undefined;
    }
  }

  return format(nextDate, "yyyy-MM-dd");
}

export function formatDate(date: ISODate | ISODateTime | undefined): string {
  if (!date) return "";
  const d = parseISO(date);
  
  const hasTime = date.includes("T");
  const timeStr = hasTime ? ", " + format(d, "h:mm a") : "";

  if (isToday(d)) return "Today" + timeStr;
  if (isTomorrow(d)) return "Tomorrow" + timeStr;
  if (isYesterday(d)) return "Yesterday" + timeStr;
  
  return format(d, "MMM d, yyyy") + timeStr;
}

export function formatRelative(date: ISODateTime): string {
  return formatDistanceToNow(parseISO(date), { addSuffix: true });
}

export function formatTime(date: ISODateTime): string {
  return format(parseISO(date), "h:mm a");
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ── Array utils ──────────────────────────────────────────────

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

export function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] ??= []).push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
}

export function sortBy<T>(arr: T[], key: (item: T) => string | number): T[] {
  return [...arr].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

// ── String utils ─────────────────────────────────────────────

export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

export function getTiptapPlainText(rawJson: string): string {
  if (!rawJson) return "";
  if (rawJson.startsWith("<")) {
    return rawJson;
  }
  try {
    const doc = JSON.parse(rawJson);
    if (!doc || typeof doc !== "object" || doc.type !== "doc") {
      return rawJson;
    }
    const text: string[] = [];
    const recurse = (node: any) => {
      if (node.type === "text" && node.text) {
        text.push(node.text);
      }
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(recurse);
      }
    };
    recurse(doc);
    return text.join(" ");
  } catch {
    return rawJson;
  }
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Debounce ─────────────────────────────────────────────────

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ── Priority helpers ─────────────────────────────────────────

export const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 } as const;

export function comparePriority(a: string, b: string): number {
  return (PRIORITY_ORDER[a as keyof typeof PRIORITY_ORDER] ?? 4) -
    (PRIORITY_ORDER[b as keyof typeof PRIORITY_ORDER] ?? 4);
}

export const PRIORITY_COLORS = {
  urgent: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-blue-400",
  none: "text-muted-foreground",
} as const;

export const PRIORITY_LABELS = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No priority",
} as const;
