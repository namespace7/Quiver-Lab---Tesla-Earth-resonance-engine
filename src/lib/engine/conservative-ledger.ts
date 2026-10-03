/**
 * Conservative Energy Ledger
 *
 * Implements the continuous energy conservation audit.
 * Invariant: E_in + W_param - E_stored - E_losses = E_residual -> 0.
 */

import type {
  ConservativeStateVector,
  EnergyLedgerReport,
} from "./conservative-types.ts";

export class ConservativeLedger {
  // Inflows
  E_initial = 0;
  E_external = 0;
  E_environment = 0;
  W_parameter = 0;

  // Cumulative Losses (Heat)
  E_arc_heat = 0;
  E_prim_cu_heat = 0;
  E_extra_cu_heat = 0;
  E_ground_heat = 0;
  E_motor_cu_heat = 0;
  E_gear_loss = 0;
  E_friction_heat = 0;
  E_road_losses = 0;
  E_leak_heat = 0;

  // Cumulative Losses (Radiation)
  E_radiated = 0;

  // Tolerances
  readonly ABSOLUTE_TOLERANCE_J = 1.0e-4; // 100 µJ
  readonly RELATIVE_TOLERANCE = 1.0e-4;   // 0.01%

  constructor(initialStoredEnergy: number) {
    this.E_initial = initialStoredEnergy;
  }

  reset(newInitialStored: number) {
    this.E_initial = newInitialStored;
    this.E_external = 0;
    this.E_environment = 0;
    this.W_parameter = 0;
    this.E_arc_heat = 0;
    this.E_prim_cu_heat = 0;
    this.E_extra_cu_heat = 0;
    this.E_ground_heat = 0;
    this.E_motor_cu_heat = 0;
    this.E_gear_loss = 0;
    this.E_friction_heat = 0;
    this.E_road_losses = 0;
    this.E_leak_heat = 0;
    this.E_radiated = 0;
  }

  recordStep(
    dt: number,
    P_external: number,
    P_environment: number,
    P_arc: number,
    P_prim_cu: number,
    P_extra_cu: number,
    P_ground: number,
    P_motor_cu: number,
    P_gear_loss: number,
    P_friction: number,
    P_road: number,
    P_rad: number,
    P_leak = 0,
    dW_param = 0,
  ) {
    this.E_external += P_external * dt;
    this.E_environment += P_environment * dt;
    this.W_parameter += dW_param;

    this.E_arc_heat += P_arc * dt;
    this.E_prim_cu_heat += P_prim_cu * dt;
    this.E_extra_cu_heat += P_extra_cu * dt;
    this.E_ground_heat += P_ground * dt;
    this.E_motor_cu_heat += P_motor_cu * dt;
    this.E_gear_loss += P_gear_loss * dt;
    this.E_friction_heat += P_friction * dt;
    this.E_road_losses += P_road * dt;
    this.E_leak_heat += P_leak * dt;

    this.E_radiated += P_rad * dt;
  }

  computeReport(
    state: ConservativeStateVector,
    C_prim: number,
    C_tot: number,
    L_matrix: number[][],
    J_eq: number,
  ): EnergyLedgerReport {
    // 1. Stored Electrostatic
    const E_cap = (state.q_cap * state.q_cap) / (2 * Math.max(C_prim, 1e-12));
    const E_extra_elec = (state.q_extra * state.q_extra) / (2 * Math.max(C_tot, 1e-12));

    // 2. Stored Coupled Magnetic: 1/2 i^T L i
    const i = [state.i_prim, state.i_extra, state.i_motor];
    let E_mag = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        E_mag += 0.5 * i[r]! * L_matrix[r]![c]! * i[c]!;
      }
    }
    // Ensure small floating point noise around zero does not produce negative stored energy
    E_mag = Math.max(0, E_mag);

    // 3. Stored Mechanical Kinetic: 1/2 J_eq omega^2
    const E_kinetic = 0.5 * J_eq * state.omega * state.omega;

    const E_stored = E_cap + E_extra_elec + E_mag + E_kinetic;

    // 4. Cumulative Losses
    const E_heat =
      this.E_arc_heat +
      this.E_prim_cu_heat +
      this.E_extra_cu_heat +
      this.E_ground_heat +
      this.E_motor_cu_heat +
      this.E_gear_loss +
      this.E_friction_heat +
      this.E_road_losses +
      this.E_leak_heat;

    // 5. Total Inflows
    const E_inflows = this.E_initial + this.E_external + this.E_environment + this.W_parameter;

    // 6. Conservation Invariant Check
    const E_residual = E_inflows - (E_stored + E_heat + this.E_radiated);
    const maxScale = Math.max(E_inflows, E_stored, 1.0);
    const relResidual = Math.abs(E_residual) / maxScale;

    const conserved =
      Math.abs(E_residual) <= this.ABSOLUTE_TOLERANCE_J ||
      relResidual <= this.RELATIVE_TOLERANCE;

    return {
      E_initial_J: this.E_initial,
      E_external_J: this.E_external,
      E_environment_J: this.E_environment,
      W_parameter_J: this.W_parameter,

      E_stored_J: E_stored,
      E_cap_J: E_cap,
      E_mag_coupled_J: E_mag,
      E_extra_elec_J: E_extra_elec,
      E_motor_mag_J: 0.5 * L_matrix[2]![2]! * state.i_motor * state.i_motor,
      E_kinetic_J: E_kinetic,

      E_heat_J: E_heat,
      E_arc_heat_J: this.E_arc_heat,
      E_prim_cu_heat_J: this.E_prim_cu_heat,
      E_extra_cu_heat_J: this.E_extra_cu_heat,
      E_ground_heat_J: this.E_ground_heat,
      E_motor_cu_heat_J: this.E_motor_cu_heat,
      E_gear_loss_J: this.E_gear_loss,
      E_friction_heat_J: this.E_friction_heat,
      E_road_losses_J: this.E_road_losses,

      E_radiated_J: this.E_radiated,

      E_residual_J: E_residual,
      E_residual_relative: relResidual,
      conserved,
    };
  }
}
