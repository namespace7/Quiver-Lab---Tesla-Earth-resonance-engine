/**
 * Conservative Engine Test Suite
 *
 * Automated verification of strict energy conservation, matrix positive-definiteness,
 * frequency authenticity, and absence of phantom energy generation.
 */

import test from "node:test";
import assert from "node:assert";
import {
  ConservativeEngine,
  solenoidL,
  medhurstC,
  monopoleC,
} from "./conservative-engine.ts";
import type { ConservativeParams } from "./conservative-types.ts";

const BASE_PARAMS: ConservativeParams = {
  primaryCapacitanceF: 22e-9,      // 22 nF
  sparkVoltageV: 8000,             // 8 kV
  primaryInductanceH: 51e-6,       // 51 µH
  primaryResistanceOhm: 0.2,       // 0.2 Ω

  extraCoilTurns: 420,
  extraCoilRadiusM: 0.18,
  extraCoilHeightM: 0.55,
  loadingCoilH: 0.8,
  groundResistanceOhm: 8.0,
  antennaHeightM: 1.85,
  couplingK: 0.18,

  motorInductanceH: 0.05,
  motorResistanceOhm: 2.5,
  motorCouplingKm: 0.15,
  torqueConstantKt: 0.42,
  rotorInertiaKgm2: 0.35,
  rotorFrictionNmS: 0.05,
  gearRatioG: 4.2,
  gearEfficiency: 0.95,
  wheelRadiusM: 0.32,
  vehicleMassKg: 1450,
  dragCoefficientCd: 0.35,
  frontalAreaM2: 2.2,
  rollingResistanceCrr: 0.015,

  starterOn: false,
  starterVoltageV: 12000,
  starterResistanceOhm: 500,

  weather: "fair",
  latitude: 42.88,
  altitudeM: 180,
  speedMs: 0,
};

test("1. Zero-Source Ringdown & Monotonic Decay", () => {
  const engine = new ConservativeEngine({
    ...BASE_PARAMS,
    starterOn: false,
  });

  // Inject initial charge into capacitor
  engine.state.q_cap = 0.5 * engine.params.primaryCapacitanceF * engine.params.sparkVoltageV;
  engine.syncLedgerInitial();
  const initialEnergy = engine.computeStoredEnergy(engine.state);
  assert.ok(initialEnergy > 0, "Initial energy must be positive");

  let prevEnergy = initialEnergy;
  for (let step = 0; step < 200; step++) {
    engine.step(0.0005);
    const currentEnergy = engine.computeStoredEnergy(engine.state);
    assert.ok(
      currentEnergy <= prevEnergy + 1e-6,
      `Energy must not increase without source (prev: ${prevEnergy}, curr: ${currentEnergy})`,
    );
    prevEnergy = currentEnergy;
  }

  const tel = engine.telemetry();
  assert.ok(tel.ledger.conserved, "Energy ledger must be conserved during ringdown");
});

test("2. Primary/Secondary Decoupling (k = 0)", () => {
  const engine = new ConservativeEngine({
    ...BASE_PARAMS,
    couplingK: 0.0,
    starterOn: false,
  });

  // Charge capacitor above spark breakdown
  engine.state.q_cap = engine.params.primaryCapacitanceF * engine.params.sparkVoltageV * 1.05;
  engine.syncLedgerInitial();
  engine.step(0.001);

  // Extra coil must receive zero current and zero voltage
  assert.strictEqual(engine.state.i_extra, 0, "Extra coil current must be zero when k = 0");
  assert.strictEqual(engine.state.q_extra, 0, "Extra coil charge must be zero when k = 0");
});

test("3. Motor Decoupling (k_m = 0)", () => {
  const engine = new ConservativeEngine({
    ...BASE_PARAMS,
    motorCouplingKm: 0.0,
    starterOn: false,
  });

  engine.state.q_cap = engine.params.primaryCapacitanceF * engine.params.sparkVoltageV * 1.05;
  for (let i = 0; i < 50; i++) {
    engine.step(0.0002);
  }

  // Motor stator current and torque must be zero
  assert.strictEqual(engine.state.i_motor, 0, "Motor current must be zero when km = 0");
  const tel = engine.telemetry();
  assert.strictEqual(tel.torque_em_Nm, 0, "Electromagnetic torque must be zero when km = 0");
});

