import type {
  ChannelDef,
  ChannelGroup,
  EventType,
  Telemetry,
} from "./types";

export const GROUP_LABEL: Record<ChannelGroup, string> = {
  run: "Clock",
  world: "World & Medium",
  circuit: "Resonator & Gap",
  instability: "Valve & Gain",
  motor: "Motor Coupling",
  energy: "Energy Ledger",
  vehicle: "Vehicle Chassis",
};

export const ALL_EVENT_TYPES: EventType[] = [
  "SPARK_DUMP",
  "RESONANCE_LOCK",
  "RESONANCE_LOST",
  "LOOP_GAIN_CROSS",
  "SUSTAIN_ON",
  "SUSTAIN_OFF",
  "Q_COLLAPSE",
  "MOTOR_PULSE",
  "STARTER_ARM",
  "GROUND_FAULT",
  "BREAKDOWN_MISS",
];

export const EVENT_META: Record<EventType, { hint: string }> = {
  SPARK_DUMP: { hint: "Condenser disruptive discharge into primary" },
  RESONANCE_LOCK: { hint: "Operating frequency locked within 1/Q bandwidth" },
  RESONANCE_LOST: { hint: "Operating frequency detuned outside 1/Q bandwidth" },
  LOOP_GAIN_CROSS: { hint: "Loop gain crossed unity threshold" },
  SUSTAIN_ON: { hint: "Regenerative sustain loop engaged" },
  SUSTAIN_OFF: { hint: "Regenerative sustain loop collapsed" },
  Q_COLLAPSE: { hint: "Loaded quality factor dropped below critical threshold" },
  MOTOR_PULSE: { hint: "Torque pulse delivered to rotor" },
  STARTER_ARM: { hint: "Auxiliary starter power active" },
  GROUND_FAULT: { hint: "Excessive ground resistance damped oscillation" },
  BREAKDOWN_MISS: { hint: "Capacitor voltage stalled below breakdown potential" },
};

