// ============================================================
// WIRING — add these to existing files
// ============================================================

// ── 1. main.tsx ─────────────────────────────────────────────
// Add BEFORE db.init():

import { TIME_MIGRATIONS } from "@/modules/time-tracking/db";
db.registerMigrations(TIME_MIGRATIONS);


// ── 2. Shell.tsx ─────────────────────────────────────────────
// Lazy import:

const TimeTrackingModule = lazy(() => import("@/modules/time-tracking"));

// Add route inside <Routes>:

<Route path="/time/*" element={
  <Suspense fallback={null}>
    <TimeTrackingModule />
  </Suspense>
} />


// ── 3. IntegrationLayer.tsx ──────────────────────────────────
// Add inside setupIntegrationListeners() or the useEffect:

// time:entry-created → accumulate task.actualMinutes
bus.on("time:entry-created", ({ entry }) => {
  if (!entry.taskId || !entry.durationMinutes) return;
  const task = useTaskStore.getState().tasks.find((t) => t.id === entry.taskId);
  if (!task) return;
  useTaskStore.getState().updateTask(entry.taskId, {
    actualMinutes: (task.actualMinutes ?? 0) + entry.durationMinutes,
  });
});
