/**
 * Conservative Physics Engine — Type Definitions
 *
 * Implements strict, closed-system energy accounting.
 * States are strictly physical coordinates (q, i, omega, theta).
 * No phenomenological scalars or unbacked energy gain terms.
 */

export type SimulationMode = "historical" | "conservative";

export type ConservativeStateVector = {
  q_cap: number;     // Primary capacitor charge [C]
  i_prim: number;    // Primary discharge circuit current [A]
  q_extra: number;   // Extra coil terminal charge [C]
  i_extra: number;   // Extra coil RF oscillatory current [A]
  i_motor: number;   // Motor stator electrical current [A]
  omega: number;     // Motor shaft angular velocity [rad/s]
  theta: number;     // Motor shaft angular position [rad]
};

export type ConservativeParams = {
  // Primary Circuit
  primaryCapacitanceF: number;  // C_prim [F]
  sparkVoltageV: number;        // V_break [V]
  primaryInductanceH: number;   // L_prim [H]
  primaryResistanceOhm: number; // R_prim [Ω]

  // Resonator & Coil
  extraCoilTurns: number;       // N turns
  extraCoilRadiusM: number;     // r [m]
  extraCoilHeightM: number;     // h [m]
  loadingCoilH: number;         // L_loading [H]
  groundResistanceOhm: number;  // R_ground [Ω]
  antennaHeightM: number;       // h_ant [m]
  couplingK: number;            // k: primary to extra coil coupling [0, 0.9]

  // Motor & Drivetrain
  motorInductanceH: number;     // L_m [H]
  motorResistanceOhm: number;   // R_m [Ω]
  motorCouplingKm: number;      // k_m: extra coil to motor coupling [0, 0.9]
  torqueConstantKt: number;     // k_t = k_e [N·m/A = V·s/rad]
  rotorInertiaKgm2: number;     // J_rotor [kg·m²]
  rotorFrictionNmS: number;     // b_rotor [N·m·s/rad]
  gearRatioG: number;           // G (drivetrain reduction ratio)
  gearEfficiency: number;       // η_gear [0, 1]
  wheelRadiusM: number;         // r_w [m]
  vehicleMassKg: number;        // m_veh [kg]
  dragCoefficientCd: number;    // C_d (aerodynamic drag coefficient)
  frontalAreaM2: number;        // A_veh [m²]
  rollingResistanceCrr: number; // C_rr

  // External Starter (Thevenin Supply)
  starterOn: boolean;
  starterVoltageV: number;      // V_starter_oc [V]
  starterResistanceOhm: number; // R_starter [Ω]

  // Ambient Environment
  weather: "fair" | "storm";
  latitude: number;
  altitudeM: number;
  speedMs: number;
};

export type SourceClassification =
  | "ANALYTICAL"
  | "MEASURED"
  | "ESTIMATED"
  | "UNVERIFIED";

export type EnvironmentalSourceReport = {
  id: string;
  name: string;
  classification: SourceClassification;
  f_Hz: number;
  V_oc_V: number;
  Z_source_mag_ohm: number;
  P_available_W: number;
  P_delivered_W: number;
};

export type EnergyLedgerReport = {
  E_initial_J: number;
  E_external_J: number;
  E_environment_J: number;
  W_parameter_J: number;

  E_stored_J: number;
  E_cap_J: number;
  E_mag_coupled_J: number;
  E_extra_elec_J: number;
  E_motor_mag_J: number;
  E_kinetic_J: number;

  E_heat_J: number;
  E_arc_heat_J: number;
  E_prim_cu_heat_J: number;
  E_extra_cu_heat_J: number;
  E_ground_heat_J: number;
  E_motor_cu_heat_J: number;
  E_gear_loss_J: number;
  E_friction_heat_J: number;
  E_road_losses_J: number;

  E_radiated_J: number;

  E_residual_J: number;
  E_residual_relative: number;
  conserved: boolean;
};

export type ConservativeTelemetry = {
  mode: SimulationMode;
  t_s: number;

  // Stored Energies
  E_stored_total_J: number;
  E_cap_J: number;
  E_extra_coil_J: number;
  E_mag_coupled_J: number;
  E_kinetic_J: number;

  // Voltages & Currents
  V_cap_V: number;
  V_break_V: number;
  V_extra_peak_V: number;
  I_primary_A: number;
  I_extra_A: number;
  I_motor_A: number;
  sparkActive: boolean;
  sparkCount: number;

  // Resonances
  f_primary_Hz: number;
  f_extra_self_Hz: number;
  f_extra_loaded_Hz: number;
  f_split_1_Hz: number;
  f_split_2_Hz: number;
  natural_Q: number;

  // Power Flow
  P_starter_W: number;
  P_env_total_W: number;
  P_env_available_W: number;
  P_mech_W: number;
  P_dissipated_W: number;
  P_radiated_W: number;

  // Mechanical / Drivetrain
  torque_em_Nm: number;
  torque_load_Nm: number;
  rpm: number;
  speed_ms: number;
  accel_ms2: number;

  // Coupling State
  k: number;
  k_m: number;
  det_L_normal: number;
  coupling_valid: boolean;

  // Ledger & Verification
  ledger: EnergyLedgerReport;
  sources: EnvironmentalSourceReport[];
  convergence_order: number;
};

export type ComparativeTelemetry = {
  t_s: number;
  historical: {
    loopGain: number;
    sustain: boolean;
    f0_Hz: number;
    Q_eff: number;
    P_in_W: number;
    P_mech_W: number;
    E_cap_J: number;
    loopGain_cross: boolean;
    energy_ledger_valid: boolean;
  };
  conservative: {
    conserved: boolean;
    f_extra_loaded_Hz: number;
    Q_natural: number;
    P_in_W: number;
    P_mech_W: number;
    E_stored_J: number;
    E_residual_J: number;
    sparkCount: number;
  };
};
