// ============================================================
// TimerControls
//
// Gap 3: "Extend +5 min" button appears when secondsLeft <= 60
// Gap 6: separate "Got distracted" button calls incrementInterrupt
//        — ordinary pause/resume never touches interruptCount
// ============================================================

import { Button } from "@/components/ui/button";
import { PauseIcon, PlayIcon, XIcon, PlusIcon, ZapIcon } from "lucide-react";
import { useFocusStore } from "../store";

export function TimerControls() {
  const activeSession    = useFocusStore((s) => s.activeSession);
  const secondsLeft      = useFocusStore((s) => s.secondsLeft);
  const pause            = useFocusStore((s) => s.pause);
  const resume           = useFocusStore((s) => s.resume);
  const cancel           = useFocusStore((s) => s.cancel);
  const extendSession    = useFocusStore((s) => s.extendSession);
  const incrementInterrupt = useFocusStore((s) => s.incrementInterrupt);

  if (!activeSession || activeSession.type !== "focus") return null;

  const isPaused     = activeSession.state === "paused";
  const isFocusing   = activeSession.state === "focusing";
  // Gap 3: show extend button in the last 60 s
  const nearEnd      = secondsLeft <= 60 && isFocusing;

  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">

      {/* Pause / Resume */}
      {isFocusing && (
        <Button variant="outline" size="sm" onClick={pause}>
          <PauseIcon className="h-4 w-4 mr-1" />
          Pause
        </Button>
      )}
      {isPaused && (
        <Button variant="outline" size="sm" onClick={resume}>
          <PlayIcon className="h-4 w-4 mr-1" />
          Resume
        </Button>
      )}

      {/* Gap 3: extend only visible in final 60 s */}
      {nearEnd && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => extendSession(5)}
          title="Extend session by 5 minutes"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Extend +5 min
        </Button>
      )}

      {/* Gap 6: explicit distraction button — increments interruptCount */}
      {(isFocusing || isPaused) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={incrementInterrupt}
          title="Mark that you got distracted"
          className="text-muted-foreground"
        >
          <ZapIcon className="h-4 w-4 mr-1" />
          Got distracted
        </Button>
      )}

      {/* Cancel */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void cancel()}
        className="text-destructive"
      >
        <XIcon className="h-4 w-4 mr-1" />
        Cancel
      </Button>
    </div>
  );
}
