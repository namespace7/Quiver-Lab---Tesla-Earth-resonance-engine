import { useEffect } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ControlsPanel } from "./controls-panel";
import { EventLog } from "./event-log";
import { FindingsPanel } from "./findings-panel";
import { LedgerPanel } from "./ledger-panel";
import { PapersPanel } from "./papers-panel";
import { Schematic } from "./schematic";
import { Scope } from "./scope";
import { StabilityCard } from "./stability-card";
import { TelemetryTable } from "./telemetry-table";
import { useLab } from "@/lib/lab-store";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "ledger", label: "Energy Ledger" },
  { id: "data", label: "Data" },
  { id: "log", label: "Log" },
  { id: "papers", label: "Papers" },
  { id: "findings", label: "Findings" },
] as const;

export function LabApp() {
  const mode = useLab((s) => s.mode);
  const setMode = useLab((s) => s.setMode);
  const running = useLab((s) => s.running);
  const setRunning = useLab((s) => s.setRunning);
  const reset = useLab((s) => s.reset);
  const stepOnce = useLab((s) => s.stepOnce);
  const advance = useLab((s) => s.advance);
  const timeScale = useLab((s) => s.timeScale);
  const setTimeScale = useLab((s) => s.setTimeScale);
  const tab = useLab((s) => s.tab);
  const setTab = useLab((s) => s.setTab);
  const live = useLab((s) => s.live);
  const conservativeLive = useLab((s) => s.conservativeLive);
  const preset = useLab((s) => s.preset);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const raw = Math.min((now - last) / 1000, 0.05);
      last = now;
      const scale = useLab.getState().timeScale;
      const dt = raw * scale;
      const sub = Math.min(12, Math.max(1, Math.ceil(dt / 0.008)));
      const slice = dt / sub;
      for (let i = 0; i < sub; i++) {
        const hit = advance(slice);
        if (hit) break;
      }
      if (useLab.getState().running) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, advance]);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-wide text-accent uppercase">Tesla Earth resonance engine</p>
            <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">Quiver Lab</h1>
          </div>
          <div className="flex items-center rounded-lg bg-raised p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode("conservative")}
              className={cn(
                "rounded px-3 py-1.5 font-medium transition-colors",
                mode === "conservative" ? "bg-accent text-bg font-bold shadow-xs" : "text-muted hover:text-fg",
              )}
            >
              🛡️ Conservative Physics
            </button>
            <button
              type="button"
              onClick={() => setMode("historical")}
              className={cn(
                "rounded px-3 py-1.5 font-medium transition-colors",
                mode === "historical" ? "bg-warn text-bg font-bold shadow-xs" : "text-muted hover:text-fg",
              )}
            >
              ⚠️ Historical / Phenomenological
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={running ? "outline" : "primary"}
              size="md"
              onClick={() => setRunning(!running)}
              aria-label={running ? "Pause" : "Run"}
            >
              {running ? <Pause className="size-4" /> : <Play className="size-4" />}
              {running ? "Pause" : "Run"}
            </Button>
            <Button type="button" variant="outline" size="md" onClick={() => stepOnce()} aria-label="Step">
              <SkipForward className="size-4" />
              Step
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={() => reset()} aria-label="Reset">
              <RotateCcw className="size-4" />
              Reset
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        {mode === "historical" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warn/30 bg-warn/10 px-4 py-2 text-xs text-warn">
            <p>
              <strong className="uppercase tracking-wider">⚠️ Historical / Phenomenological Mode:</strong>{" "}
              Simulates legacy open-loop assumptions (earthGrip, regenerativeGain, loopGain &gt; 1).
              Energy is NOT conserved; scalars are phenomenological.
            </p>
            <button
              type="button"
              onClick={() => setMode("conservative")}
              className="font-medium underline hover:text-fg"
            >
              Switch to Conservative Physics
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-xs text-accent">
            <p>
              <strong className="uppercase tracking-wider">🛡️ Energy-Conserved Model:</strong>{" "}
              Strict closed-system first-principles ODEs with Cassie-Mayr spark arc, 3×3 positive-definite inductance matrix, Thevenin environmental sources, and ΔE ≤ 100 µJ ledger closure. Environmental source values are analytical/estimated; hardware validation has not yet been performed.
            </p>
            <span className="font-mono text-[11px] opacity-80">Phase 6.5 Compliant</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {mode === "conservative"
              ? `t ${conservativeLive.t_s.toFixed(2)}s · dumps ${conservativeLive.sparkCount} · ΔE ${(conservativeLive.ledger.E_residual_J * 1e6).toFixed(1)} µJ (${(conservativeLive.ledger.E_residual_relative * 100).toFixed(4)}%)`
              : `t ${live.t_s.toFixed(2)}s · dumps ${live.dumpCount} · ${preset}`}
          </p>
          <label className="flex items-center gap-3 font-mono text-xs text-muted">
            Time ×{timeScale.toFixed(0)}
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={timeScale}
              onChange={(e) => setTimeScale(Number(e.target.value))}
              className="h-11 w-32 accent-accent"
              aria-label="Time scale"
            />
          </label>
        </div>

        <section className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Schematic />
          </div>
          <div className="lg:col-span-4">
            <Scope />
          </div>
          <div className="lg:col-span-3">
            <StabilityCard />
          </div>
        </section>

        <ControlsPanel />

        <section className="rounded-xl bg-surface p-3 shadow-[0_0_0_1px_rgba(230,228,220,0.08)] sm:p-5">
          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Lab notebooks">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "h-11 min-w-11 rounded-md px-4 text-sm font-medium",
                  tab === t.id ? "bg-fg text-bg" : "bg-raised text-muted",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === "ledger" ? <LedgerPanel /> : null}
            {tab === "data" ? <TelemetryTable /> : null}
            {tab === "log" ? <EventLog /> : null}
            {tab === "papers" ? <PapersPanel /> : null}
            {tab === "findings" ? <FindingsPanel /> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
