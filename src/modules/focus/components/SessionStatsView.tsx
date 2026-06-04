import React from "react";
import { useFocusStore } from "../store";

function getLastNDays(n: number) {
  const days = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function SessionStatsView() {
  const sessions = useFocusStore((s) => s.sessions);
  
  // 1. Heatmap data (Last 90 days)
  const heatmapDays = getLastNDays(90);
  const heatmapData = new Map<string, number>();
  sessions.forEach(s => {
    if (s.status === "completed" && s.startedAt) {
      const day = s.startedAt.slice(0, 10);
      heatmapData.set(day, (heatmapData.get(day) || 0) + (s.workDuration || s.actualDuration || 0));
    }
  });

  // 2. Flow trend data (Last 30 days)
  const flowDays = getLastNDays(30);
  const flowData = flowDays.map(day => {
    const daySessions = sessions.filter(s => s.startedAt?.startsWith(day) && s.flowScore !== undefined);
    if (daySessions.length === 0) return { day, score: null };
    const avg = daySessions.reduce((acc, s) => acc + s.flowScore!, 0) / daySessions.length;
    return { day, score: avg };
  });

  // 3. Best Focus Hours (0-23)
  const hourlyData = new Array(24).fill(0);
  sessions.forEach(s => {
    if (s.status === "completed" && s.startedAt) {
      const hour = new Date(s.startedAt).getHours();
      hourlyData[hour] += (s.workDuration || s.actualDuration || 0);
    }
  });
  
  const maxHourly = Math.max(...hourlyData, 1);

  return (
    <div className="flex flex-col gap-8 p-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Focus Analytics</h2>
      </div>

      {/* Heatmap */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Activity (Last 90 Days)</h3>
        <div className="flex flex-wrap gap-1">
          {heatmapDays.map(day => {
            const mins = heatmapData.get(day) || 0;
            let intensity = "bg-muted/50";
            if (mins > 0) intensity = "bg-primary/30";
            if (mins >= 60) intensity = "bg-primary/60";
            if (mins >= 120) intensity = "bg-primary";
            
            return (
              <div 
                key={day} 
                className={`w-3 h-3 rounded-[2px] ${intensity} transition-colors`}
                title={`${day}: ${mins} mins`}
              />
            );
          })}
        </div>
      </div>

      {/* Flow Trend & Best Hours Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Flow Trend (Mock visualization) */}
        <div className="flex flex-col gap-3 p-4 rounded-xl border bg-card">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Flow Trend (30 Days)</h3>
          <div className="h-32 flex items-end gap-1 pt-4">
            {flowData.map((d, i) => {
              const heightPct = d.score ? (d.score / 10) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col justify-end h-full relative group">
                  <div 
                    className={`w-full rounded-t-sm transition-all ${d.score ? 'bg-primary' : 'bg-transparent'}`} 
                    style={{ height: `${heightPct}%` }}
                    title={`${d.day}: ${d.score ? d.score.toFixed(1) : 'No data'}`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Best Hours */}
        <div className="flex flex-col gap-3 p-4 rounded-xl border bg-card">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Best Focus Hours</h3>
          <div className="h-32 flex items-end gap-1 pt-4">
            {hourlyData.map((mins, h) => {
              const heightPct = (mins / maxHourly) * 100;
              return (
                <div key={h} className="flex-1 flex flex-col justify-end h-full group" title={`${h}:00 - ${mins} mins`}>
                  <div 
                    className="w-full rounded-t-sm bg-primary/80 group-hover:bg-primary transition-colors" 
                    style={{ height: `${heightPct}%` }}
                  />
                  <div className="text-[8px] text-muted-foreground text-center mt-1 hidden group-hover:block absolute -bottom-4">
                    {h}h
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