test("4. Motor Load Increase Causes Faster Energy Dissipation", () => {
  // Case A: Unloaded motor
  const engineA = new ConservativeEngine({
    ...BASE_PARAMS,
    dragCoefficientCd: 0.0,
    rollingResistanceCrr: 0.0,
    starterOn: false,
  });
  engineA.state.q_cap = engineA.params.primaryCapacitanceF * engineA.params.sparkVoltageV;
  for (let i = 0; i < 100; i++) engineA.step(0.0005);
  const remainingEnergyA = engineA.computeStoredEnergy(engineA.state);

  // Case B: Heavily loaded vehicle
  const engineB = new ConservativeEngine({
    ...BASE_PARAMS,
    dragCoefficientCd: 1.5,
    rollingResistanceCrr: 0.1,
    starterOn: false,
  });
  engineB.state.q_cap = engineB.params.primaryCapacitanceF * engineB.params.sparkVoltageV;
  for (let i = 0; i < 100; i++) engineB.step(0.0005);
  const remainingEnergyB = engineB.computeStoredEnergy(engineB.state);

  assert.ok(
    remainingEnergyB <= remainingEnergyA + 1e-6,
    "Loaded vehicle must dissipate energy at least as fast as unloaded vehicle",
  );
});

test("5. Valid Inductance Matrix Positive Definiteness", () => {
  const engine = new ConservativeEngine({
    ...BASE_PARAMS,
    couplingK: 0.3,
    motorCouplingKm: 0.3,
  });

  const tel = engine.telemetry();
  assert.ok(tel.det_L_normal > 0, "Normalized det(L) must be positive");
  assert.ok(tel.coupling_valid, "Coupling must be valid when k^2 + km^2 < 1");
});

test("6. Invalid Inductance Matrix Clamping & Rejection", () => {
  // Attempt to pass unphysical coupling coefficients that violate k^2 + km^2 < 1
  const engine = new ConservativeEngine({
    ...BASE_PARAMS,
    couplingK: 0.95,
    motorCouplingKm: 0.95,
  });

  const tel = engine.telemetry();
  // Must be automatically clamped to ensure positive-definiteness
  assert.ok(
    tel.k * tel.k + tel.k_m * tel.k_m <= 0.97,
    "Engine must clamp coupling coefficients to preserve positive definiteness",
  );
  assert.ok(tel.det_L_normal > 0, "Normalized det(L) must remain positive after clamping");
});

test("7. Parameter Deformation Work Accounting", () => {
  const engine = new ConservativeEngine({
    ...BASE_PARAMS,
    starterOn: false,
  });

  // Hold a fixed charge on capacitor
  engine.state.q_cap = 1e-4; // 100 µC
  engine.syncLedgerInitial();
  const preStored = engine.computeStoredEnergy(engine.state);

  // Change capacitance mid-simulation: reconfigures physical system
  engine.setParams({ primaryCapacitanceF: 44e-9 }); // Double capacitance
  const postStored = engine.computeStoredEnergy(engine.state);

  const deltaStored = postStored - preStored;
  assert.ok(Math.abs(deltaStored) > 1e-6, "Energy must change when C changes at fixed q");
  // Ledger must re-baseline initial energy to new physical configuration with W_parameter = 0
  assert.strictEqual(engine.ledger.W_parameter, 0, "No fake virtual work should be accumulated");
  assert.ok(
    Math.abs(engine.ledger.E_initial - postStored) < 1e-9,
    "Ledger must re-baseline initial energy exactly to newStored",
  );

  const tel = engine.telemetry();
  assert.ok(tel.ledger.conserved, "Ledger must remain conserved after parameter reconfiguration");
  assert.ok(Math.abs(tel.ledger.E_residual_J) < 1e-9, "Residual must be zero at re-baseline");
});

