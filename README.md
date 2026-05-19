<div align="center">

<h1>BUTLER</h1>
<img src="https://github.com/shahil-sk/butler/blob/main/src-tauri/icons/32x32.png" width="100" alt="butler logo" />


**Butler** is an offline-first personal productivity desktop app — tasks, notes, journal, calendar, projects, focus timer, and time tracking, all in one place.

[![Build Status](https://img.shields.io/github/actions/workflow/status/shahil-sk/butler/build.yml?style=for-the-badge)](https://github.com/shahil-sk/butler/actions)
[![Latest Release](https://img.shields.io/github/v/release/shahil-sk/butler?style=for-the-badge)](https://github.com/shahil-sk/butler/releases/latest)
[![License](https://img.shields.io/github/license/shahil-sk/butler?style=for-the-badge)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24c8d8?style=for-the-badge&logo=tauri)](https://tauri.app)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-black?style=for-the-badge)](https://github.com/shahil-sk/butler/releases)
[![Ko-Fi](https://img.shields.io/badge/Support-Ko--Fi-ff5f5f?style=for-the-badge&logo=kofi&logoColor=white)](https://ko-fi.com/shahilsk)

<br>

[Download](#installation) &bull;
[Features](#features) &bull;
[Development](#development) &bull;
[Tech Stack](#tech-stack)

</div>

---

## About

Butler is a local-first desktop productivity app built with Tauri v2 and React. Everything lives on your machine — no cloud, no accounts, no sync fees.

It bundles tasks, projects, rich notes, a daily journal, calendar, focus sessions, and time tracking into a single keyboard-friendly interface. Modules are connected: link a note to a task, track time against a project, open a focus session from your planner.

---

## Features

### Tasks
- Create tasks with status, priority, due date, time estimate, and checklist items
- Update and add tasks from a single unified dialog
- Filter by status, project, and priority

### Projects
- Group tasks under color-coded projects
- Project-level overview with progress tracking

### Notes
- Rich text editor (Tiptap) with slash commands, task lists, and code blocks
- Sidebar with search and type filters (Notes, Daily, Meetings, Pinned)
- Link notes to tasks, projects, and calendar events
- Tag notes inline

### Journal
- Private daily journal with date navigation
- Separate from notes — no cross-contamination

### Calendar
- Monthly and weekly views
- Link events to notes

### Planner
- Day-level planning view that pulls tasks and events together

### Focus
- Pomodoro-style focus timer
- Start a session directly from a task or planner

### Time Tracking
- Log time against tasks and projects
- Running timer with one-click start/stop

### Shell
- Global command palette (`⌘K` / `Ctrl+K`) — search and jump anywhere
- Keyboard shortcut navigation across all modules
- Dark and light mode, follows system preference

---

## Installation

Download the latest release for your platform:

### [Windows](https://github.com/shahil-sk/butler/releases/latest) · [Linux](https://github.com/shahil-sk/butler/releases/latest) · [macOS](https://github.com/shahil-sk/butler/releases/latest)

All releases are self-contained — no runtime or installer dependency required.

---

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 8+
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Tauri v2 prerequisites](https://tauri.app/start/prerequisites/) for your OS

### Setup

```bash
git clone https://github.com/shahil-sk/butler.git
cd butler
pnpm install
pnpm tauri dev
```

### Web-only mode (no native shell)

```bash
pnpm dev
```

### Build

```bash
pnpm tauri build
```

Compiled binaries land in `src-tauri/target/release/bundle/`.

---

## Tech Stack

| Layer | Library | Purpose |
|---|---|---|
| Desktop shell | [Tauri v2](https://tauri.app) | Native window, OS APIs, SQLite |
| UI framework | [React 18](https://react.dev) + [TypeScript](https://typescriptlang.org) | Component tree |
| Styling | [Tailwind CSS v3](https://tailwindcss.com) | Utility-first CSS |
| State | [Zustand](https://zustand-demo.pmnd.rs/) + [Immer](https://immerjs.github.io/immer/) | Module stores |
| Local DB | [Dexie (IndexedDB)](https://dexie.org/) | Offline-first persistence |
| Rich editor | [Tiptap](https://tiptap.dev/) | Notes and journal editor |
| UI primitives | [Radix UI](https://www.radix-ui.com/) | Dialogs, menus, tooltips |
| Icons | [Lucide React](https://lucide.dev/) | Icon set |
| Routing | [React Router v6](https://reactrouter.com/) | Module navigation |
| Build | [Vite 5](https://vitejs.dev/) | Dev server and bundler |

---

## Project Structure

```
butler/
├── src/
│   ├── kernel/          # Router, event bus, command registry
│   ├── modules/         # Feature modules (tasks, notes, journal, …)
│   │   ├── tasks/
│   │   ├── projects/
│   │   ├── notes/
│   │   ├── journal/
│   │   ├── calendar/
│   │   ├── planner/
│   │   ├── focus/
│   │   ├── time-tracking/
│   │   └── integration/
│   ├── shared/          # Shared UI components, hooks, utils
│   ├── shell/           # App chrome, sidebar, command palette
│   └── styles/          # Global CSS and Tiptap styles
└── src-tauri/           # Rust backend (Tauri v2)
```

Each module is self-contained: its own store, components, and manifest. Modules communicate through the event bus and shared stores rather than direct imports.

---

## Support the Project

If Butler is useful to you and you want to support future development:

<p align="left">
  <a href="https://ko-fi.com/shahilsk">
    <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Ko-Fi" />
  </a>
</p>

---

## License

[MIT](LICENSE)
