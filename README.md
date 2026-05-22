<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="Butler Logo" width="128" height="128" />
</p>

<h1 align="center">Butler — The Local-First Productivity OS</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/Tauri-v2-blue?style=flat-square&logo=tauri" alt="Tauri" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Rust-Stable-orange?style=flat-square&logo=rust" alt="Rust" />
  <img src="https://img.shields.io/badge/TypeScript-5.4-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite" alt="SQLite" />
  <img src="https://img.shields.io/badge/Vite-5.1-646CFF?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License" />
</p>

<br />

Butler is a keyboard-driven, local-first productivity operating system designed as a desktop application. It integrates task management, time tracking, focus timers, journal logs, document research, and a personal knowledge graph into a unified, high-performance, offline-first workspace.

Built using Tauri v2, React 18, Zustand, and SQLite, Butler enforces a strict modular boundary architecture, ensuring that all subsystems are completely decoupled and communicate solely through a central, typed event bus.

---

## Core Modules and Capabilities

*   **Tasks and Projects**: Kanban board and list views of tasks supporting subtasks, recurrence rules, and project completion metrics.
*   **Journal and Planner**: Structured daily logging, weekly review workflows, reflection prompts, and integrated scheduling boards.
*   **Notes**: Obsidian-style note-taking with markdown shortcuts, autocomplete wikilinks (`[[Page Title]]`), and dynamic backlink panels.
*   **Focus and Time Tracking**: Pomodoro timers with idle activity detection, streak heatmaps, and automatic daily duration summaries.
*   **Global Search**: Keyboard-driven search overlay utilizing SQLite FTS5 for indexing tasks, notes, journal entries, and PDF text chunks.
*   **Goals and Roadmaps**: Milestone tracking and roadmap visualization dashboards linking tasks to long-term objectives.
*   **Research Ingestion Pipeline**: Processing engine for imported files, extracting text from PDFs via Web Workers and converting web URLs to clean markdown.
*   **Knowledge Graph**: Interactive force-directed 2D HTML Canvas visualizing associations between notes, threads, and sources.

---

## Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Shell & Core** | Tauri v2 (Rust) |
| **User Interface** | React 18 + Vite + TypeScript |
| **Styling** | Tailwind CSS + shadcn/ui + CSS Modules |
| **State Management** | Zustand (Client state) & TanStack Query (Server/Async state) |
| **Database** | SQLite (`tauri-plugin-sql`) with Dexie (IndexedDB fallback) |
| **Editor** | Tiptap (Rich Text Editor with custom extensions) |
| **Package Manager** | pnpm |

---

## Architecture and Design Principles

Butler is structured as a monolith of isolated modules with strict dependency constraints.

```
src/
  ├── kernel/          # Core abstractions (Do not modify during feature work)
  │    ├── event-bus/  # Strongly typed global event bus (pub/sub)
  │    ├── db/         # SQLite DB adapters and migrations runner
  │    └── router/     # Module route register and navigation controller
  ├── shell/           # Core layout, sidebar, command palette, global theme
  ├── modules/         # Completely isolated domain modules
  │    ├── calendar/
  │    ├── database/
  │    ├── focus/
  │    ├── journal/
  │    ├── notes/
  │    ├── planner/
  │    ├── projects/
  │    ├── research/
  │    ├── tasks/
  │    └── time-tracking/
  └── shared/          # App-wide global TS types and utility functions (no business logic)
```

### Strict Module Boundaries
To preserve codebase maintainability and prevent circular dependencies, modules must never directly import stores, views, or state from other modules.
*   **Allowed**: Importing from `src/shared/*` or `src/kernel/*`.
*   **Forbidden**: `import { taskStore } from '../tasks/store'`.

### Event-Driven Communication
When a module needs to interact with another module, it must publish or subscribe to events through the strongly-typed Event Bus (`src/kernel/event-bus/index.ts`).

*   **Example (Publishing an event)**:
    ```typescript
    import { eventBus } from "@/kernel/event-bus";
    eventBus.emit("task:completed", { taskId: "123", completedAt: new Date().toISOString() });
    ```
*   **Example (Listening to an event)**:
    ```typescript
    import { eventBus } from "@/kernel/event-bus";
    eventBus.on("task:completed", ({ taskId }) => {
      // Respond to task completion in the Focus or Journal module
    });
    ```

### Module Contract
Every folder under `src/modules/*` must strictly adhere to the following file contract:
*   `manifest.ts`: Configures module metadata, routes, keyboard shortcuts, and slash commands.
*   `store.ts`: Zustand store managing the module's client-side state.
*   `db.ts`: SQL schemas and migration files for the module.
*   `events.ts`: Global event emitters and listeners for the module.
*   `index.tsx`: Main component that serves as the entry point.
*   `CONTEXT.md`: A summary of the module's architecture and responsibilities for LLM context.

---

## Development and Installation

### Prerequisites (Linux)

Ensure you have Rust, Node.js, and system-level libraries installed:

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update

# Install System Dependencies (Debian/Ubuntu)
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf \
  libgtk-3-dev libsoup2.4-dev javascriptcoregtk-4.1

# Install pnpm and Node
curl -fsSL https://get.pnpm.io/install.sh | sh -
pnpm env use --global 20
```

### Setup and Launch

1. Clone the repository:
   ```bash
   git clone https://github.com/shahil-sk/butler.git
   cd butler
   ```
2. Install package dependencies:
   ```bash
   pnpm install
   ```
3. Launch the Tauri developer server:
   ```bash
   pnpm tauri dev
   ```

### Command Scripts

*   `pnpm dev`: Run the Vite dev server for the web frontend alone.
*   `pnpm build`: Run typechecking and compile the frontend production bundle.
*   `pnpm tauri build`: Build the release production desktop binary.
*   `pnpm typecheck`: Run TypeScript compiler validation.
*   `pnpm lint`: Run ESLint checks.

---

## Session Protocol

When developing Butler with an AI assistant or agent:
1. Load only `/src/shared/types.ts`, `/src/kernel/event-bus/index.ts`, and the relevant module's `CONTEXT.md` to begin.
2. Avoid pasting the entire codebase to prevent context bloat.
3. Enforce strict typescript compilation flags.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.
