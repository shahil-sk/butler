1. Types first
types.ts — define your Zod schemas before writing anything else. This is the contract everything else depends on.
2. Database
schema.sql — define the tables. No business logic here, just structure.
3. Repository
repository.ts — raw DB access only. Read/write to SQLite. Zero business logic — just queries.
4. Service
service.ts — business logic lives here. Calls the repository, never touches the DB directly.
5. Events
events.ts — declare what this module emits and what it listens to. Add any new event types to the central ButlerEventMap in src/kernel/event-bus/index.ts.
6. Manifest
manifest.ts — registers the module with the shell so it appears in the app.
7. UI
index.tsx + components — calls services via hooks only, never calls repository or DB directly. Keep files under 600 lines; split into ui/ subfolders early.
8. Integration wiring
Go to src/modules/integration/index.ts and wire up the listeners — what this module does when it receives events from others, and confirm other modules react to what this module emits.

For each integration connection, ask three questions:

What events does this module emit, and who needs to react?
What events from other modules does this module need to listen to?
Are there any shared UI components being duplicated that should live in src/shared/ui/ instead?

The document's priority rule for integration is: user-visible ripple effects first — status changes that should reflect everywhere (like task completed/cancelled) before plumbing things like index invalidation or time rollups.