export const CHANNELS: ChannelDef[] = [
  // Run
  { key: "t_s", group: "run", label: "Time", unit: "s", paper: "Chronometer", formula: "t" },
  { key: "cycle", group: "run", label: "Cycle Count", unit: "", paper: "US 462,418", formula: "n_cycle" },
  { key: "dumpCount", group: "run", label: "Dump Count", unit: "", paper: "US 462,418", formula: "n_dump" },
  { key: "sparkRate_Hz", group: "run", label: "Spark Rate", unit: "Hz", paper: "CSN 1899", formula: "1 / T_cycle" },

  // World
  { key: "lat_deg", group: "world", label: "Latitude", unit: "°", paper: "Geodesy", formula: "lat" },
  { key: "lon_deg", group: "world", label: "Longitude", unit: "°", paper: "Geodesy", formula: "lon" },
  { key: "alt_m", group: "world", label: "Altitude", unit: "m", paper: "CSN 1899", formula: "alt" },
  { key: "magLat_deg", group: "world", label: "Geomagnetic Lat", unit: "°", paper: "Dipole model", formula: "lat - 11.5°" },
  { key: "B_nT", group: "world", label: "Total B field", unit: "nT", paper: "Geomagnetism", formula: "B0 * sqrt(1 + 3sin²λ)" },
  { key: "B_h_nT", group: "world", label: "Horizontal B", unit: "nT", paper: "Geomagnetism", formula: "B0 * cos(λ)" },
  { key: "B_v_nT", group: "world", label: "Vertical B", unit: "nT", paper: "Geomagnetism", formula: "2B0 * sin(λ)" },
  { key: "inclination_deg", group: "world", label: "Dip Angle", unit: "°", paper: "Geomagnetism", formula: "atan2(Bv, Bh)" },
  { key: "E_atm_Vm", group: "world", label: "Atm Electric Field", unit: "V/m", paper: "Global circuit", formula: "E_z" },
  { key: "f_schumann_Hz", group: "world", label: "Schumann Resonance", unit: "Hz", paper: "Schumann 1952", formula: "c / (2πR * sqrt(2))" },
  { key: "f_tesla_Hz", group: "world", label: "Tesla Earth Freq", unit: "Hz", paper: "US 787,412", formula: "Tesla stationary wave" },
  { key: "f_target_Hz", group: "world", label: "Target Frequency", unit: "Hz", paper: "Tuning", formula: "f_target" },
  { key: "weatherCode", group: "world", label: "Weather State", unit: "", paper: "Atmosphere", formula: "fair / storm" },

  // Circuit
  { key: "N_turns", group: "circuit", label: "Extra Coil Turns", unit: "", paper: "US 787,412", formula: "N" },
  { key: "L_extra_H", group: "circuit", label: "Extra Inductance", unit: "H", paper: "CSN 1899", formula: "μ0 N² π r² / h" },
  { key: "L_primary_H", group: "circuit", label: "Primary Inductance", unit: "H", paper: "CSN 1899", formula: "L_prim" },
  { key: "L_loading_H", group: "circuit", label: "Loading Inductance", unit: "H", paper: "US 1,119,732", formula: "L_load" },
  { key: "R_extra_ohm", group: "circuit", label: "Extra DC Resistance", unit: "Ω", paper: "CSN 1899", formula: "ρ * ℓ / A" },
  { key: "R_total_ohm", group: "circuit", label: "Total AC+Ground R", unit: "Ω", paper: "CSN 1899", formula: "Rac + Rground" },
  { key: "C_top_F", group: "circuit", label: "Top Capacitance", unit: "F", paper: "US 787,412", formula: "2πε0 h / ln(2h/a)" },
  { key: "C_primary_F", group: "circuit", label: "Primary Cap", unit: "F", paper: "US 462,418", formula: "C_prim" },
  { key: "C_earth_F", group: "circuit", label: "Earth Capacitance", unit: "F", paper: "Phenomenological", formula: "earthGrip * 8µF" },
  { key: "C_total_F", group: "circuit", label: "Total Secondary C", unit: "F", paper: "Resonator", formula: "Ctop + Cearth" },
  { key: "f0_Hz", group: "circuit", label: "Operating Freq f0", unit: "Hz", paper: "Thomson LC", formula: "1 / (2π sqrt(LC))" },
  { key: "omega", group: "circuit", label: "Angular Frequency", unit: "rad/s", paper: "LC", formula: "2π f0" },
  { key: "Q_ideal", group: "circuit", label: "Unloaded Q", unit: "", paper: "CSN 1899", formula: "ωL / Rdc" },
  { key: "Q_eff", group: "circuit", label: "Loaded Q", unit: "", paper: "CSN 1899", formula: "ωL / Rtot" },
  { key: "magnification", group: "circuit", label: "Magnification Factor", unit: "", paper: "US 787,412", formula: "pL / R" },
  { key: "k_coupling", group: "circuit", label: "Magnetic Coupling k", unit: "", paper: "US 787,412", formula: "M / sqrt(L1 L2)" },
  { key: "detune", group: "circuit", label: "Detune Fraction", unit: "", paper: "Tuning", formula: "(f0 - f_target) / f_target" },
  { key: "resonanceLock", group: "circuit", label: "Resonance Lock", unit: "", paper: "Phase lock", formula: "|detune| < 1/Q" },
  { key: "V_cap_V", group: "circuit", label: "Capacitor Voltage", unit: "V", paper: "US 462,418", formula: "sqrt(2 E_cap / C)" },
  { key: "V_break_V", group: "circuit", label: "Spark Voltage Vbreak", unit: "V", paper: "US 462,418", formula: "V_spark" },
  { key: "V_extra_V", group: "circuit", label: "Extra Coil Peak V", unit: "V", paper: "US 787,412", formula: "Envelope Vx" },
  { key: "I_primary_A", group: "circuit", label: "Primary Current", unit: "A", paper: "US 462,418", formula: "i_prim" },
  { key: "I_extra_A", group: "circuit", label: "Extra Coil Current", unit: "A", paper: "US 787,412", formula: "Vx / Z" },
  { key: "sparkState", group: "circuit", label: "Spark State", unit: "", paper: "US 462,418", formula: "arc active (0/1)" },

  // Instability
  { key: "loopGain", group: "instability", label: "Loop Gain", unit: "", paper: "Regeneration", formula: "(E_fb + E_amb) / E_dump" },
  { key: "earthGrip", group: "instability", label: "Earth Grip Knob", unit: "", paper: "Phenomenological", formula: "coupling scalar" },
  { key: "regenGain", group: "instability", label: "Regen Gain Knob", unit: "", paper: "Phenomenological", formula: "feedback scalar" },
  { key: "chargeFraction", group: "instability", label: "Charge Fraction", unit: "", paper: "Condenser", formula: "V_cap / V_break" },
  { key: "stabilityCode", group: "instability", label: "Stability State", unit: "", paper: "Lyapunov", formula: "damped / marginal / unstable" },
  { key: "sustain", group: "instability", label: "Sustain State", unit: "", paper: "Regeneration", formula: "loopGain > 1.02 & locked" },

  // Motor
  { key: "I_motor_A", group: "motor", label: "Motor Current", unit: "A", paper: "US 381,968", formula: "|iX| * 0.08 * k" },
  { key: "torque_Nm", group: "motor", label: "Electromagnetic Torque", unit: "N·m", paper: "US 381,968", formula: "kt * I_motor" },
  { key: "rpm", group: "motor", label: "Motor Speed", unit: "RPM", paper: "US 381,968", formula: "ω * 60 / 2π" },
  { key: "P_mech_W", group: "motor", label: "Mechanical Power", unit: "W", paper: "US 381,968", formula: "τ * ω" },
  { key: "F_lorentz_N", group: "motor", label: "Motional Lorentz F", unit: "N", paper: "Lorentz", formula: "I * L * Bh" },

  // Energy
  { key: "P_motion_W", group: "energy", label: "Motional Power In", unit: "W", paper: "Motional EMF", formula: "V_motion² / R_load" },
  { key: "P_atm_W", group: "energy", label: "Atmospheric Power In", unit: "W", paper: "Atmosphere", formula: "E_atm * h * I_corona" },
  { key: "P_cavity_W", group: "energy", label: "Cavity Coupling In", unit: "W", paper: "Phenomenological", formula: "grip * 0.35W" },
  { key: "P_radiant_W", group: "energy", label: "Radiant Plate Power", unit: "W", paper: "US 685,957", formula: "α * Area" },
  { key: "P_starter_W", group: "energy", label: "Starter Input Power", unit: "W", paper: "External", formula: "P_starter" },
  { key: "P_in_W", group: "energy", label: "Total Power In", unit: "W", paper: "Summation", formula: "Σ P_in" },
  { key: "P_loss_W", group: "energy", label: "Total Dissipation", unit: "W", paper: "Ohmic", formula: "I²R_total" },
  { key: "E_dump_J", group: "energy", label: "Last Dump Energy", unit: "J", paper: "US 462,418", formula: "1/2 C V_break²" },
  { key: "E_cap_J", group: "energy", label: "Stored Capacitor E", unit: "J", paper: "Electrostatic", formula: "1/2 C V_cap²" },
  { key: "E_coil_J", group: "energy", label: "Stored Extra Coil E", unit: "J", paper: "LC Resonator", formula: "1/2 Ctot Vextra²" },
  { key: "eta", group: "energy", label: "Apparent Efficiency", unit: "", paper: "Ledger", formula: "P_mech / P_in" },

  // Vehicle
  { key: "speed_ms", group: "vehicle", label: "Vehicle Speed", unit: "m/s", paper: "Chassis", formula: "v" },
  { key: "heading_deg", group: "vehicle", label: "Compass Heading", unit: "°", paper: "Navigation", formula: "heading" },
  { key: "antenna_h_m", group: "vehicle", label: "Antenna Height", unit: "m", paper: "US 787,412", formula: "h_ant" },
  { key: "antenna_L_m", group: "vehicle", label: "Antenna Length", unit: "m", paper: "Motional EMF", formula: "L_ant" },
  { key: "ground_R_ohm", group: "vehicle", label: "Ground Resistance", unit: "Ω", paper: "Earthing", formula: "R_ground" },
  { key: "V_motion_V", group: "vehicle", label: "Motional Open-Circuit V", unit: "V", paper: "Motional EMF", formula: "Bh * L * v" },
  { key: "accel_ms2", group: "vehicle", label: "Chassis Acceleration", unit: "m/s²", paper: "Newton", formula: "F_net / mass" },
];