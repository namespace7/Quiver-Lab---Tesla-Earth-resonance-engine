import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PRESETS, PRESET_ORDER } from "@/lib/engine/presets";
import { useLab } from "@/lib/lab-store";
import { siFormat } from "@/lib/utils";
import type { EngineParams } from "@/lib/engine/types";
import type { ConservativeParams } from "@/lib/engine/conservative-types";

function LegacyRow({
  label,
  value,
  unit,
  min,
  max,
  step,
  field,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  field: keyof EngineParams;
}) {
  const patchParams = useLab((s) => s.patchParams);
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2 font-mono text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular text-fg">
          {siFormat(value, 3)}
          {unit}
        </span>
      </span>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => patchParams({ [field]: v[0] } as Partial<EngineParams>)}
      />
    </label>
  );
}

function ConservativeRow({
  label,
  value,
  unit,
  min,
  max,
  step,
  field,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  field: keyof ConservativeParams;
}) {
  const patchConservativeParams = useLab((s) => s.patchConservativeParams);
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2 font-mono text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular text-fg">
          {siFormat(value, 3)}
          {unit}
        </span>
      </span>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) =>
          patchConservativeParams({ [field]: v[0] } as Partial<ConservativeParams>)
        }
      />
    </label>
  );
}

const CONSERVATIVE_PRESETS: {
  id: string;
  name: string;
  blurb: string;
  patch: Partial<ConservativeParams>;
}[] = [
  {
    id: "baseline",
    name: "1931 Baseline",
    blurb: "Tesla 1931 car 22 nF HV tank, 8 kV spark gap, 420-turn extra coil.",
    patch: {
      primaryCapacitanceF: 22e-9,
      sparkVoltageV: 8000,
      extraCoilTurns: 420,
      loadingCoilH: 0.8,
      groundResistanceOhm: 8.0,
      couplingK: 0.18,
      motorCouplingKm: 0.15,
      starterOn: true,
      starterVoltageV: 10000,
    },
  },
  {
    id: "tight_coupled",
    name: "Tight Coupling",
    blurb: "Higher magnetic coupling k = 0.35, km = 0.22, optimal inductive transfer.",
    patch: {
      couplingK: 0.35,
      motorCouplingKm: 0.22,
      groundResistanceOhm: 4.0,
      loadingCoilH: 0.5,
    },
  },
  {
    id: "low_ground",
    name: "Low Ground R",
    blurb: "Deep ground rod array (Rg = 1.5 Ω) maximizing loaded resonator Q.",
    patch: {
      groundResistanceOhm: 1.5,
      extraCoilTurns: 550,
      antennaHeightM: 2.5,
    },
  },
  {
    id: "ringdown",
    name: "No Starter Ringdown",
    blurb: "Starter disconnected. Passive zero-source damped ring-down.",
    patch: {
      starterOn: false,
      sparkVoltageV: 8000,
    },
  },
  {
    id: "storm",
    name: "Storm Weather",
    blurb: "High atmospheric gradient Ez = 10 kV/m with enhanced corona current.",
    patch: {
      weather: "storm",
      antennaHeightM: 3.5,
    },
  },
];