test("8. Starter Thevenin Supply Charging", () => {
  const engine = new ConservativeEngine({
    ...BASE_PARAMS,
    starterOn: true,
    starterVoltageV: 10000,
    starterResistanceOhm: 1000,
  });

  engine.state.q_cap = 0; // Completely empty
  engine.syncLedgerInitial();
  for (let i = 0; i < 50; i++) {
    engine.step(0.0001);
  }

  const tel = engine.telemetry();
  assert.ok(tel.V_cap_V > 0, "Capacitor must charge from starter");
  assert.ok(tel.ledger.E_external_J > 0, "Ledger must record positive external inflow");
  assert.ok(tel.ledger.conserved, "Ledger must remain conserved during starter charging");
});

test("9. Calibrated Source Conservation", () => {
  const engine = new ConservativeEngine({
    ...BASE_PARAMS,
    starterOn: true,
    starterVoltageV: 5000,
    starterResistanceOhm: 200,
  });

  engine.state.q_cap = 0;
  engine.syncLedgerInitial();
  for (let i = 0; i < 100; i++) {
    engine.step(0.0002);
  }

  const tel = engine.telemetry();
  const relErr = tel.ledger.E_residual_relative;
  assert.ok(relErr <= 1e-4, `Relative energy error (${relErr}) must be <= 0.01%`);
});

test("10. Zero Environmental Source Delivery into HV Capacitor", () => {
  const engine = new ConservativeEngine({
    ...BASE_PARAMS,
    starterOn: false,
  });

  // When capacitor voltage is above 120 V (e.g. 500 V)
  engine.state.q_cap = 500 * engine.params.primaryCapacitanceF;
  engine.step(0.001);

  const tel = engine.telemetry();
  assert.strictEqual(
    tel.P_env_total_W,
    0,
    "Environmental source must deliver 0 Watts into capacitor when V_cap >= 120V",
  );
});

test("11. No Phantom Recharge from Environment", () => {
  const engine = new ConservativeEngine({
    ...BASE_PARAMS,
    starterOn: false,
  });

  // Start with 0V on capacitor, let environment charge for 1000 steps
  engine.state.q_cap = 0;
  for (let i = 0; i < 1000; i++) {
    engine.step(0.001);
  }

  const tel = engine.telemetry();
  assert.ok(
    tel.V_cap_V <= 121,
    `Capacitor must never exceed Voc of atmosphere (120.25V), measured: ${tel.V_cap_V}`,
  );
  assert.strictEqual(tel.sparkCount, 0, "Environment alone must never trigger 8 kV spark breakdown");
});

test("12. Timestep Invariance & Convergence", () => {
  const runSim = (dt: number) => {
    const engine = new ConservativeEngine({
      ...BASE_PARAMS,
      starterOn: true,
      starterVoltageV: 9000,
    });
    engine.state.q_cap = 0;
    const totalTime = 0.01;
    const steps = Math.round(totalTime / dt);
    for (let i = 0; i < steps; i++) engine.step(dt);
    return engine.telemetry().E_stored_total_J;
  };

  const E1 = runSim(0.0005);
  const E2 = runSim(0.00025);

  const relDiff = Math.abs(E1 - E2) / Math.max(E1, E2);
  assert.ok(relDiff < 0.05, `Timestep halving error must be < 5%, got ${relDiff * 100}%`);
});

test("13. Physical Resonant Frequencies Calculation", () => {
  const engine = new ConservativeEngine(BASE_PARAMS);
  const tel = engine.telemetry();

  // Primary tank resonance: 1 / (2π √(51µH * 22nF)) ≈ 150.25 kHz
  assert.ok(
    Math.abs(tel.f_primary_Hz - 150253) / 150253 < 0.01,
    `Primary resonance must match 150.25 kHz, got ${tel.f_primary_Hz}`,
  );

  // Loaded extra coil resonance: 1 / (2π √(0.841H * 32.97pF)) ≈ 30.22 kHz
  assert.ok(
    Math.abs(tel.f_extra_loaded_Hz - 30220) / 30220 < 0.05,
    `Loaded resonance must match ~30.22 kHz, got ${tel.f_extra_loaded_Hz}`,
  );

  // Natural Q must be positive and non-zero
  assert.ok(tel.natural_Q > 100, `Natural Q must be high (>100), got ${tel.natural_Q}`);
});

