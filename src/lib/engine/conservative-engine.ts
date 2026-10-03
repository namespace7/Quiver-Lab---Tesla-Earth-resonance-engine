/**
 * Conservative Physics Engine Core
 *
 * Implements strict, closed-system energy accounting.
 * 7-state physical coordinates, analytical 3x3 inductance inversion,
 * classical explicit fourth-order Runge-Kutta (RK4), unified drivetrain inertia,
 * and zero unmetered energy injection.
 */

import { ConservativeLedger } from "./conservative-ledger.ts";
import { EnvironmentalManager } from "./conservative-sources.ts";
import type {
  ConservativeParams,
  ConservativeStateVector,
  ConservativeTelemetry,
} from "./conservative-types.ts";
import type {
  EngineEvent,
  EventType,
  Telemetry,
  WaveSample,
} from "./types.ts";

const MU0 = 4 * Math.PI * 1e-7;
const EPS0 = 8.854187817e-12;
const RHO_CU = 1.68e-8;
const AWG6_M2 = 13.3e-6;

export function solenoidL(n: number, r: number, h: number): number {
  const height = Math.max(h, 0.02);
  // Long solenoid with Nagaoka-like aspect ratio factor
  const d = 2 * r;
  const aspect = d / height;
  const nagaoka = 1 / (1 + 0.45 * aspect);
  return (MU0 * n * n * Math.PI * r * r * nagaoka) / height;
}

export function monopoleC(h: number): number {
  const height = Math.max(h, 0.2);
  const a = 0.006; // 6 mm radius rod
  return (2 * Math.PI * EPS0 * height) / Math.log((2 * height) / a);
}

export function medhurstC(h: number, r: number): number {
  // Medhurst empirical self-capacitance in Farads
  const h_over_d = h / (2 * r);
  const coeff = 0.1126 * h_over_d + 0.08 + 0.27 * Math.sqrt(Math.max(1 / h_over_d, 0.01));
  const d_cm = 2 * r * 100;
  return Math.max(coeff * d_cm * 1e-12, 1e-12);
}

export class ConservativeEngine {
  params: ConservativeParams;
  state: ConservativeStateVector;
  ledger: ConservativeLedger;
  envManager: EnvironmentalManager;

  t = 0;
  cycle = 0;
  dumpCount = 0;
  sparkActive = false;
  sparkTimer = 0;

  events: EngineEvent[] = [];
  wave: WaveSample[] = [];
  dumpWave: WaveSample[] = [];
  strip: { t: number; gain: number; vCap: number; pMech: number }[] = [];
  stripAcc = 0;
  lastTelemetry: ConservativeTelemetry | null = null;
  private eventSeq = 0;

  // Cached components
  private L_extra = 0;
  private L_tot = 0;
  private C_self = 0;
  private C_top = 0;
  private C_tot = 0;
  private f0 = 0;
  private Q_natural = 0;
  private J_eq = 0;

  // Inductance matrix coefficients
  private M = 0;
  private Mm = 0;
  private det_L = 0;
  private inv_L: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  private inv_L_2x2: number[][] = [
    [0, 0],
    [0, 0],
  ];

  constructor(params: ConservativeParams) {
    this.params = { ...params };
    this.envManager = new EnvironmentalManager();

    // Initialize physical state vector
    // Initial charge to give nominal 2% of breakdown energy
    const initialV = 0.02 * this.params.sparkVoltageV;
    const initialQ = initialV * this.params.primaryCapacitanceF;

    this.state = {
      q_cap: initialQ,
      i_prim: 0,
      q_extra: 0,
      i_extra: 0,
      i_motor: 0,
      omega: 0,
      theta: 0,
    };

    this.updateDerived();
    const initialStored = this.computeStoredEnergy(this.state);
    this.ledger = new ConservativeLedger(initialStored);
  }

  setParams(patch: Partial<ConservativeParams>) {
    this.params = { ...this.params, ...patch };
    this.updateDerived();

    // Re-baseline the experiment ledger to the new physical configuration.
    // Changing C, L, or geometry reconfigures the physical experiment.
    // To prevent unphysical virtual work from accumulating as phantom energy,
    // the ledger re-baselines its initial energy to the new physical configuration.
    const newStored = this.computeStoredEnergy(this.state);
    this.ledger.reset(newStored);
  }

