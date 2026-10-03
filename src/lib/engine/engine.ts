import type {
  EngineEvent,
  EngineParams,
  EventType,
  Stability,
  Telemetry,
  WaveSample,
} from "./types";

const MU0 = 4 * Math.PI * 1e-7;
const EPS0 = 8.854187817e-12;
const RHO_CU = 1.68e-8;
const AWG6_M2 = 13.3e-6;
const B0 = 3.12e-5;
const MASS_KG = 1450;
const F_SCHUMANN = 7.83;
const F_TESLA = 11.78;
const EVENT_CAP = 250;
const WAVE_CAP = 720;
const STRIP_CAP = 360;

function solenoidL(n: number, r: number, h: number): number {
  const height = Math.max(h, 0.02);
  return (MU0 * n * n * Math.PI * r * r) / height;
}

function monopoleC(h: number): number {
  const height = Math.max(h, 0.2);
  const a = 0.006;
  return (2 * Math.PI * EPS0 * height) / Math.log((2 * height) / a);
}

function cloneParams(p: EngineParams): EngineParams {
  return { ...p };
}

function idFor(t: number, type: EventType, n: number): string {
  return `${type}-${t.toFixed(4)}-${n}`;
}

export function stabilityOf(g: number): Stability {
  if (g > 1.05) return "unstable";
  if (g >= 0.95) return "marginal";
  return "damped";
}

export function stabilityCode(s: Stability): number {
  if (s === "unstable") return 2;
  if (s === "marginal") return 1;
  return 0;
}

export class Engine {
  params: EngineParams;
  t = 0;
  cycle = 0;
  dumpCount = 0;
  eCap = 0;
  vExtra = 0;
  iExtra = 0;
  iPrimary = 0;
  phase = 0;
  omegaMotor = 0;
  speedMs = 0;
  lastDumpT = -1;
  lastDumpJ = 0;
  lastSparkRate = 0;
  loopGain = 0;
  locked = false;
  sustain = false;
  sparkOn = false;
  sparkTimer = 0;
  qCollapsed = false;
  groundFault = false;
  missArmed = false;
  events: EngineEvent[] = [];
  wave: WaveSample[] = [];
  strip: { t: number; gain: number; vCap: number; pMech: number }[] = [];
  private eventSeq = 0;
  private dumpWave: WaveSample[] = [];
  private lastTelemetry: Telemetry | null = null;
  private lastStarter = false;
  private lastLock = false;
  private lastGainSide = -1;
  private lastSustain = false;
  private pulseCool = 0;
  private stripAcc = 0;
  private missTimer = 0;

  constructor(params: EngineParams) {
    this.params = cloneParams(params);
    this.speedMs = params.speedMs;
    this.eCap = 0.02 * 0.5 * params.primaryCapacitanceF * params.sparkVoltageV ** 2;
  }

  reset(params?: EngineParams) {
    if (params) this.params = cloneParams(params);
    this.t = 0;
    this.cycle = 0;
    this.dumpCount = 0;
    this.eCap = 0.02 * 0.5 * this.params.primaryCapacitanceF * this.params.sparkVoltageV ** 2;
    this.vExtra = 0;
    this.iExtra = 0;
    this.iPrimary = 0;
    this.phase = 0;
    this.omegaMotor = 0;
    this.speedMs = this.params.speedMs;
    this.lastDumpT = -1;
    this.lastDumpJ = 0;
    this.lastSparkRate = 0;
    this.loopGain = 0;
    this.locked = false;
    this.sustain = false;
    this.sparkOn = false;
    this.sparkTimer = 0;
    this.qCollapsed = false;
    this.groundFault = false;
    this.missArmed = false;
    this.events = [];
    this.wave = [];
    this.strip = [];
    this.dumpWave = [];
    this.eventSeq = 0;
    this.lastTelemetry = null;
    this.lastStarter = false;
    this.lastLock = false;
    this.lastGainSide = -1;
    this.lastSustain = false;
    this.pulseCool = 0;
    this.stripAcc = 0;
    this.missTimer = 0;
  }

  setParams(patch: Partial<EngineParams>) {
    this.params = { ...this.params, ...patch };
    if (patch.speedMs !== undefined && !this.sustain) {
      this.speedMs = patch.speedMs;
    }
  }

