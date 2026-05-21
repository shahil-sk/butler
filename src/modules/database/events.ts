import { bus } from "@/kernel/event-bus";
import { useDatabaseStore } from "./store";

type Cleanup = () => void;

export function setupDatabaseEventListeners(): Cleanup {
  const unsubs: Cleanup[] = [];

  // database:created — seed a default Grid view
  unsubs.push(
    bus.on("database:created", ({ database }) => {
      void useDatabaseStore.getState().addView({
        tableId:  database.id,
        name:     "Default View",
        type:     "grid",
        position: 0,
      });
    }),
  );

  // database:row-deleted — notify consumers
  unsubs.push(
    bus.on("database:row-deleted", ({ tableId, rowId }) => {
      // other modules can react here; store handles its own state
      void tableId; void rowId;
    }),
  );

  return () => unsubs.forEach((u) => u());
}
