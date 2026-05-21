// ============================================================
// TIME TRACKING — MODULE ROOT (entry + tab router only)
// ============================================================

import { useEffect } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { Timer, Clock, BarChart2 } from "lucide-react";

import { registry } from "@/kernel/router";
import { useTimeStore } from "./store";
import { setupTimeEventListeners } from "./events";
import { TIME_MANIFEST } from "./manifest";
import { PageHeader, SubNav } from "@/shared/ui";
import { TrackerView } from "./ui/TrackerView";
import { ReportsView } from "./ui/ReportsView";

export default function TimeTrackingModule() {
  const { load, isLoaded } = useTimeStore();

  useEffect(() => {
    registry.register(TIME_MANIFEST);
    const unsub = setupTimeEventListeners();
    return unsub;
  }, []);

  useEffect(() => {
    if (!isLoaded) load();
  }, [isLoaded, load]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Timer size={18} />}
        title="Time Tracking"
        actions={
          <SubNav>
            <NavLink
              to="/time"
              end
              className={({ isActive }) => `subnav-item ${isActive ? "active" : ""}`}
            >
              <Clock size={14} /> Tracker
            </NavLink>
            <NavLink
              to="/time/reports"
              className={({ isActive }) => `subnav-item ${isActive ? "active" : ""}`}
            >
              <BarChart2 size={14} /> Reports
            </NavLink>
          </SubNav>
        }
      />

      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/"        element={<TrackerView />} />
          <Route path="/reports" element={<ReportsView />} />
        </Routes>
      </div>
    </div>
  );
}
