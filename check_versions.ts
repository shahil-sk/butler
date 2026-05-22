import { TASK_MIGRATIONS } from "./src/modules/tasks/db.ts";
import { PROJECT_MIGRATIONS } from "./src/modules/projects/db.ts";
import { PLANNER_MIGRATIONS } from "./src/modules/planner/db.ts";
import { NOTE_MIGRATIONS } from "./src/modules/notes/db.ts";
import { CALENDAR_MIGRATIONS } from "./src/modules/calendar/db.ts";
import { JOURNAL_MIGRATIONS } from "./src/modules/journal/db.ts";
import { FOCUS_MIGRATIONS } from "./src/modules/focus/db.ts";
import { TIME_MIGRATIONS } from "./src/modules/time-tracking/db.ts";
import { DATABASE_MIGRATIONS } from "./src/modules/database/db.ts";
import { RESEARCH_MIGRATIONS } from "./src/modules/research/db.ts";
import { KERNEL_MIGRATIONS } from "./src/kernel/db/index.ts";

const all = [
  ...KERNEL_MIGRATIONS,
  ...TASK_MIGRATIONS,
  ...PROJECT_MIGRATIONS,
  ...PLANNER_MIGRATIONS,
  ...NOTE_MIGRATIONS,
  ...CALENDAR_MIGRATIONS,
  ...JOURNAL_MIGRATIONS,
  ...FOCUS_MIGRATIONS,
  ...TIME_MIGRATIONS,
  ...DATABASE_MIGRATIONS,
  ...RESEARCH_MIGRATIONS
];

console.log(all.map(m => \`\${m.version}: \${m.module}\`));
