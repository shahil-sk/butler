import { bus } from "@/kernel/event-bus";
import { useTaskStore } from "@/modules/tasks/store";
import { useCalendarStore } from "@/modules/calendar/store";
import { today } from "@/shared/utils";
import { differenceInDays, parseISO, addMinutes } from "date-fns";

let lastCheckedDate = "";
const firedEventStarting = new Set<string>();

export function initCron() {
  console.log("[Cron] Initializing kernel cron service...");

  // Run initial checks after stores load
  setTimeout(() => {
    runDailyJobs();
    runMinuteJobs();
  }, 3000);

  // Daily loop check (every 5 minutes to see if date changed)
  setInterval(() => {
    const currentDate = today();
    if (currentDate !== lastCheckedDate) {
      runDailyJobs();
    }
  }, 5 * 60 * 1000);

  // Minute loop check (every 1 minute for event notifications)
  setInterval(() => {
    runMinuteJobs();
  }, 60 * 1000);
}

function runDailyJobs() {
  const currentDate = today();
  lastCheckedDate = currentDate;
  console.log(`[Cron] Running daily jobs for date: ${currentDate}`);

  // 1. Emit day started
  bus.emit("day:started", { date: currentDate });

  // 2. Check overdue and due today tasks
  setTimeout(() => {
    const tasks = useTaskStore.getState().tasks;
    tasks.forEach((task) => {
      if (task.status === "done" || task.status === "archived" || !task.dueDate) return;

      const dueStr = task.dueDate.slice(0, 10);
      if (dueStr === currentDate) {
        bus.emit("task:due-today", { taskId: task.id });
      } else if (dueStr < currentDate) {
        const daysPast = differenceInDays(parseISO(currentDate), parseISO(dueStr));
        if (daysPast > 0) {
          bus.emit("task:overdue", { taskId: task.id, daysPast });
        }
      }
    });
  }, 1000);
}

function runMinuteJobs() {
  const events = useCalendarStore.getState().events;

  events.forEach((event) => {
    if (!event.startAt || firedEventStarting.has(event.id)) return;

    const eventTime = new Date(event.startAt);
    const diffMs = eventTime.getTime() - Date.now();
    const diffMins = diffMs / (60 * 1000);

    // If event is starting in 29-30 minutes, fire warning
    if (diffMins > 28 && diffMins <= 30) {
      firedEventStarting.add(event.id);
      bus.emit("calendar:event-starting", { eventId: event.id, minutesBefore: 30 });
    }
  });

  // Cleanup past events from the set
  firedEventStarting.forEach((id) => {
    const event = events.find((e) => e.id === id);
    if (!event || new Date(event.startAt).getTime() < Date.now()) {
      firedEventStarting.delete(id);
    }
  });
}