export function ControlsPanel() {
  const mode = useLab((s) => s.mode);
  const params = useLab((s) => s.params);
  const cParams = useLab((s) => s.conservativeParams);
  const cLive = useLab((s) => s.conservativeLive);
  const preset = useLab((s) => s.preset);
  const loadPreset = useLab((s) => s.loadPreset);
  const patchParams = useLab((s) => s.patchParams);
  const patchConservativeParams = useLab((s) => s.patchConservativeParams);

  if (mode === "conservative") {
    const kSumSq = cParams.couplingK * cParams.couplingK + cParams.motorCouplingKm * cParams.motorCouplingKm;
    const isPD = kSumSq < 1.0;

    return (
      <div className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-[0_0_0_1px_rgba(230,228,220,0.08)]">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-medium tracking-tight">
              Physical Parameters (Conservative Engine)
            </h2>
            <span
              className={`rounded px-2.5 py-1 font-mono text-xs font-semibold ${
                isPD ? "bg-ok/20 text-ok" : "bg-warn/20 text-warn"
              }`}
            >
              Matrix Positive-Definite: det(L) &gt; 0 (k² + km² = {kSumSq.toFixed(3)})
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Strict energy conservation. Sliders deform physical state with audited parameter work (W_param).
            Zero phantom gain scalars.
          </p>
        </div>

        {/* Conservative Presets */}
        <div className="flex flex-wrap gap-2">
          {CONSERVATIVE_PRESETS.map((cp) => (
            <Button
              key={cp.id}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => patchConservativeParams(cp.patch)}
            >
              {cp.name}
            </Button>
          ))}
        </div>

        {/* Sliders Grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <ConservativeRow
            label="Primary Tank C"
            field="primaryCapacitanceF"
            value={cParams.primaryCapacitanceF}
            unit="F"
            min={5e-9}
            max={100e-9}
            step={1e-9}
          />
          <ConservativeRow
            label="Spark Gap Vbreak"
            field="sparkVoltageV"
            value={cParams.sparkVoltageV}
            unit="V"
            min={1000}
            max={20000}
            step={100}
          />
          <ConservativeRow
            label="Coupling k (Prim-Extra)"
            field="couplingK"
            value={cParams.couplingK}
            unit=""
            min={0.01}
            max={0.5}
            step={0.01}
          />
          <ConservativeRow
            label="Coupling km (Extra-Motor)"
            field="motorCouplingKm"
            value={cParams.motorCouplingKm}
            unit=""
            min={0.01}
            max={0.5}
            step={0.01}
          />
          <ConservativeRow
            label="Extra Coil Turns N"
            field="extraCoilTurns"
            value={cParams.extraCoilTurns}
            unit=""
            min={50}
            max={800}
            step={10}
          />
          <ConservativeRow
            label="Loading Coil L"
            field="loadingCoilH"
            value={cParams.loadingCoilH}
            unit="H"
            min={0}
            max={4.0}
            step={0.05}
          />
          <ConservativeRow
            label="Ground Resistance Rg"
            field="groundResistanceOhm"
            value={cParams.groundResistanceOhm}
            unit="Ω"
            min={0.2}
            max={40}
            step={0.2}
          />
          <ConservativeRow
            label="Antenna Height h"
            field="antennaHeightM"
            value={cParams.antennaHeightM}
            unit="m"
            min={0.5}
            max={5.0}
            step={0.1}
          />
          <ConservativeRow
            label="Starter Supply V"
            field="starterVoltageV"
            value={cParams.starterVoltageV}
            unit="V"
            min={1000}
            max={15000}
            step={250}
          />
          <ConservativeRow
            label="Starter Resistor R"
            field="starterResistanceOhm"
            value={cParams.starterResistanceOhm}
            unit="Ω"
            min={100}
            max={2500}
            step={50}
          />
          <ConservativeRow
            label="Motor Torque Const Kt"
            field="torqueConstantKt"
            value={cParams.torqueConstantKt}
            unit="N·m/A"
            min={0.1}
            max={1.0}
            step={0.02}
          />
          <ConservativeRow
            label="Vehicle Mass m"
            field="vehicleMassKg"
            value={cParams.vehicleMassKg}
            unit="kg"
            min={800}
            max={2500}
            step={50}
          />
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={cParams.starterOn ? "accent" : "outline"}
            onClick={() => patchConservativeParams({ starterOn: !cParams.starterOn })}
          >
            Starter Supply {cParams.starterOn ? "ON" : "OFF"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={cParams.weather === "storm" ? "accent" : "outline"}
            onClick={() =>
              patchConservativeParams({
                weather: cParams.weather === "storm" ? "fair" : "storm",
              })
            }
          >
            Weather: {cParams.weather.toUpperCase()}
          </Button>
          <span className="ml-auto font-mono text-xs text-muted self-center">
            Resonance: f0 = {siFormat(cLive.f_extra_loaded_Hz)}Hz · Q = {cLive.natural_Q.toFixed(1)}
          </span>
        </div>
      </div>
    );
  }

  // Historical mode
  return (
    <div className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-[0_0_0_1px_rgba(230,228,220,0.08)]">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium tracking-tight">
            Bench Knobs (Historical / Phenomenological)
          </h2>
          <span className="rounded bg-warn/20 px-2.5 py-1 font-mono text-xs font-semibold text-warn">
            ⚠️ Phenomenological Mode
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Sweep grip and ground until loop gain crosses one. Contains unvalidated scalar terms.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESET_ORDER.map((id) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={preset === id ? "primary" : "outline"}
            onClick={() => loadPreset(id)}
          >
            {PRESETS[id].name}
          </Button>
        ))}
      </div>
      <p className="font-mono text-xs text-subtle">
        {PRESETS[preset].paper} — {PRESETS[preset].blurb}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <LegacyRow
          label="Earth grip"
          field="earthGrip"
          value={params.earthGrip}
          unit=""
          min={0}
          max={2}
          step={0.01}
        />
        <LegacyRow
          label="Regen gain"
          field="regenerativeGain"
          value={params.regenerativeGain}
          unit=""
          min={0}
          max={1.4}
          step={0.01}
        />
        <LegacyRow
          label="Coupling k"
          field="couplingK"
          value={params.couplingK}
          unit=""
          min={0.02}
          max={0.45}
          step={0.01}
        />
        <LegacyRow
          label="Ground R"
          field="groundResistanceOhm"
          value={params.groundResistanceOhm}
          unit="Ω"
          min={0.05}
          max={40}
          step={0.05}
        />
        <LegacyRow
          label="Spark V"
          field="sparkVoltageV"
          value={params.sparkVoltageV}
          unit="V"
          min={500}
          max={80000}
          step={100}
        />
        <LegacyRow
          label="C primary"
          field="primaryCapacitanceF"
          value={params.primaryCapacitanceF}
          unit="F"
          min={5e-9}
          max={3e-7}
          step={1e-9}
        />
        <LegacyRow
          label="Turns N"
          field="extraCoilTurns"
          value={params.extraCoilTurns}
          unit=""
          min={20}
          max={800}
          step={1}
        />
        <LegacyRow
          label="Loading L"
          field="loadingCoilH"
          value={params.loadingCoilH}
          unit="H"
          min={0}
          max={40}
          step={0.05}
        />
        <LegacyRow
          label="Antenna h"
          field="antennaHeightM"
          value={params.antennaHeightM}
          unit="m"
          min={0.4}
          max={80}
          step={0.1}
        />
        <LegacyRow
          label="Latitude"
          field="latitude"
          value={params.latitude}
          unit="°"
          min={-80}
          max={80}
          step={0.1}
        />
        <LegacyRow
          label="Speed"
          field="speedMs"
          value={params.speedMs}
          unit="m/s"
          min={0}
          max={50}
          step={0.5}
        />
        <LegacyRow
          label="Starter W"
          field="starterWatts"
          value={params.starterWatts}
          unit="W"
          min={0}
          max={4000}
          step={10}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={params.mode === "earth" ? "accent" : "outline"}
          onClick={() => patchParams({ mode: params.mode === "earth" ? "coil" : "earth" })}
        >
          Mode {params.mode}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={params.starterOn ? "accent" : "outline"}
          onClick={() => patchParams({ starterOn: !params.starterOn })}
        >
          Starter {params.starterOn ? "on" : "off"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={params.weather === "storm" ? "accent" : "outline"}
          onClick={() => patchParams({ weather: params.weather === "storm" ? "fair" : "storm" })}
        >
          Weather {params.weather}
        </Button>
      </div>
    </div>
  );
}