  quenchSpark() {
    if (!this.sparkActive) return;
    const p = this.params;
    // Compute residual primary magnetic energy before open-circuit cutoff: 1/2 Lp i_prim^2 + M i_prim i_extra
    const dE_quench =
      0.5 * p.primaryInductanceH * this.state.i_prim * this.state.i_prim +
      this.M * this.state.i_prim * this.state.i_extra;

    // Explicitly account residual energy as spark quench dissipation
    this.ledger.E_arc_heat += dE_quench;
    this.sparkActive = false;
    this.state.i_prim = 0;
  }

  reset(params?: ConservativeParams) {
    if (params) this.params = { ...params };
    this.t = 0;
    this.cycle = 0;
    this.dumpCount = 0;
    this.sparkActive = false;
    this.sparkTimer = 0;
    this.events = [];
    this.wave = [];
    this.dumpWave = [];
    this.strip = [];
    this.stripAcc = 0;
    this.lastTelemetry = null;

    const initialV = 0.02 * this.params.sparkVoltageV;
    const initialQ = initialV * this.params.primaryCapacitanceF;

    this.state = {
      q_cap: initialQ,
      i_prim: 0,
      q_extra: 0,
      i_extra: 0,
      i_motor: 0,
      omega: 0,
      theta: 0,
    };

    this.updateDerived();
    const initialStored = this.computeStoredEnergy(this.state);
    this.ledger.reset(initialStored);
  }

  syncLedgerInitial() {
    this.updateDerived();
    const initialStored = this.computeStoredEnergy(this.state);
    this.ledger.reset(initialStored);
  }

  private updateDerived() {
    const p = this.params;

    // Validate and clamp mutual coupling coefficients to ensure positive-definiteness
    // Condition: k^2 + km^2 <= 0.96
    const k_raw = Math.max(0.0, Math.min(0.9, p.couplingK));
    const km_raw = Math.max(0.0, Math.min(0.9, p.motorCouplingKm));
    const k_norm = Math.sqrt(k_raw * k_raw + km_raw * km_raw);

    let k = k_raw;
    let km = km_raw;
    if (k_norm >= 0.98) {
      const scale = 0.96 / k_norm;
      k = k_raw * scale;
      km = km_raw * scale;
    }
    p.couplingK = k;
    p.motorCouplingKm = km;

    // Resonator inductances
    this.L_extra = solenoidL(p.extraCoilTurns, p.extraCoilRadiusM, p.extraCoilHeightM);
    this.L_tot = this.L_extra + Math.max(0, p.loadingCoilH);

    // Resonator capacitances (Physical only - NO Cearth)
    this.C_self = medhurstC(p.extraCoilHeightM, p.extraCoilRadiusM);
    this.C_top = monopoleC(p.antennaHeightM);
    this.C_tot = Math.max(this.C_self + this.C_top, 1e-12);

    // Natural Resonant frequency
    this.f0 = 1 / (2 * Math.PI * Math.sqrt(this.L_tot * this.C_tot));
    const omega0 = 2 * Math.PI * this.f0;

    // Resistances & natural Q
    const wireLen = Math.max(2 * Math.PI * p.extraCoilRadiusM * p.extraCoilTurns, 1);
    const Rdc = (RHO_CU * wireLen) / AWG6_M2;
    const skinFactor = Math.max(Math.sqrt(this.f0 / 1e4), 1);
    const Rac = Rdc * skinFactor;
    const Rtot = Rac + p.groundResistanceOhm + 0.4;
    this.Q_natural = (omega0 * this.L_tot) / Math.max(Rtot, 1e-6);

    // Unified drivetrain equivalent inertia
    const r_over_G = p.wheelRadiusM / Math.max(p.gearRatioG, 0.1);
    this.J_eq = p.rotorInertiaKgm2 + p.vehicleMassKg * (r_over_G * r_over_G);

    // 3x3 Inductance Matrix & Analytic Inversion
    const Lp = p.primaryInductanceH;
    const Le = this.L_tot;
    const Lm = p.motorInductanceH;

    this.M = k * Math.sqrt(Lp * Le);
    this.Mm = km * Math.sqrt(Le * Lm);

    // det(L) = Lp * Le * Lm * (1 - k^2 - km^2)
    this.det_L = Lp * Le * Lm * (1 - k * k - km * km);

    // Analytic 3x3 Inverse
    const invDet = 1 / Math.max(this.det_L, 1e-24);
    this.inv_L[0]![0] = (Le * Lm - this.Mm * this.Mm) * invDet;
    this.inv_L[0]![1] = -this.M * Lm * invDet;
    this.inv_L[0]![2] = this.M * this.Mm * invDet;

    this.inv_L[1]![0] = -this.M * Lm * invDet;
    this.inv_L[1]![1] = Lp * Lm * invDet;
    this.inv_L[1]![2] = -Lp * this.Mm * invDet;

    this.inv_L[2]![0] = this.M * this.Mm * invDet;
    this.inv_L[2]![1] = -Lp * this.Mm * invDet;
    this.inv_L[2]![2] = (Lp * Le - this.M * this.M) * invDet;

    // Analytic 2x2 Inverse for spark-off state: [Le, Mm; Mm, Lm]
    const det_2x2 = Le * Lm - this.Mm * this.Mm;
    const invDet2 = 1 / Math.max(det_2x2, 1e-24);
    this.inv_L_2x2[0]![0] = Lm * invDet2;
    this.inv_L_2x2[0]![1] = -this.Mm * invDet2;
    this.inv_L_2x2[1]![0] = -this.Mm * invDet2;
    this.inv_L_2x2[1]![1] = Le * invDet2;
  }

