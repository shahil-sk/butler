// ============================================================
// DATABASE MODULE — Root component
// ============================================================

import { useEffect, useRef } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { registry } from "@/kernel/router";
import { databaseManifest } from "./manifest";
import { setupDatabaseEventListeners } from "./events";
import { useDatabaseStore } from "./store";
import { TableList } from "./components/TableList";
import { TableView } from "./components/TableView";

registry.register(databaseManifest);

export default function DatabaseModule() {
  const registered = useRef(false);
  const loadTables = useDatabaseStore((s) => s.loadTables);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (registered.current) return;
    registered.current = true;
    const teardown = setupDatabaseEventListeners();
    return teardown;
  }, []);

  return (
    <Routes>
      <Route index element={<TableList />} />
      <Route path=":tableId" element={<TableView />} />
    </Routes>
  );
}