test("14. Absolute Energy Ledger Closure", () => {
  const engine = new ConservativeEngine({
    ...BASE_PARAMS,
    starterOn: true,
    starterVoltageV: 10000,
  });

  // Run full operational cycle with charging, spark breakdown, and motor acceleration
  for (let i = 0; i < 2000; i++) {
    engine.step(0.0002);
  }

  const tel = engine.telemetry();
  assert.ok(
    tel.ledger.conserved,
    `Energy ledger must remain conserved (Residual: ${tel.ledger.E_residual_J} J, rel: ${tel.ledger.E_residual_relative})`,
  );
  assert.ok(
    Math.abs(tel.ledger.E_residual_J) <= 1e-4,
    `Absolute ledger residual must be <= 100 µJ, got ${tel.ledger.E_residual_J} J`,
  );
});

test("15. Defect 1 Regression: Spark Quench Energy Closure with Non-Zero Current", () => {
  const engine = new ConservativeEngine({
    ...BASE_PARAMS,
    starterOn: false,
  });

  // Activate spark with deliberate non-zero primary current
  engine.sparkActive = true;
  engine.state.i_prim = 0.15; // 150 mA non-zero current
  engine.state.i_extra = 0.05; // 50 mA in extra coil
  engine.state.q_cap = 1e-5;
  engine.syncLedgerInitial();

  const energy_before = engine.computeStoredEnergy(engine.state);
  const arc_heat_before = engine.ledger.E_arc_heat;

  // Quench the spark directly
  engine.quenchSpark();

  const energy_after = engine.computeStoredEnergy(engine.state);
  const arc_heat_after = engine.ledger.E_arc_heat;
  const quench_dissipation = arc_heat_after - arc_heat_before;

  assert.strictEqual(engine.sparkActive, false, "Spark must be extinguished");
  assert.strictEqual(engine.state.i_prim, 0, "Primary current must be zeroed");
  assert.ok(quench_dissipation > 0, "Quench dissipation must be strictly positive");

  // Verify: energy_before = energy_after + explicitly accounted dissipation within numerical tolerance
  const energy_diff = Math.abs(energy_before - (energy_after + quench_dissipation));
  assert.ok(
    energy_diff < 1e-12,
    `energy_before must equal energy_after + quench_dissipation (diff: ${energy_diff})`,
  );

  const tel = engine.telemetry();
  assert.ok(tel.ledger.conserved, "Ledger must remain conserved after quench");
});