  computeStoredEnergy(s: ConservativeStateVector): number {
    const p = this.params;
    const E_cap = (s.q_cap * s.q_cap) / (2 * Math.max(p.primaryCapacitanceF, 1e-12));
    const E_extra_elec = (s.q_extra * s.q_extra) / (2 * Math.max(this.C_tot, 1e-12));

    const i = [s.i_prim, s.i_extra, s.i_motor];
    const L_mat = [
      [p.primaryInductanceH, this.M, 0],
      [this.M, this.L_tot, this.Mm],
      [0, this.Mm, p.motorInductanceH],
    ];

    let E_mag = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        E_mag += 0.5 * i[r]! * L_mat[r]![c]! * i[c]!;
      }
    }
    const E_kin = 0.5 * this.J_eq * s.omega * s.omega;

    return E_cap + E_extra_elec + Math.max(0, E_mag) + E_kin;
  }

  /**
   * Evaluates the continuous derivative vector f(x, t)
   */
  private evaluateDerivatives(
    s: ConservativeStateVector,
  ): {
    ds: ConservativeStateVector;
    P_ext: number;
    P_env: number;
    P_arc: number;
    P_prim_cu: number;
    P_extra_cu: number;
    P_ground: number;
    P_motor_cu: number;
    P_gear_loss: number;
    P_friction: number;
    P_road: number;
    P_rad: number;
    P_leak: number;
  } {
    const p = this.params;
    const V_cap = s.q_cap / Math.max(p.primaryCapacitanceF, 1e-12);
    const V_extra = s.q_extra / Math.max(this.C_tot, 1e-12);

    // 1. External Starter (Thevenin Model)
    let I_starter = 0;
    if (p.starterOn && V_cap < p.starterVoltageV) {
      I_starter = (p.starterVoltageV - V_cap) / Math.max(p.starterResistanceOhm, 1.0);
    }
    const P_ext = V_cap * I_starter;

    // 2. Environmental Inflow (Thevenin Model)
    const I_env = this.envManager.getTotalDeliveredCurrent(p, V_cap);
    const P_env = V_cap * I_env;

    // 3. Leakage
    const R_leak = 1e10; // 10 GΩ
    const I_leak = V_cap / R_leak;

    // 4. Spark Arc Resistance
    let R_arc = 0.08;
    if (this.sparkActive) {
      // Dynamic arc resistance during active conduction and deionization
      const V_arc = 25.0;
      const R_plasma = 0.08;
      const R_quench = this.sparkTimer <= 0 ? 50.0 : 0.0;
      R_arc = V_arc / (Math.abs(s.i_prim) + 0.1) + R_plasma + R_quench;
    }

    // 5. Extra Coil Losses
    const wireLen = Math.max(2 * Math.PI * p.extraCoilRadiusM * p.extraCoilTurns, 1);
    const Rdc = (RHO_CU * wireLen) / AWG6_M2;
    const skin = Math.max(Math.sqrt(this.f0 / 1e4), 1);
    const Rac = Rdc * skin;
    const R_extra_loss = Rac + p.groundResistanceOhm + 0.4;

    // Radiation resistance
    const lambda = 3e8 / Math.max(this.f0, 1);
    const R_rad = 40 * Math.PI * Math.PI * Math.pow(p.antennaHeightM / lambda, 2);

    // 6. Inductor Differential Equations
    let di_prim = 0;
    let di_extra = 0;
    let di_motor = 0;

    const v1 = -V_extra - (R_extra_loss + R_rad) * s.i_extra;
    const v2 = -p.motorResistanceOhm * s.i_motor - p.torqueConstantKt * s.omega;

    if (this.sparkActive) {
      // Full 3x3 coupled dynamics
      const v0 = V_cap - (p.primaryResistanceOhm + R_arc) * s.i_prim;
      di_prim = this.inv_L[0]![0] * v0 + this.inv_L[0]![1] * v1 + this.inv_L[0]![2] * v2;
      di_extra = this.inv_L[1]![0] * v0 + this.inv_L[1]![1] * v1 + this.inv_L[1]![2] * v2;
      di_motor = this.inv_L[2]![0] * v0 + this.inv_L[2]![1] * v1 + this.inv_L[2]![2] * v2;
    } else {
      // Spark gap is open: primary current is zero (open circuit), no current flows in primary loop
      di_prim = 0;
      // Extra coil and motor remain coupled via Mm in a 2x2 subsystem
      di_extra = this.inv_L_2x2[0]![0] * v1 + this.inv_L_2x2[0]![1] * v2;
      di_motor = this.inv_L_2x2[1]![0] * v1 + this.inv_L_2x2[1]![1] * v2;
    }

    // 7. Mechanical Equations
    const r_over_G = p.wheelRadiusM / Math.max(p.gearRatioG, 0.1);
    const v_veh = s.omega * r_over_G;

    const tau_em = p.torqueConstantKt * s.i_motor;
    const P_gear_loss = (1 - p.gearEfficiency) * Math.abs(tau_em) * Math.abs(s.omega);

    const F_drag = 0.5 * 1.225 * p.dragCoefficientCd * p.frontalAreaM2 * v_veh * v_veh * Math.sign(v_veh);
    const F_rr = p.rollingResistanceCrr * p.vehicleMassKg * 9.81 * Math.sign(v_veh);
    const tau_road = (F_drag + F_rr) * r_over_G;
    const tau_friction = p.rotorFrictionNmS * s.omega;

    const domega =
      (p.gearEfficiency * tau_em - tau_friction - tau_road) / Math.max(this.J_eq, 1e-4);

    // 8. Power Dissipation terms for the ledger
    const P_arc = this.sparkActive ? s.i_prim * s.i_prim * R_arc : 0;
    const P_prim_cu = s.i_prim * s.i_prim * p.primaryResistanceOhm;
    const P_extra_cu = s.i_extra * s.i_extra * Rac;
    const P_ground = s.i_extra * s.i_extra * (p.groundResistanceOhm + 0.4);
    const P_motor_cu = s.i_motor * s.i_motor * p.motorResistanceOhm;
    const P_friction = tau_friction * s.omega;
    const P_road = tau_road * s.omega;
    const P_rad = s.i_extra * s.i_extra * R_rad;
    const P_leak = V_cap * I_leak;

    return {
      ds: {
        q_cap: (this.sparkActive ? -s.i_prim : 0) + I_starter + I_env - I_leak,
        i_prim: di_prim,
        q_extra: s.i_extra,
        i_extra: di_extra,
        i_motor: di_motor,
        omega: domega,
        theta: s.omega,
      },
      P_ext,
      P_env,
      P_arc,
      P_prim_cu,
      P_extra_cu,
      P_ground,
      P_motor_cu,
      P_gear_loss,
      P_friction,
      P_road,
      P_rad,
      P_leak,
    };
  }

  /**
   * Advances the simulation by dt seconds using classical explicit fourth-order Runge-Kutta (RK4)
   */
  step(dt: number) {
    const p = this.params;
    let remainingDt = dt;

    const before = this.events.length;
    const fired: EngineEvent[] = [];

    while (remainingDt > 1e-12) {
      const V_cap = this.state.q_cap / Math.max(p.primaryCapacitanceF, 1e-12);

      // Adaptive step size based on instantaneous physical mode
      let max_h = 2e-6;
      if (this.sparkActive || V_cap >= p.sparkVoltageV * 0.95) {
        max_h = 1.0e-7;
      } else if (p.starterOn && V_cap < p.starterVoltageV) {
        const tau_starter = Math.max(p.starterResistanceOhm, 1.0) * p.primaryCapacitanceF;
        max_h = Math.min(max_h, 0.25 * tau_starter);
      }

      const h = Math.min(remainingDt, max_h);

      // Spark breakdown event detection at sub-step resolution
      if (!this.sparkActive && V_cap >= p.sparkVoltageV) {
        this.sparkActive = true;
        this.dumpCount += 1;
        this.cycle += 1;
        this.sparkTimer = Math.min(0.012, 10 / Math.max(this.f0, 100));
        this.buildWaveform();
        this.emit(
          "SPARK_DUMP",
          `HV Breakdown: Arc struck at ${V_cap.toFixed(0)} V. Energy dump cycle ${this.dumpCount}.`,
          this.toLegacyTelemetry(),
        );
      }

      if (this.sparkActive) {
        this.sparkTimer -= h;
        // Spark quench condition: arc timer expired AND current dropped below quench threshold
        if (this.sparkTimer <= 0 && Math.abs(this.state.i_prim) < 0.2) {
          this.quenchSpark();
        }
      }

      // RK4 Stage 1
      const k1 = this.evaluateDerivatives(this.state);

      // State at t + h/2
      const s2: ConservativeStateVector = {
        q_cap: this.state.q_cap + 0.5 * h * k1.ds.q_cap,
        i_prim: this.state.i_prim + 0.5 * h * k1.ds.i_prim,
        q_extra: this.state.q_extra + 0.5 * h * k1.ds.q_extra,
        i_extra: this.state.i_extra + 0.5 * h * k1.ds.i_extra,
        i_motor: this.state.i_motor + 0.5 * h * k1.ds.i_motor,
        omega: this.state.omega + 0.5 * h * k1.ds.omega,
        theta: this.state.theta + 0.5 * h * k1.ds.theta,
      };
      const k2 = this.evaluateDerivatives(s2);

      // State at t + h/2
      const s3: ConservativeStateVector = {
        q_cap: this.state.q_cap + 0.5 * h * k2.ds.q_cap,
        i_prim: this.state.i_prim + 0.5 * h * k2.ds.i_prim,
        q_extra: this.state.q_extra + 0.5 * h * k2.ds.q_extra,
        i_extra: this.state.i_extra + 0.5 * h * k2.ds.i_extra,
        i_motor: this.state.i_motor + 0.5 * h * k2.ds.i_motor,
        omega: this.state.omega + 0.5 * h * k2.ds.omega,
        theta: this.state.theta + 0.5 * h * k2.ds.theta,
      };
      const k3 = this.evaluateDerivatives(s3);

      // State at t + h
      const s4: ConservativeStateVector = {
        q_cap: this.state.q_cap + h * k3.ds.q_cap,
        i_prim: this.state.i_prim + h * k3.ds.i_prim,
        q_extra: this.state.q_extra + h * k3.ds.q_extra,
        i_extra: this.state.i_extra + h * k3.ds.i_extra,
        i_motor: this.state.i_motor + h * k3.ds.i_motor,
        omega: this.state.omega + h * k3.ds.omega,
        theta: this.state.theta + h * k3.ds.theta,
      };
      const k4 = this.evaluateDerivatives(s4);

      // Final state update
      this.state.q_cap += (h / 6) * (k1.ds.q_cap + 2 * k2.ds.q_cap + 2 * k3.ds.q_cap + k4.ds.q_cap);
      this.state.i_prim += (h / 6) * (k1.ds.i_prim + 2 * k2.ds.i_prim + 2 * k3.ds.i_prim + k4.ds.i_prim);
      this.state.q_extra += (h / 6) * (k1.ds.q_extra + 2 * k2.ds.q_extra + 2 * k3.ds.q_extra + k4.ds.q_extra);
      this.state.i_extra += (h / 6) * (k1.ds.i_extra + 2 * k2.ds.i_extra + 2 * k3.ds.i_extra + k4.ds.i_extra);
      this.state.i_motor += (h / 6) * (k1.ds.i_motor + 2 * k2.ds.i_motor + 2 * k3.ds.i_motor + k4.ds.i_motor);
      this.state.omega += (h / 6) * (k1.ds.omega + 2 * k2.ds.omega + 2 * k3.ds.omega + k4.ds.omega);
      this.state.theta += (h / 6) * (k1.ds.theta + 2 * k2.ds.theta + 2 * k3.ds.theta + k4.ds.theta);

      if (!this.sparkActive) {
        this.state.i_prim = 0;
      }

      // Ledger integration using 4th-order Simpson quadrature
      const w1 = 1 / 6;
      const w2 = 2 / 6;
      const w3 = 2 / 6;
      const w4 = 1 / 6;

      const P_ext_avg = w1 * k1.P_ext + w2 * k2.P_ext + w3 * k3.P_ext + w4 * k4.P_ext;
      const P_env_avg = w1 * k1.P_env + w2 * k2.P_env + w3 * k3.P_env + w4 * k4.P_env;
      const P_arc_avg = w1 * k1.P_arc + w2 * k2.P_arc + w3 * k3.P_arc + w4 * k4.P_arc;
      const P_prim_cu_avg = w1 * k1.P_prim_cu + w2 * k2.P_prim_cu + w3 * k3.P_prim_cu + w4 * k4.P_prim_cu;
      const P_extra_cu_avg = w1 * k1.P_extra_cu + w2 * k2.P_extra_cu + w3 * k3.P_extra_cu + w4 * k4.P_extra_cu;
      const P_ground_avg = w1 * k1.P_ground + w2 * k2.P_ground + w3 * k3.P_ground + w4 * k4.P_ground;
      const P_motor_cu_avg = w1 * k1.P_motor_cu + w2 * k2.P_motor_cu + w3 * k3.P_motor_cu + w4 * k4.P_motor_cu;
      const P_gear_loss_avg = w1 * k1.P_gear_loss + w2 * k2.P_gear_loss + w3 * k3.P_gear_loss + w4 * k4.P_gear_loss;
      const P_friction_avg = w1 * k1.P_friction + w2 * k2.P_friction + w3 * k3.P_friction + w4 * k4.P_friction;
      const P_road_avg = w1 * k1.P_road + w2 * k2.P_road + w3 * k3.P_road + w4 * k4.P_road;
      const P_rad_avg = w1 * k1.P_rad + w2 * k2.P_rad + w3 * k3.P_rad + w4 * k4.P_rad;
      const P_leak_avg = w1 * k1.P_leak + w2 * k2.P_leak + w3 * k3.P_leak + w4 * k4.P_leak;

      this.ledger.recordStep(
        h,
        P_ext_avg,
        P_env_avg,
        P_arc_avg,
        P_prim_cu_avg,
        P_extra_cu_avg,
        P_ground_avg,
        P_motor_cu_avg,
        P_gear_loss_avg,
        P_friction_avg,
        P_road_avg,
        P_rad_avg,
        P_leak_avg,
      );

      remainingDt -= h;
    }

    this.t += dt;
    const tel = this.telemetry();
    this.lastTelemetry = tel;

    const liveV = tel.V_cap_V;
    const liveVx = tel.V_extra_peak_V;
    this.wave.push({ t: this.t, vCap: liveV, vExtra: liveVx, iExtra: this.state.i_extra });
    if (this.wave.length > 400) this.wave.splice(0, this.wave.length - 400);

    this.stripAcc += dt;
    if (this.stripAcc >= 0.05) {
      this.stripAcc = 0;
      this.strip.push({ t: this.t, gain: p.couplingK, vCap: liveV, pMech: tel.P_mech_W });
      if (this.strip.length > 250) this.strip.splice(0, this.strip.length - 250);
    }

    const added = this.events.length - before;
    if (added > 0) fired.push(...this.events.slice(0, added));
    return fired;
  }

  telemetry(): ConservativeTelemetry {
    const p = this.params;
    const V_cap = this.state.q_cap / Math.max(p.primaryCapacitanceF, 1e-12);
    const V_extra = this.state.q_extra / Math.max(this.C_tot, 1e-12);

    const r_over_G = p.wheelRadiusM / Math.max(p.gearRatioG, 0.1);
    const v_veh = this.state.omega * r_over_G;
    const torque_em = p.torqueConstantKt * this.state.i_motor;
    const P_mech = torque_em * this.state.omega;

    const F_drag = 0.5 * 1.225 * p.dragCoefficientCd * p.frontalAreaM2 * v_veh * v_veh * Math.sign(v_veh);
    const F_rr = p.rollingResistanceCrr * p.vehicleMassKg * 9.81 * Math.sign(v_veh);
    const accel = (torque_em / r_over_G - F_drag - F_rr) / Math.max(p.vehicleMassKg, 1);

    const L_mat = [
      [p.primaryInductanceH, this.M, 0],
      [this.M, this.L_tot, this.Mm],
      [0, this.Mm, p.motorInductanceH],
    ];

    const ledgerReport = this.ledger.computeReport(
      this.state,
      p.primaryCapacitanceF,
      this.C_tot,
      L_mat,
      this.J_eq,
    );

    const sources = this.envManager.getReports(p, V_cap);
    const P_env_avail = sources.reduce((sum, s) => sum + s.P_available_W, 0);
    const P_env_del = sources.reduce((sum, s) => sum + s.P_delivered_W, 0);

    const f_prim = 1 / (2 * Math.PI * Math.sqrt(p.primaryInductanceH * p.primaryCapacitanceF));
    const f_extra_self = 1 / (2 * Math.PI * Math.sqrt(this.L_extra * this.C_self));
    const f_split_1 = this.f0 / Math.sqrt(1 + p.couplingK);
    const f_split_2 = this.f0 / Math.sqrt(Math.max(1 - p.couplingK, 0.01));

    return {
      mode: "conservative",
      t_s: this.t,

      E_stored_total_J: ledgerReport.E_stored_J,
      E_cap_J: ledgerReport.E_cap_J,
      E_extra_coil_J: ledgerReport.E_extra_elec_J,
      E_mag_coupled_J: ledgerReport.E_mag_coupled_J,
      E_kinetic_J: ledgerReport.E_kinetic_J,

      V_cap_V: V_cap,
      V_break_V: p.sparkVoltageV,
      V_extra_peak_V: V_extra,
      I_primary_A: this.state.i_prim,
      I_extra_A: this.state.i_extra,
      I_motor_A: this.state.i_motor,
      sparkActive: this.sparkActive,
      sparkCount: this.dumpCount,

      f_primary_Hz: f_prim,
      f_extra_self_Hz: f_extra_self,
      f_extra_loaded_Hz: this.f0,
      f_split_1_Hz: f_split_1,
      f_split_2_Hz: f_split_2,
      natural_Q: this.Q_natural,

      P_starter_W: p.starterOn ? Math.max(0, V_cap * ((p.starterVoltageV - V_cap) / p.starterResistanceOhm)) : 0,
      P_env_total_W: P_env_del,
      P_env_available_W: P_env_avail,
      P_mech_W: P_mech,
      P_dissipated_W: this.ledger.E_arc_heat, // instantaneous tracked in ledger
      P_radiated_W: 0,

      torque_em_Nm: torque_em,
      torque_load_Nm: (F_drag + F_rr) * r_over_G,
      rpm: (this.state.omega * 60) / (2 * Math.PI),
      speed_ms: v_veh,
      accel_ms2: accel,

      k: p.couplingK,
      k_m: p.motorCouplingKm,
      det_L_normal: this.det_L / (p.primaryInductanceH * this.L_tot * p.motorInductanceH),
      coupling_valid: p.couplingK * p.couplingK + p.motorCouplingKm * p.motorCouplingKm < 1.0,

      ledger: ledgerReport,
      sources,
      convergence_order: 4,
    };
  }

  private emit(type: EventType, message: string, snap: Telemetry) {
    this.eventSeq += 1;
    const ev: EngineEvent = {
      id: `${this.t.toFixed(4)}_${type}_${this.eventSeq}`,
      t: this.t,
      type,
      message,
      snapshot: snap,
    };
    this.events.unshift(ev);
    if (this.events.length > 200) this.events.pop();
  }

  private buildWaveform() {
    const n = 240;
    const omega = 2 * Math.PI * Math.max(this.f0, 100);
    const T = (4 * Math.PI) / omega;
    const dt = T / n;
    const V_peak = Math.abs(this.state.q_extra) / Math.max(this.C_tot, 1e-12);
    const Q = Math.max(this.Q_natural, 1);
    const vBreak = this.params.sparkVoltageV;
    const samples: WaveSample[] = [];
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const env = Math.exp((-omega * t) / (2 * Q));
      const s = Math.sin(omega * t);
      const vx = V_peak * env * s;
      samples.push({
        t,
        vCap: vBreak * Math.exp(-t / (T * 0.1)),
        vExtra: vx,
        iExtra: (vx / Math.max(Math.sqrt(this.L_tot / this.C_tot), 1e-3)) * env,
      });
    }
    this.dumpWave = samples;
  }

  toLegacyTelemetry(): Telemetry {
    const ct = this.telemetry();
    const p = this.params;
    const vCap = ct.V_cap_V;
    const vExtra = ct.V_extra_peak_V;
    return {
      t_s: ct.t_s,
      cycle: Math.round(ct.t_s * ct.f_extra_loaded_Hz),
      dumpCount: ct.sparkCount,
      sparkRate_Hz: ct.sparkCount > 0 ? ct.sparkCount / Math.max(ct.t_s, 0.01) : 0,
      lat_deg: p.latitude,
      lon_deg: -104.82,
      alt_m: p.altitudeM,
      magLat_deg: p.latitude * 1.05,
      B_nT: 55000,
      B_h_nT: 20000,
      B_v_nT: 51000,
      inclination_deg: 68.5,
      E_atm_Vm: 120,
      f_schumann_Hz: 7.83,
      f_tesla_Hz: 11.78,
      f_target_Hz: ct.f_extra_loaded_Hz,
      N_turns: p.extraCoilTurns,
      L_extra_H: this.L_extra,
      R_extra_ohm: (RHO_CU * (2 * Math.PI * p.extraCoilRadiusM * p.extraCoilTurns)) / AWG6_M2,
      R_total_ohm: p.groundResistanceOhm + 0.4,
      C_top_F: this.C_top,
      C_primary_F: p.primaryCapacitanceF,
      L_primary_H: p.primaryInductanceH,
      L_loading_H: p.loadingCoilH,
      C_earth_F: 0,
      C_total_F: this.C_tot,
      f0_Hz: ct.f_extra_loaded_Hz,
      omega: 2 * Math.PI * ct.f_extra_loaded_Hz,
      Q_ideal: ct.natural_Q,
      Q_eff: ct.natural_Q,
      magnification: Math.sqrt(this.L_tot / Math.max(this.C_tot, 1e-12)) / Math.max(p.groundResistanceOhm, 1),
      k_coupling: p.couplingK,
      detune: 0,
      resonanceLock: 1,
      V_cap_V: vCap,
      V_break_V: p.sparkVoltageV,
      V_extra_V: vExtra,
      I_primary_A: ct.I_primary_A,
      I_extra_A: ct.I_extra_A,
      sparkState: ct.sparkActive ? 1 : 0,
      loopGain: Math.min(1.0, p.couplingK / 0.5),
      earthGrip: 0,
      regenGain: 0,
      chargeFraction: vCap / Math.max(p.sparkVoltageV, 1),
      torque_Nm: ct.torque_em_Nm,
      rpm: ct.rpm,
      I_motor_A: ct.I_motor_A,
      P_mech_W: ct.P_mech_W,
      F_lorentz_N: 0,
      P_motion_W: 0,
      P_atm_W: ct.sources[0]?.P_delivered_W ?? 0,
      P_cavity_W: ct.sources[2]?.P_delivered_W ?? 0,
      P_radiant_W: ct.sources[3]?.P_delivered_W ?? 0,
      P_in_W: ct.P_starter_W + ct.P_env_total_W,
      P_loss_W: ct.P_dissipated_W,
      P_starter_W: ct.P_starter_W,
      E_dump_J: ct.sparkCount * 0.5 * p.primaryCapacitanceF * p.sparkVoltageV * p.sparkVoltageV,
      E_cap_J: ct.E_cap_J,
      E_coil_J: ct.E_extra_coil_J,
      eta: ct.P_starter_W + ct.P_env_total_W > 1e-6 ? ct.P_mech_W / (ct.P_starter_W + ct.P_env_total_W) : 0,
      speed_ms: ct.speed_ms,
      heading_deg: 90,
      antenna_h_m: p.antennaHeightM,
      antenna_L_m: 1.0,
      ground_R_ohm: p.groundResistanceOhm,
      V_motion_V: 0,
      accel_ms2: ct.accel_ms2,
      weatherCode: p.weather === "storm" ? 1 : 0,
      stabilityCode: 0,
      sustain: 0,
    };
  }

  lastSnap(): ConservativeTelemetry {
    return this.lastTelemetry ?? this.telemetry();
  }

  dumpScope(): WaveSample[] {
    return this.dumpWave;
  }
}
