import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { db } from "@/kernel/db";

// ── CRITICAL: Register ALL module migrations before db.init() ──
// Modules are lazy-loaded, so they can't self-register.
// Add every module's migrations here as they are built.
import { TASK_MIGRATIONS }     from "@/modules/tasks/db";
import { PROJECT_MIGRATIONS }  from "@/modules/projects/db";
import { PLANNER_MIGRATIONS }  from "@/modules/planner/db";
import { NOTE_MIGRATIONS }     from "@/modules/notes/db";
import { CALENDAR_MIGRATIONS } from "@/modules/calendar/db";
import { JOURNAL_MIGRATIONS }  from "@/modules/journal/db";
import { FOCUS_MIGRATIONS }    from "@/modules/focus/db";
import { TIME_MIGRATIONS }     from "@/modules/time-tracking/db";

import "./styles/globals.css";

// Register eagerly — before init()
db.registerMigrations(TASK_MIGRATIONS);
db.registerMigrations(PROJECT_MIGRATIONS);
db.registerMigrations(PLANNER_MIGRATIONS);
db.registerMigrations(NOTE_MIGRATIONS);
db.registerMigrations(CALENDAR_MIGRATIONS);
db.registerMigrations(JOURNAL_MIGRATIONS);
db.registerMigrations(FOCUS_MIGRATIONS);
db.registerMigrations(TIME_MIGRATIONS);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

async function boot() {
  try {
    // DB init runs AFTER all migrations are registered above
    await db.init();

    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </React.StrictMode>
    );
  } catch (err) {
    console.error("[Boot] Fatal error:", err);
    document.getElementById("root")!.innerHTML = `
      <div style="padding:2rem;font-family:monospace;color:#ef4444;background:#1a1a1a;min-height:100vh">
        <h2 style="margin:0 0 1rem">Butler failed to start</h2>
        <pre style="font-size:12px;opacity:0.8">${String(err)}</pre>
        <p style="font-size:12px;opacity:0.5;margin-top:1rem">Check DevTools console for details.</p>
      </div>
    `;
  }
}

void boot();
