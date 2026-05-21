// ============================================================
// FocusStartForm
//
// Gap 1: persists config through startFocus (passed to store)
// Gap 4: pre-fills task/project from pendingTaskId /
//        pendingProjectId (carried forward from the break)
// ============================================================

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TaskCombobox } from "@/modules/tasks/components/TaskCombobox";
import { ProjectCombobox } from "@/modules/projects/components/ProjectCombobox";
import { useFocusStore } from "../store";

export function FocusStartForm() {
  const startFocus     = useFocusStore((s) => s.startFocus);
  const setGoal        = useFocusStore((s) => s.setGoal);
  const pendingGoal    = useFocusStore((s) => s.pendingGoal);

  // Gap 4: pre-filled from the break that just completed
  const pendingTaskId    = useFocusStore((s) => s.pendingTaskId);
  const pendingProjectId = useFocusStore((s) => s.pendingProjectId);

  const [taskId,    setTaskId]    = useState<string | undefined>(pendingTaskId);
  const [projectId, setProjectId] = useState<string | undefined>(pendingProjectId);

  // Gap 1: per-session config exposed in the form
  const [focusMinutes,            setFocusMinutes]            = useState(25);
  const [shortBreakMinutes,       setShortBreakMinutes]       = useState(5);
  const [longBreakMinutes,        setLongBreakMinutes]        = useState(15);
  const [sessionsBeforeLongBreak, setSessionsBeforeLongBreak] = useState(4);

  function handleStart() {
    void startFocus({
      taskId,
      projectId,
      config: {
        focusMinutes,
        shortBreakMinutes,
        longBreakMinutes,
        sessionsBeforeLongBreak,
      },
    });
  }

  return (
    <div className="space-y-4">
      {/* Goal */}
      <div>
        <Label htmlFor="goal">What are you working on?</Label>
        <Input
          id="goal"
          placeholder="E.g. Finish report, Fix bug #42…"
          value={pendingGoal}
          onChange={(e) => setGoal(e.target.value)}
        />
      </div>

      {/* Task — pre-filled after a break (Gap 4) */}
      <div>
        <Label>Task (optional)</Label>
        <TaskCombobox value={taskId} onChange={setTaskId} />
      </div>

      {/* Project — pre-filled after a break (Gap 4) */}
      <div>
        <Label>Project (optional)</Label>
        <ProjectCombobox value={projectId} onChange={setProjectId} />
      </div>

      {/* Timer config — persisted via startFocus (Gap 1) */}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
          Timer settings
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="focusMin">Focus (min)</Label>
            <Input
              id="focusMin"
              type="number"
              min={1}
              max={120}
              value={focusMinutes}
              onChange={(e) => setFocusMinutes(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="shortBreak">Short break (min)</Label>
            <Input
              id="shortBreak"
              type="number"
              min={1}
              max={30}
              value={shortBreakMinutes}
              onChange={(e) => setShortBreakMinutes(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="longBreak">Long break (min)</Label>
            <Input
              id="longBreak"
              type="number"
              min={1}
              max={60}
              value={longBreakMinutes}
              onChange={(e) => setLongBreakMinutes(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="sessionsCount">Sessions before long break</Label>
            <Input
              id="sessionsCount"
              type="number"
              min={1}
              max={10}
              value={sessionsBeforeLongBreak}
              onChange={(e) => setSessionsBeforeLongBreak(Number(e.target.value))}
            />
          </div>
        </div>
      </details>

      <Button className="w-full" onClick={handleStart}>
        Start focus
      </Button>
    </div>
  );
}
