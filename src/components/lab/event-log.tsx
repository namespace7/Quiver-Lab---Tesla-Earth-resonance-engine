import { ALL_EVENT_TYPES, EVENT_META } from "@/lib/engine/channels";
import type { EventType } from "@/lib/engine/types";
import { useLab } from "@/lib/lab-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function exportLog() {
  const { events, live, params } = useLab.getState();
  const blob = new Blob(
    [JSON.stringify({ exportedAt: new Date().toISOString(), params, live, events }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quiver-lab-log-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function EventLog() {
  const events = useLab((s) => s.events);
  const breakOn = useLab((s) => s.breakOn);
  const toggleBreak = useLab((s) => s.toggleBreak);
  const selectedEventId = useLab((s) => s.selectedEventId);
  const selectEvent = useLab((s) => s.selectEvent);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Callbacks fire with a full channel snapshot. Arm a break to freeze the bench.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={exportLog}>
          Export JSON
        </Button>
      </div>
      <div>
        <p className="mb-2 font-mono text-xs tracking-wide text-subtle uppercase">Break on</p>
        <div className="flex flex-wrap gap-2">
          {ALL_EVENT_TYPES.map((t: EventType) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleBreak(t)}
              className={cn(
                "h-9 rounded-sm px-3 font-mono text-xs",
                breakOn[t] ? "bg-warn text-bg" : "bg-raised text-muted",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-md bg-raised p-2">
        {events.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted">
            No callbacks yet. Run the bench.
          </li>
        ) : (
          events.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => selectEvent(e.id === selectedEventId ? null : e.id)}
                className={cn(
                  "flex w-full flex-col items-start gap-1 rounded-sm px-3 py-2 text-left",
                  e.id === selectedEventId ? "bg-fg text-bg" : "hover:bg-surface",
                )}
              >
                <span className="flex w-full items-baseline justify-between gap-3 font-mono text-xs">
                  <span>{e.type}</span>
                  <span className={e.id === selectedEventId ? "text-bg/70" : "text-subtle"}>
                    t={e.t.toFixed(3)}s
                  </span>
                </span>
                <span className="text-sm">{e.message}</span>
                <span
                  className={cn(
                    "font-mono text-xs",
                    e.id === selectedEventId ? "text-bg/70" : "text-subtle",
                  )}
                >
                  {EVENT_META[e.type].hint}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
