import { stabilityOf } from "@/lib/engine/engine";
import { useLab } from "@/lib/lab-store";
import { siFormat } from "@/lib/utils";

export function StabilityCard() {
  const mode = useLab((s) => s.mode);
  const live = useLab((s) => s.live);
  const cLive = useLab((s) => s.conservativeLive);
  const pausedBy = useLab((s) => s.pausedBy);

  if (mode === "conservative") {
    const ledger = cLive.ledger;
    const conserved = ledger.conserved;
    const resMicroJ = ledger.E_residual_J * 1e6;
    const tone = conserved ? "text-ok" : "text-warn";

    return (
      <div className="flex flex-col justify-between gap-4 rounded-lg bg-surface p-4 shadow-[0_0_0_1px_rgba(230,228,220,0.08)]">
        <div>
          <p className="font-mono text-xs tracking-wide text-muted uppercase">Energy Conservation</p>
          <p className={`mt-1 font-display text-3xl font-medium tracking-tight tabular ${tone}`}>
            {conserved ? "CONSERVED" : "DRIFT DETECTED"}
          </p>
          <p className="mt-1 font-mono text-xs text-muted">
            ΔE: {resMicroJ >= 0 ? "+" : ""}{resMicroJ.toFixed(2)} µJ ({(ledger.E_residual_relative * 100).toFixed(4)}%)
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-xs">
          <div>
            <dt className="text-subtle">Natural Q</dt>
            <dd className="tabular text-fg">{cLive.natural_Q.toFixed(1)}</dd>
          </div>
          <div>
            <dt className="text-subtle">f0 loaded</dt>
            <dd className="tabular text-fg">{siFormat(cLive.f_extra_loaded_Hz)}Hz</dd>
          </div>
          <div>
            <dt className="text-subtle">E stored</dt>
            <dd className="tabular text-fg">{siFormat(cLive.E_stored_total_J)}J</dd>
          </div>
          <div>
            <dt className="text-subtle">P mech</dt>
            <dd className="tabular text-fg">{siFormat(cLive.P_mech_W)}W</dd>
          </div>
          <div>
            <dt className="text-subtle">Dumps</dt>
            <dd className="tabular text-fg">{cLive.sparkCount}</dd>
          </div>
          <div>
            <dt className="text-subtle">Matrix det(L)</dt>
            <dd className="tabular text-fg">{cLive.coupling_valid ? "Positive Def" : "Clamped"}</dd>
          </div>
        </dl>
        {pausedBy ? (
          <p className="rounded-sm bg-raised px-3 py-2 font-mono text-xs text-warn">
            Break on {pausedBy}
          </p>
        ) : null}
      </div>
    );
  }

  // Historical mode
  const stab = stabilityOf(live.loopGain);
  const tone =
    stab === "unstable" ? "text-ok" : stab === "marginal" ? "text-warn" : "text-muted";

  return (
    <div className="flex flex-col justify-between gap-4 rounded-lg bg-surface p-4 shadow-[0_0_0_1px_rgba(230,228,220,0.08)]">
      <div>
        <p className="font-mono text-xs tracking-wide text-muted uppercase">Loop gain (Legacy)</p>
        <p className={`mt-1 font-display text-4xl font-medium tracking-tight tabular ${tone}`}>
          {live.loopGain.toFixed(3)}
        </p>
        <p className={`mt-1 text-sm ${tone}`}>
          {stab === "unstable"
            ? "Unstable — valve open"
            : stab === "marginal"
              ? "Marginal — hold the edge"
              : "Damped — needs starter"}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-xs">
        <div>
          <dt className="text-subtle">Q eff</dt>
          <dd className="tabular text-fg">{siFormat(live.Q_eff, 2)}</dd>
        </div>
        <div>
          <dt className="text-subtle">f0</dt>
          <dd className="tabular text-fg">{siFormat(live.f0_Hz)}Hz</dd>
        </div>
        <div>
          <dt className="text-subtle">P in</dt>
          <dd className="tabular text-fg">{siFormat(live.P_in_W)}W</dd>
        </div>
        <div>
          <dt className="text-subtle">P mech</dt>
          <dd className="tabular text-fg">{siFormat(live.P_mech_W)}W</dd>
        </div>
        <div>
          <dt className="text-subtle">Dumps</dt>
          <dd className="tabular text-fg">{live.dumpCount}</dd>
        </div>
        <div>
          <dt className="text-subtle">Lock</dt>
          <dd className="tabular text-fg">{live.resonanceLock ? "yes" : "no"}</dd>
        </div>
      </dl>
      {pausedBy ? (
        <p className="rounded-sm bg-raised px-3 py-2 font-mono text-xs text-warn">
          Break on {pausedBy}
        </p>
      ) : null}
    </div>
  );
}