  derived() {
    const p = this.params;
    const magLat = (p.latitude - 11.5) * (Math.PI / 180);
    const Bh = B0 * Math.cos(magLat);
    const Bv = 2 * B0 * Math.sin(magLat);
    const B = B0 * Math.sqrt(1 + 3 * Math.sin(magLat) ** 2);
    const Lextra = solenoidL(p.extraCoilTurns, p.extraCoilRadiusM, p.extraCoilHeightM);
    const Ltot = Lextra + Math.max(p.loadingCoilH, 0);
    const wireLen = Math.max(2 * Math.PI * p.extraCoilRadiusM * p.extraCoilTurns, 1);
    const Rdc = (RHO_CU * wireLen) / AWG6_M2;
    const Ctop = monopoleC(p.antennaHeightM);
    const Cearth = p.mode === "earth" ? p.earthGrip * 8e-6 : 0;
    const Ctot = Math.max(Ctop + Cearth, 1e-12);
    const f0 = 1 / (2 * Math.PI * Math.sqrt(Ltot * Ctot));
    const omega = 2 * Math.PI * f0;
    const skin = Math.max(Math.sqrt(f0 / 1e4), 1);
    const Rac = Rdc * skin;
    const Rtot = Rac + p.groundResistanceOhm + 0.4;
    const Qideal = (omega * Ltot) / Math.max(Rdc, 1e-6);
    const Qeff = (omega * Ltot) / Math.max(Rtot, 1e-6);
    const fTarget = p.mode === "earth" ? F_TESLA : f0;
    const detune = p.mode === "earth" ? (f0 - fTarget) / fTarget : 0;
    const lockWindow = Math.max(1 / Math.max(Qeff, 1), 0.02);
    const locked = p.mode === "coil" ? 1 : Math.abs(detune) < lockWindow ? 1 : 0;
    const Eatm = p.weather === "storm" ? 20000 : 130;
    return {
      magLatDeg: p.latitude - 11.5,
      Bh,
      Bv,
      B,
      Lextra,
      Ltot,
      Rdc,
      Rac,
      Rtot,
      Ctop,
      Cearth,
      Ctot,
      f0,
      omega,
      Qideal,
      Qeff,
      fTarget,
      detune,
      locked,
      Eatm,
      Lprimary: 51e-6,
    };
  }

  private emit(type: EventType, message: string, snap: Telemetry) {
    this.eventSeq += 1;
    const ev: EngineEvent = {
      id: idFor(this.t, type, this.eventSeq),
      t: this.t,
      type,
      message,
      snapshot: { ...snap },
    };
    this.events.unshift(ev);
    if (this.events.length > EVENT_CAP) this.events.pop();
  }

