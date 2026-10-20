import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// A simple countdown timer for a task
function FocusTimer({ minutes }) {
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  const [isRunning, setIsRunning] = useState(false);

  // Countdown while the timer is running
  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setSecondsLeft(previous => {
        if (previous <= 1) {
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning]);

  const displayMinutes = Math.floor(secondsLeft / 60);
  const displaySeconds = secondsLeft % 60;

  const formattedTime =
    String(displayMinutes).padStart(2, "0") + ":" + String(displaySeconds).padStart(2, "0");

  // Start or continue the countdown
  const startTimer = () => {
    if (secondsLeft > 0) {
      setIsRunning(true);
    }
  };

  // Pause the countdown
  const pauseTimer = () => {
    setIsRunning(false);
  };

  // Restart the countdown from the original duration
  const resetTimer = () => {
    setIsRunning(false);
    setSecondsLeft(minutes * 60);
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">Focus Timer</p>

      <p className="text-2xl font-semibold tabular-nums">{formattedTime}</p>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={startTimer}
          disabled={isRunning || secondsLeft === 0}
        >
          Start
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={pauseTimer}
          disabled={!isRunning}
        >
          Pause
        </Button>

        <Button type="button" size="sm" variant="outline" onClick={resetTimer}>
          Reset
        </Button>
      </div>

      {secondsLeft === 0 && (
        <p className="text-sm text-muted-foreground">Focus session completed!</p>
      )}
    </div>
  );
}

export { FocusTimer };
