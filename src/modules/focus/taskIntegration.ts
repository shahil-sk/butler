// ============================================================
// FOCUS — taskIntegration.ts
// Bus listener registration only.
// All business logic has moved to service.ts.
// Call registerFocusTaskIntegration() once in main.tsx / App.tsx.
// ============================================================

import { bus } from "@/kernel/event-bus";
import {
  autoCreateTimeEntry,
  autoTransitionTaskStatus,
  stopRunningTimer,
  scheduleTaskToday,
} from "./service";

let _registered = false;

export function registerFocusTaskIntegration() {
  if (_registered) return;
  _registered = true;

  bus.on("focus:session-completed", async ({ session }) => {
    await autoCreateTimeEntry(session);
    await autoTransitionTaskStatus(session);
  });

  bus.on("focus:session-started", async ({ session }) => {
    if (session.type !== "focus") return;
    await stopRunningTimer();
  });

  bus.on("focus:start-requested", ({ taskId }: { taskId?: string }) => {
    if (taskId) {
      try { sessionStorage.setItem("butler:pendingFocusTaskId", taskId); } catch { /* sandboxed */ }
    }
  });
}

export { scheduleTaskToday };
