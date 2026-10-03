export type Weather = "fair" | "storm";
export type EngineMode = "coil" | "earth";
export type Stability = "damped" | "marginal" | "unstable";

export type EventType =
  | "SPARK_DUMP"
  | "RESONANCE_LOCK"
  | "RESONANCE_LOST"
  | "LOOP_GAIN_CROSS"
  | "SUSTAIN_ON"
  | "SUSTAIN_OFF"
  | "Q_COLLAPSE"
  | "MOTOR_PULSE"
  | "STARTER_ARM"
  | "GROUND_FAULT"
  | "BREAKDOWN_MISS";

export type EngineParams = {
  latitude: number;
  longitude: number;
  altitudeM: number;
  speedMs: number;
  headingDeg: number;
  antennaHeightM: number;
  antennaLengthM: number;
  groundResistanceOhm: number;
  extraCoilTurns: number;
  extraCoilRadiusM: number;
  extraCoilHeightM: number;
  loadingCoilH: number;
  primaryCapacitanceF: number;
  sparkVoltageV: number;
  couplingK: number;
  earthGrip: number;
  regenerativeGain: number;
  radiantAreaM2: number;
  weather: Weather;
  mode: EngineMode;
  starterOn: boolean;
  starterWatts: number;
  motorLoadNm: number;
  etaSpark: number;
  etaRegen: number;
};

export type Telemetry = {
  t_s: number;
  cycle: number;
  dumpCount: number;
  sparkRate_Hz: number;
  lat_deg: number;
  lon_deg: number;
  alt_m: number;
  magLat_deg: number;
  B_nT: number;
  B_h_nT: number;
  B_v_nT: number;
  inclination_deg: number;
  E_atm_Vm: number;
  f_schumann_Hz: number;
  f_tesla_Hz: number;
  f_target_Hz: number;
  N_turns: number;
  L_extra_H: number;
  R_extra_ohm: number;
  R_total_ohm: number;
  C_top_F: number;
  C_primary_F: number;
  L_primary_H: number;
  L_loading_H: number;
  C_earth_F: number;
  C_total_F: number;
  f0_Hz: number;
  omega: number;
  Q_ideal: number;
  Q_eff: number;
  magnification: number;
  k_coupling: number;
  detune: number;
  resonanceLock: number;
  V_cap_V: number;
  V_break_V: number;
  V_extra_V: number;
  I_primary_A: number;
  I_extra_A: number;
  sparkState: number;
  loopGain: number;
  earthGrip: number;
  regenGain: number;
  chargeFraction: number;
  torque_Nm: number;
  rpm: number;
  I_motor_A: number;
  P_mech_W: number;
  F_lorentz_N: number;
  P_motion_W: number;
  P_atm_W: number;
  P_cavity_W: number;
  P_radiant_W: number;
  P_in_W: number;
  P_loss_W: number;
  P_starter_W: number;
  E_dump_J: number;
  E_cap_J: number;
  E_coil_J: number;
  eta: number;
  speed_ms: number;
  heading_deg: number;
  antenna_h_m: number;
  antenna_L_m: number;
  ground_R_ohm: number;
  V_motion_V: number;
  accel_ms2: number;
  weatherCode: number;
  stabilityCode: number;
  sustain: number;
};

export type EngineEvent = {
  id: string;
  t: number;
  type: EventType;
  message: string;
  snapshot: Telemetry;
};

export type WaveSample = {
  t: number;
  vCap: number;
  vExtra: number;
  iExtra: number;
};

export type ChannelGroup =
  | "run"
  | "world"
  | "circuit"
  | "instability"
  | "motor"
  | "energy"
  | "vehicle";

export type ChannelDef = {
  key: keyof Telemetry;
  group: ChannelGroup;
  label: string;
  unit: string;
  paper: string;
  formula: string;
};

export type PresetId =
  | "colorado"
  | "wardenclyffe"
  | "car1931"
  | "honest";
