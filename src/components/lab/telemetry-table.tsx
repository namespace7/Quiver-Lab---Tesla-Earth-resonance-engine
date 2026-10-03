import { CHANNELS, GROUP_LABEL } from "@/lib/engine/channels";
import type { ChannelGroup, Telemetry } from "@/lib/engine/types";
import { useLab } from "@/lib/lab-store";
import { cn, siFormat } from "@/lib/utils";
import { stabilityOf } from "@/lib/engine/engine";

function display(key: keyof Telemetry, value: number): string {
  if (key === "stabilityCode") {
    return value === 2 ? "unstable" : value === 1 ? "marginal" : "damped";
  }
  if (key === "weatherCode") return value ? "storm" : "fair";
  if (key === "resonanceLock" || key === "sparkState" || key === "sustain") {
    return value ? "1" : "0";
  }
  if (key === "cycle" || key === "dumpCount" || key === "N_turns") {
    return String(Math.round(value));
  }
  return siFormat(value, 3);
}

export function TelemetryTable() {
  const live = useLab((s) => s.live);
  const group = useLab((s) => s.group);
  const setGroup = useLab((s) => s.setGroup);
  const selected = useLab((s) => s.selectedEvent());
  const snap = selected?.snapshot;
  const groups: Array<ChannelGroup | "all"> = [
    "all",
    "run",
    "world",
    "circuit",
    "instability",
    "motor",
    "energy",
    "vehicle",
  ];
  const rows = CHANNELS.filter((c) => group === "all" || c.group === group);
  const stab = stabilityOf(live.loopGain);
  const mode = useLab((s) => s.mode);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={cn(
              "h-9 rounded-sm px-3 font-mono text-xs",
              group === g ? "bg-fg text-bg" : "bg-raised text-muted",
            )}
          >
            {g === "all" ? "All" : GROUP_LABEL[g]}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">
        {mode === "conservative"
          ? "Conservative physical telemetry. Unphysical scalars are zero. Check 'Energy Ledger' tab for complete thermodynamic reservoir accounting."
          : `Historical phenomenological telemetry. State: ${stab}. Contains unvalidated scalars.`}{" "}
        {snap
          ? "Compare column is the paused callback snapshot."
          : "Click a log event to freeze a snapshot beside live."}
      </p>
      <div className="overflow-x-auto rounded-md bg-raised">
        <table className="w-full min-w-3xl border-collapse text-left font-mono text-xs">
          <thead>
            <tr className="text-subtle">
              <th className="px-3 py-2 font-medium">Channel</th>
              <th className="px-3 py-2 font-medium">Live</th>
              {snap ? <th className="px-3 py-2 font-medium">Callback</th> : null}
              {snap ? <th className="px-3 py-2 font-medium">Δ</th> : null}
              <th className="px-3 py-2 font-medium">Unit</th>
              <th className="px-3 py-2 font-medium">Paper</th>
              <th className="px-3 py-2 font-medium">Formula</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ch) => {
              const v = live[ch.key];
              const s = snap?.[ch.key];
              const hasSnap = s !== undefined;
              const delta = hasSnap ? v - s : 0;
              const changed = hasSnap && Math.abs(delta) > 1e-12 * (Math.abs(v) + 1);
              return (
                <tr key={ch.key} className="border-t border-border/80">
                  <td className="px-3 py-2 text-fg">{ch.label}</td>
                  <td className="px-3 py-2 tabular text-accent">{display(ch.key, v)}</td>
                  {snap ? (
                    <td className="px-3 py-2 tabular text-muted">
                      {hasSnap ? display(ch.key, s) : "—"}
                    </td>
                  ) : null}
                  {snap ? (
                    <td className={cn("px-3 py-2 tabular", changed ? "text-warn" : "text-subtle")}>
                      {changed ? siFormat(delta, 2) : "—"}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 text-subtle">{ch.unit}</td>
                  <td className="px-3 py-2 text-muted">{ch.paper}</td>
                  <td className="px-3 py-2 text-subtle">{ch.formula}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