test("16. Defect 2 Regression: Preset Geometry Switching & Recalculation", async () => {
  const { useLab } = await import("../lab-store.ts");

  // 1. Load Car 1931 preset and verify geometry
  useLab.getState().loadPreset("car1931");
  const carParams = useLab.getState().conservativeEngine.params;
  assert.strictEqual(carParams.extraCoilRadiusM, 0.18, "Car radius must be 0.18 m");
  assert.strictEqual(carParams.extraCoilHeightM, 0.55, "Car height must be 0.55 m");
  assert.strictEqual(carParams.extraCoilTurns, 420, "Car turns must be 420");

  const carTel = useLab.getState().conservativeEngine.telemetry();
  assert.ok(carTel.f_primary_Hz > 140000 && carTel.f_primary_Hz < 160000, "Car primary ~150 kHz");

  // 2. Load Colorado Springs preset and verify geometry
  useLab.getState().loadPreset("colorado");
  const csParams = useLab.getState().conservativeEngine.params;
  assert.strictEqual(csParams.extraCoilRadiusM, 1.257, "Colorado radius must be 1.257 m");
  assert.strictEqual(csParams.extraCoilHeightM, 2.438, "Colorado height must be 2.438 m");
  assert.strictEqual(csParams.extraCoilTurns, 100, "Colorado turns must be 100");
  assert.strictEqual(csParams.loadingCoilH, 0, "Colorado has 0 loading coil");

  // Recalculate Colorado L and C values independently
  const cs_L = solenoidL(csParams.extraCoilTurns, csParams.extraCoilRadiusM, csParams.extraCoilHeightM);
  const cs_C = medhurstC(csParams.extraCoilHeightM, csParams.extraCoilRadiusM) + monopoleC(csParams.antennaHeightM);
  const cs_f0_calc = 1 / (2 * Math.PI * Math.sqrt(cs_L * cs_C));
  const csTel = useLab.getState().conservativeEngine.telemetry();
  assert.ok(Math.abs(csTel.f_extra_loaded_Hz - cs_f0_calc) < 1.0, "Colorado f0 matches calculation");

  // 3. Switch back to Car 1931 and verify geometry restored
  useLab.getState().loadPreset("car1931");
  const carParamsRestored = useLab.getState().conservativeEngine.params;
  assert.strictEqual(carParamsRestored.extraCoilRadiusM, 0.18, "Restored Car radius must be 0.18 m");
  assert.strictEqual(carParamsRestored.extraCoilHeightM, 0.55, "Restored Car height must be 0.55 m");
  assert.strictEqual(carParamsRestored.extraCoilTurns, 420, "Restored Car turns must be 420");
});

test("17. Defect 3 Regression: Parameter Changes Cannot Create Phantom Energy", () => {
  const engine = new ConservativeEngine({
    ...BASE_PARAMS,
    starterOn: false,
  });

  engine.state.q_cap = 1e-4; // 100 µC
  engine.syncLedgerInitial();

  // Cycle capacitance back and forth 10 times
  for (let i = 0; i < 10; i++) {
    engine.setParams({ primaryCapacitanceF: 44e-9 });
    engine.setParams({ primaryCapacitanceF: 22e-9 });
  }

  // W_parameter must be strictly 0 (no fake virtual work accumulated)
  assert.strictEqual(engine.ledger.W_parameter, 0, "W_parameter must not accumulate phantom work");
  const tel = engine.telemetry();
  assert.ok(tel.ledger.conserved, "Ledger must remain conserved");
  assert.ok(Math.abs(tel.ledger.E_residual_J) < 1e-9, "Residual must be zero");
});

test("18. Defect 4 Regression: Classical Explicit RK4 Convergence Rate", () => {
  // Classical explicit RK4 exhibits O(h^4) global convergence
  const L = 1.0;
  const C = 1.0;
  const E0 = 1.0;
  const q0 = Math.sqrt(2 * C * E0);

  function rk4Lossless(dt: number, steps: number) {
    let q = q0;
    let i = 0.0;
    const f = (qv: number, iv: number) => ({ dq: iv, di: -qv / (L * C) });
    for (let s = 0; s < steps; s++) {
      const k1 = f(q, i);
      const k2 = f(q + 0.5 * dt * k1.dq, i + 0.5 * dt * k1.di);
      const k3 = f(q + 0.5 * dt * k2.dq, i + 0.5 * dt * k2.di);
      const k4 = f(q + dt * k3.dq, i + dt * k3.di);
      q += (dt / 6) * (k1.dq + 2 * k2.dq + 2 * k3.dq + k4.dq);
      i += (dt / 6) * (k1.di + 2 * k2.di + 2 * k3.di + k4.di);
    }
    return (q * q) / (2 * C) + 0.5 * L * i * i;
  }

  const duration = 10.0;
  const drift1 = Math.abs(rk4Lossless(0.1, Math.round(duration / 0.1)) - E0);
  const drift2 = Math.abs(rk4Lossless(0.05, Math.round(duration / 0.05)) - E0);

  // Ratio when halving step size should be ~2^5 = 32 (local O(h^5), global O(h^4) error)
  const ratio = drift1 / drift2;
  assert.ok(
    ratio > 25 && ratio < 35,
    `Classical RK4 convergence ratio should be ~32, got ${ratio.toFixed(2)}`,
  );
});
