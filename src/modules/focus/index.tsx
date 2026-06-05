import { useFocusStore } from "./store";
import { useEffect } from "react";
import { Flame, Clock } from "lucide-react";
import { format } from "date-fns";
import { today } from "@/shared/utils";
import { SessionStatsView } from "./components/SessionStatsView";
import { useTaskStore } from "@/modules/tasks/store";

export default function FocusDashboard() {
  const { load, sessions } = useFocusStore();
  const { tasks } = useTaskStore();

  useEffect(() => {
    load();
  }, []);

  const completedSessions = sessions.filter(s => s.status === "completed" || s.actualMinutes);
  const totalMins = completedSessions.reduce((acc, s) => acc + (s.actualMinutes || 0), 0);
  const todayMins = completedSessions.filter(s => s.startedAt?.startsWith(today())).reduce((acc, s) => acc + (s.actualMinutes || 0), 0);

  return (
    <div className="w-full h-full overflow-y-auto bg-background text-foreground">
      <div className="p-8 md:p-12 max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
            Focus
          </h1>
          <p className="text-muted-foreground text-lg font-medium">Ambient flow state metrics and past sessions.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card/40 backdrop-blur-xl border border-border/60 p-8 rounded-3xl space-y-2 hover:border-primary/40 transition-colors group">
            <div className="flex items-center gap-2 text-primary uppercase text-[10px] font-black tracking-[0.2em] mb-4">
              <Flame size={16} /> Today
            </div>
            <div className="text-6xl font-black tabular-nums tracking-tighter group-hover:scale-105 transition-transform origin-left">{todayMins} <span className="text-xl text-muted-foreground font-medium tracking-normal">mins</span></div>
          </div>
          <div className="bg-card/40 backdrop-blur-xl border border-border/60 p-8 rounded-3xl space-y-2 hover:border-muted-foreground/40 transition-colors group">
            <div className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] font-black tracking-[0.2em] mb-4">
              <Clock size={16} /> All Time
            </div>
            <div className="text-6xl font-black tabular-nums tracking-tighter group-hover:scale-105 transition-transform origin-left">{totalMins} <span className="text-xl text-muted-foreground font-medium tracking-normal">mins</span></div>
          </div>
        </div>

        <SessionStatsView />

        <div className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight">Recent Flow Sessions</h2>
          <div className="space-y-3">
            {completedSessions.slice(0, 20).map(s => (
              <div key={s.id} className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-border/40 hover:bg-muted/40 transition-colors">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-foreground">{tasks.find(t => t.id === s.taskId)?.title || s.goal || "Deep Work"}</span>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{format(new Date(s.startedAt), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
                <div className="text-lg font-black font-mono text-primary bg-primary/10 px-4 py-1.5 rounded-full tracking-tighter">
                  {s.actualMinutes || 0}m
                </div>
              </div>
            ))}
            {completedSessions.length === 0 && (
              <div className="py-12 text-center border-2 border-dashed border-border/50 rounded-3xl">
                <p className="text-muted-foreground font-medium">No focus sessions recorded yet.</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Start Flow from any task to begin tracking automatically.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
