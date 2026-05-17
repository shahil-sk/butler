# Shell — CONTEXT.md

## What it does
App layout: sidebar, tab system, split panels, command palette, notifications, theme, autosave.

## Emits (via bus)
- `navigate:to` — navigate to path
- `task:quick-add` — open quick-add task
- `search:open` — open global search

## Listens (via bus)
- `navigate:to` — Shell.tsx wires this to react-router
- `navigate:back` — Shell.tsx wires this to navigate(-1)
- `command-palette:open` — CommandPalette.tsx opens
- `ui:notification` — Notifications.tsx shows toast
- `sync:autosave` — useAutosave hook emits this on interval

## Key exports
- `Shell` from `@/shell/Shell` — mount in App.tsx
- `useShellStore` from `@/shell/store` — shell state (tabs, panels, settings)
- `ThemeProvider` from `@/shell/components/ThemeProvider`
- `useTheme` from `@/shell/components/ThemeProvider`

## Rules for LLM sessions
1. Shell imports kernel only — never imports from modules/
2. Modules get placeholders in Shell.tsx Routes — replace when module ships
3. Cross-module nav = bus.emit('navigate:to', { path }) — never direct navigate()
4. New overlays (modals, drawers) go in shell/components/ and mount in Shell.tsx