  private buildWaveform(E: number, d: ReturnType<Engine["derived"]>, vBreak: number) {
    const n = 240;
    const T = (4 * Math.PI) / Math.max(d.omega, 1);
    const dt = T / n;
    const Ecoil = E * this.params.etaSpark * this.params.couplingK;
    const Vpeak = Math.sqrt((2 * Math.max(Ecoil, 0)) / d.Ctot);
    const Q = Math.max(d.Qeff, 1);
    const samples: WaveSample[] = [];
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const env = Math.exp((-d.omega * t) / (2 * Q));
      const s = Math.sin(d.omega * t);
      const vx = Vpeak * env * s;
      samples.push({
        t,
        vCap: vBreak * Math.exp(-t / (T * 0.08)),
        vExtra: vx,
        iExtra: (vx / Math.max(Math.sqrt(d.Ltot / d.Ctot), 1e-6)) * env,
      });
    }
    this.dumpWave = samples;
  }

  telemetry(): Telemetry {
    const p = this.params;
    const d = this.derived();
    const vCap = Math.sqrt((2 * Math.max(this.eCap, 0)) / Math.max(p.primaryCapacitanceF, 1e-12));
    const vMotion = d.Bh * p.antennaLengthM * this.speedMs;
    const rLoad = Math.max(d.Rtot, 1);
    const pMotion = (vMotion * vMotion) / rLoad;
    const iCorona = p.weather === "storm" ? 2e-5 : 4e-9;
    const pAtm = d.Eatm * p.antennaHeightM * iCorona * (0.4 + p.earthGrip);
    const pCavity = p.earthGrip * 0.35 * (0.2 + p.antennaHeightM * 0.01) * (p.mode === "earth" ? 1 : 0.05);
    const pRadiant = 3e-4 * p.radiantAreaM2 * (p.weather === "storm" ? 8 : 1);
    const pStarter = p.starterOn ? p.starterWatts : 0;
    const pIn = pMotion + pAtm + pCavity + pRadiant + pStarter;
    const z = Math.max(Math.sqrt(d.Ltot / d.Ctot), 1e-3);
    const iX = this.vExtra / z;
    const pLoss = iX * iX * d.Rtot + this.iPrimary * this.iPrimary * 0.2;
    const iMotor = Math.abs(iX) * 0.08 * p.couplingK;
    const kt = 0.42;
    const torqueEm = kt * iMotor;
    const pMech = torqueEm * this.omegaMotor;
    const fLorentz = iMotor * p.antennaLengthM * d.Bh;
    const eta = pIn > 1e-9 ? pMech / pIn : 0;
    const stab = stabilityOf(this.loopGain);
    return {
      t_s: this.t,
      cycle: this.cycle,
      dumpCount: this.dumpCount,
      sparkRate_Hz: this.lastSparkRate,
      lat_deg: p.latitude,
      lon_deg: p.longitude,
      alt_m: p.altitudeM,
      magLat_deg: d.magLatDeg,
      B_nT: d.B * 1e9,
      B_h_nT: d.Bh * 1e9,
      B_v_nT: d.Bv * 1e9,
      inclination_deg: (Math.atan2(d.Bv, Math.max(d.Bh, 1e-12)) * 180) / Math.PI,
      E_atm_Vm: d.Eatm,
      f_schumann_Hz: F_SCHUMANN,
      f_tesla_Hz: F_TESLA,
      f_target_Hz: d.fTarget,
      N_turns: p.extraCoilTurns,
      L_extra_H: d.Lextra,
      R_extra_ohm: d.Rdc,
      R_total_ohm: d.Rtot,
      C_top_F: d.Ctop,
      C_primary_F: p.primaryCapacitanceF,
      L_primary_H: d.Lprimary,
      L_loading_H: p.loadingCoilH,
      C_earth_F: d.Cearth,
      C_total_F: d.Ctot,
      f0_Hz: d.f0,
      omega: d.omega,
      Q_ideal: d.Qideal,
      Q_eff: d.Qeff,
      magnification: d.Qeff,
      k_coupling: p.couplingK,
      detune: d.detune,
      resonanceLock: d.locked,
      V_cap_V: vCap,
      V_break_V: p.sparkVoltageV,
      V_extra_V: this.vExtra,
      I_primary_A: this.iPrimary,
      I_extra_A: iX,
      sparkState: this.sparkOn ? 1 : 0,
      loopGain: this.loopGain,
      earthGrip: p.earthGrip,
      regenGain: p.regenerativeGain,
      chargeFraction: vCap / Math.max(p.sparkVoltageV, 1),
      torque_Nm: torqueEm,
      rpm: (this.omegaMotor * 60) / (2 * Math.PI),
      I_motor_A: iMotor,
      P_mech_W: pMech,
      F_lorentz_N: fLorentz,
      P_motion_W: pMotion,
      P_atm_W: pAtm,
      P_cavity_W: pCavity,
      P_radiant_W: pRadiant,
      P_in_W: pIn,
      P_loss_W: pLoss,
      P_starter_W: pStarter,
      E_dump_J: this.lastDumpJ,
      E_cap_J: this.eCap,
      E_coil_J: 0.5 * d.Ctot * this.vExtra * this.vExtra,
      eta,
      speed_ms: this.speedMs,
      heading_deg: p.headingDeg,
      antenna_h_m: p.antennaHeightM,
      antenna_L_m: p.antennaLengthM,
      ground_R_ohm: p.groundResistanceOhm,
      V_motion_V: vMotion,
      accel_ms2: 0,
      weatherCode: p.weather === "storm" ? 1 : 0,
      stabilityCode: stabilityCode(stab),
      sustain: this.sustain ? 1 : 0,
    };
  }

  step(dt: number): EngineEvent[] {
    const fired: EngineEvent[] = [];
    const before = this.events.length;
    const p = this.params;
    const d = this.derived();
    const snap0 = () => this.telemetry();

    if (p.starterOn && !this.lastStarter) {
      this.emit("STARTER_ARM", "Starter injecting into C_primary.", snap0());
    }
    this.lastStarter = p.starterOn;

    const locked = d.locked === 1;
    if (locked && !this.lastLock) {
      this.emit("RESONANCE_LOCK", `f0 ${d.f0.toFixed(2)} Hz inside the 1/Q window.`, snap0());
    }
    if (!locked && this.lastLock) {
      this.emit("RESONANCE_LOST", "Detune left the lock window.", snap0());
    }
    this.lastLock = locked;
    this.locked = locked;

    if (d.Qeff < 10 && !this.qCollapsed) {
      this.qCollapsed = true;
      this.emit("Q_COLLAPSE", `Q_eff ${d.Qeff.toFixed(1)} — ground or spark loss.`, snap0());
    }
    if (d.Qeff >= 12) this.qCollapsed = false;

    if (p.groundResistanceOhm > 25 && !this.groundFault) {
      this.groundFault = true;
      this.emit("GROUND_FAULT", "Ground R too high to ring. Tesla: make the ground with care.", snap0());
    }
    if (p.groundResistanceOhm <= 20) this.groundFault = false;

    const telPre = this.telemetry();
    const pIn = telPre.P_in_W;
    const pAmb = Math.max(pIn - (p.starterOn ? p.starterWatts : 0), 0);
    const lockFactor = locked ? 1 : 0.12;
    const eDumpPred = 0.5 * p.primaryCapacitanceF * p.sparkVoltageV * p.sparkVoltageV;
    const eFbPred = p.etaRegen * p.regenerativeGain * eDumpPred * lockFactor * (0.35 + p.earthGrip);
    const tCharge = eDumpPred / Math.max(pIn, 1e-9);
    this.loopGain = eDumpPred > 0 ? (eFbPred + pAmb * tCharge) / eDumpPred : 0;

    this.eCap += Math.max(pIn, 0) * dt;
    const eMax = 0.5 * p.primaryCapacitanceF * p.sparkVoltageV * p.sparkVoltageV;
    if (this.eCap > eMax * 1.02) this.eCap = eMax * 1.02;

    if (this.sparkOn) {
      this.sparkTimer -= dt;
      this.iPrimary *= Math.exp(-dt * 80);
      if (this.sparkTimer <= 0) {
        this.sparkOn = false;
        this.iPrimary = 0;
      }
    }

    const vNow = Math.sqrt((2 * Math.max(this.eCap, 0)) / Math.max(p.primaryCapacitanceF, 1e-12));
    if (!this.sparkOn && vNow >= p.sparkVoltageV) {
      const eDump = this.eCap;
      this.lastDumpJ = eDump;
      this.eCap = 0.04 * eDump;
      this.dumpCount += 1;
      this.cycle += 1;
      this.sparkOn = true;
      this.sparkTimer = Math.min(0.012, 8 / Math.max(d.f0, 20));
      const zP = Math.sqrt(d.Lprimary / p.primaryCapacitanceF);
      this.iPrimary = p.sparkVoltageV / Math.max(zP, 1e-3);
      this.buildWaveform(eDump, d, p.sparkVoltageV);
      this.vExtra = Math.sqrt((2 * eDump * p.etaSpark * p.couplingK) / d.Ctot);
      this.phase = 0;

      const Tcycle = this.lastDumpT >= 0 ? this.t - this.lastDumpT : Math.max(tCharge, 1e-4);
      this.lastSparkRate = Tcycle > 1e-4 ? 1 / Tcycle : 0;
      this.lastDumpT = this.t;

      const eAmb = pAmb * Math.max(Tcycle, 1e-4);
      const eFb = p.etaRegen * p.regenerativeGain * eDump * lockFactor * (0.35 + p.earthGrip);
      this.loopGain = eDump > 1e-12 ? (eFb + eAmb) / eDump : 0;
      this.eCap += Math.min(eFb, eMax * 0.9);

      const side = this.loopGain >= 1 ? 1 : 0;
      if (side !== this.lastGainSide && this.lastGainSide !== -1) {
        this.emit("LOOP_GAIN_CROSS", `loopGain ${this.loopGain.toFixed(3)} crossed unity.`, this.telemetry());
      }
      this.lastGainSide = side;

      this.sustain = this.loopGain > 1.02 && locked;
      if (this.sustain && !this.lastSustain) {
        this.emit("SUSTAIN_ON", "Unstable hold. Starter can come off.", this.telemetry());
      }
      if (!this.sustain && this.lastSustain) {
        this.emit("SUSTAIN_OFF", "Ring died. Needs a kick.", this.telemetry());
      }
      this.lastSustain = this.sustain;

      this.emit(
        "SPARK_DUMP",
        `Dump ${this.dumpCount}: ${eDump.toExponential(3)} J into extra coil.`,
        this.telemetry(),
      );
      this.pulseCool = 0.08;
      this.missArmed = false;
      this.missTimer = 0;
    } else if (!this.sparkOn && vNow < p.sparkVoltageV * 0.92 && pIn < 1e-4) {
      this.missTimer += dt;
      if (this.missTimer > 1.6 && !this.missArmed) {
        this.missArmed = true;
        this.emit("BREAKDOWN_MISS", "Charge stalled below V_break. Raise P_in or grip.", this.telemetry());
      }
    } else {
      this.missTimer = 0;
    }

    const Q = Math.max(d.Qeff, 1);
    const decay = Math.exp((-d.omega * dt) / (2 * Q));
    this.phase += d.omega * dt;
    this.vExtra *= decay;
    const vRing = this.vExtra * Math.sin(this.phase);
    this.iExtra = vRing / Math.max(Math.sqrt(d.Ltot / d.Ctot), 1e-6);

    const tel = this.telemetry();
    const torqueNet = tel.torque_Nm - p.motorLoadNm;
    const inertia = 0.35;
    this.omegaMotor += (torqueNet / inertia) * dt;
    this.omegaMotor = Math.max(this.omegaMotor, 0);
    this.omegaMotor *= Math.exp(-dt * 0.12);

    const force = tel.torque_Nm / Math.max(0.32, 0.28);
    const drag = 0.35 * this.speedMs * this.speedMs;
    const accel = (force - drag - p.motorLoadNm * 0.4) / MASS_KG;
    if (this.sustain || tel.P_mech_W > 50) {
      this.speedMs = Math.max(this.speedMs + accel * dt, 0);
    } else {
      this.speedMs += (p.speedMs - this.speedMs) * Math.min(dt * 0.6, 1);
    }
    tel.accel_ms2 = accel;
    tel.speed_ms = this.speedMs;
    tel.rpm = (this.omegaMotor * 60) / (2 * Math.PI);
    tel.P_mech_W = tel.torque_Nm * this.omegaMotor;
    tel.eta = tel.P_in_W > 1e-9 ? tel.P_mech_W / tel.P_in_W : 0;

    if (this.pulseCool > 0) {
      this.pulseCool -= dt;
      if (this.pulseCool <= 0) {
        this.emit("MOTOR_PULSE", `Torque ${tel.torque_Nm.toFixed(1)} N·m from dump.`, tel);
      }
    }

    this.t += dt;
    this.lastTelemetry = tel;

    const liveV = tel.V_cap_V;
    this.wave.push({ t: this.t, vCap: liveV, vExtra: vRing, iExtra: this.iExtra });
    if (this.wave.length > WAVE_CAP) this.wave.splice(0, this.wave.length - WAVE_CAP);

    this.stripAcc += dt;
    if (this.stripAcc >= 0.05) {
      this.stripAcc = 0;
      this.strip.push({ t: this.t, gain: this.loopGain, vCap: liveV, pMech: tel.P_mech_W });
      if (this.strip.length > STRIP_CAP) this.strip.splice(0, this.strip.length - STRIP_CAP);
    }

    const added = this.events.length - before;
    if (added > 0) fired.push(...this.events.slice(0, added));
    return fired;
  }

  lastSnap(): Telemetry {
    return this.lastTelemetry ?? this.telemetry();
  }

  dumpScope(): WaveSample[] {
    return this.dumpWave;
  }
}
