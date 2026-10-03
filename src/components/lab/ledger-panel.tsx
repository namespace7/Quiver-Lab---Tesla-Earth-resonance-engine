import { useLab } from "@/lib/lab-store";
import { siFormat } from "@/lib/utils";

export function LedgerPanel() {
  const cLive = useLab((s) => s.conservativeLive);
  const ledger = cLive.ledger;
  const sources = cLive.sources;

  const conserved = ledger.conserved;
  const resMicroJ = ledger.E_residual_J * 1e6;
  const relPct = ledger.E_residual_relative * 100;
  const totalInflows = ledger.E_initial_J + ledger.E_external_J + ledger.E_environment_J + ledger.W_parameter_J;
  const totalLosses = ledger.E_heat_J + ledger.E_radiated_J;

  return (
    <div className="flex flex-col gap-6 font-mono text-xs">
      {/* Header Summary Banner */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4 ${
          conserved
            ? "border-ok/30 bg-ok/10 text-ok"
            : "border-warn/30 bg-warn/10 text-warn"
        }`}
      >
        <div>
          <span className="text-sm font-semibold tracking-wide uppercase">
            Energy Ledger Status: {conserved ? "CONSERVED ✓" : "VIOLATION ✗"}
          </span>
          <p className="mt-1 text-muted">
            Fundamental Invariant: E_in + W_param − E_stored − E_losses = E_residual
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular">
            ΔE = {resMicroJ >= 0 ? "+" : ""}
            {resMicroJ.toFixed(2)} µJ
          </p>
          <p className="text-muted tabular">Rel Error: {relPct.toFixed(5)}% (Tol: ≤ 0.01%)</p>
        </div>
      </div>

      {/* Grid: Stored, Injected, Dissipated */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Stored Energy */}
        <div className="rounded-lg bg-raised p-4 shadow-sm">
          <h3 className="mb-3 font-display text-sm font-medium text-fg uppercase tracking-wider">
            1. Stored Energy (E_stored)
          </h3>
          <dl className="space-y-2">
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">HV Primary Cap (E_cap)</dt>
              <dd className="tabular text-fg">{siFormat(ledger.E_cap_J, 4)}J</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">Extra Coil Elec (E_extra)</dt>
              <dd className="tabular text-fg">{siFormat(ledger.E_extra_elec_J, 4)}J</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">Coupled Inductors (E_mag)</dt>
              <dd className="tabular text-fg">{siFormat(ledger.E_mag_coupled_J, 4)}J</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">Drivetrain Kinetic (E_kin)</dt>
              <dd className="tabular text-fg">{siFormat(ledger.E_kinetic_J, 4)}J</dd>
            </div>
            <div className="flex justify-between pt-1 font-bold">
              <dt className="text-accent">Total Stored</dt>
              <dd className="tabular text-accent">{siFormat(ledger.E_stored_J, 4)}J</dd>
            </div>
          </dl>
        </div>

        {/* Energy Injected */}
        <div className="rounded-lg bg-raised p-4 shadow-sm">
          <h3 className="mb-3 font-display text-sm font-medium text-fg uppercase tracking-wider">
            2. Energy Injected (E_in)
          </h3>
          <dl className="space-y-2">
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">Starter DC Supply</dt>
              <dd className="tabular text-fg">{siFormat(ledger.E_external_J, 4)}J</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">Environmental Delivered</dt>
              <dd className="tabular text-fg">{siFormat(ledger.E_environment_J, 4)}J</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">Parameter Deformation (W_param)</dt>
              <dd className="tabular text-fg">{siFormat(ledger.W_parameter_J, 4)}J</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">Initial Stored at t=0</dt>
              <dd className="tabular text-fg">{siFormat(ledger.E_initial_J, 4)}J</dd>
            </div>
            <div className="flex justify-between pt-1 font-bold">
              <dt className="text-accent">Total Injected + Init</dt>
              <dd className="tabular text-accent">{siFormat(totalInflows, 4)}J</dd>
            </div>
          </dl>
        </div>

        {/* Energy Dissipated */}
        <div className="rounded-lg bg-raised p-4 shadow-sm">
          <h3 className="mb-3 font-display text-sm font-medium text-fg uppercase tracking-wider">
            3. Dissipated Losses (E_losses)
          </h3>
          <dl className="space-y-2">
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">Spark Arc Heat (E_arc)</dt>
              <dd className="tabular text-fg">{siFormat(ledger.E_arc_heat_J, 4)}J</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">Primary Cu Loss</dt>
              <dd className="tabular text-fg">{siFormat(ledger.E_prim_cu_heat_J, 4)}J</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">Extra Coil Cu Loss</dt>
              <dd className="tabular text-fg">{siFormat(ledger.E_extra_cu_heat_J, 4)}J</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">Ground Return Heat</dt>
              <dd className="tabular text-fg">{siFormat(ledger.E_ground_heat_J, 4)}J</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">Motor Stator Cu Loss</dt>
              <dd className="tabular text-fg">{siFormat(ledger.E_motor_cu_heat_J, 4)}J</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">Gearbox Mesh Loss</dt>
              <dd className="tabular text-fg">{siFormat(ledger.E_gear_loss_J, 4)}J</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">Bearing Friction</dt>
              <dd className="tabular text-fg">{siFormat(ledger.E_friction_heat_J, 4)}J</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">Aerodynamic & Road Work</dt>
              <dd className="tabular text-fg">{siFormat(ledger.E_road_losses_J, 4)}J</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1">
              <dt className="text-muted">Radiation Losses</dt>
              <dd className="tabular text-fg">{siFormat(ledger.E_radiated_J, 4)}J</dd>
            </div>
            <div className="flex justify-between pt-1 font-bold">
              <dt className="text-accent">Total Dissipated</dt>
              <dd className="tabular text-accent">{siFormat(totalLosses, 4)}J</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Environmental Coupling Audit Table */}
      <div className="rounded-lg bg-raised p-4 shadow-sm">
        <h3 className="mb-2 font-display text-sm font-medium text-fg uppercase tracking-wider">
          Physical Environmental Thevenin Sources Audit
        </h3>
        <p className="mb-4 text-muted">
          All environmental channels are modeled as rigorous Thevenin/Helmholtz equivalent circuits.
          Passive sources cannot charge an 8 kV capacitor when Voc &lt; Vcap without a boost converter.
          Environmental source values are analytical/estimated; hardware validation has not yet been performed.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-border text-subtle">
                <th className="py-2 pr-4 font-medium">Source</th>
                <th className="py-2 pr-4 font-medium">Open-Circuit Voc</th>
                <th className="py-2 pr-4 font-medium">Thevenin Rth</th>
                <th className="py-2 pr-4 font-medium">Avail Pmax</th>
                <th className="py-2 pr-4 font-medium">Delivered P</th>
                <th className="py-2 font-medium">Governing Law / Boundary Condition</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((src) => (
                <tr key={src.name} className="border-b border-border/40 hover:bg-surface/50">
                  <td className="py-2 pr-4 font-medium text-fg">{src.name}</td>
                  <td className="py-2 pr-4 tabular text-accent">{siFormat(src.V_oc_V, 3)}V</td>
                  <td className="py-2 pr-4 tabular text-fg">{siFormat(src.Z_source_mag_ohm, 3)}Ω</td>
                  <td className="py-2 pr-4 tabular text-fg">{siFormat(src.P_available_W, 3)}W</td>
                  <td className="py-2 pr-4 tabular text-muted">{siFormat(src.P_delivered_W, 3)}W</td>
                  <td className="py-2 text-subtle">{src.classification}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
