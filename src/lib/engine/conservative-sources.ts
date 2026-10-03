/**
 * Conservative Environmental Sources
 *
 * Implements rigorous Thevenin equivalent circuits for environmental electromagnetic coupling.
 * Enforces: P_delivered <= P_available.
 * No arbitrary power scalars or unbacked energy injection.
 */

import type {
  ConservativeParams,
  EnvironmentalSourceReport,
} from "./conservative-types.ts";

const EPS0 = 8.854187817e-12;
const RHO_AIR = 2.0e-14; // S/m (fair-weather air conductivity)

export interface IEnvironmentalSource {
  readonly id: string;
  readonly name: string;
  getReport(params: ConservativeParams, V_cap: number): EnvironmentalSourceReport;
  getDeliveredCurrent(params: ConservativeParams, V_cap: number): number;
}

/**
 * Atmospheric Electric Field Source
 * GEC conduction current and electrostatic potential gradient.
 */
export class AtmosphericSource implements IEnvironmentalSource {
  readonly id = "atmospheric";
  readonly name = "Atmospheric Electric Field (GEC)";

  private getVoc(params: ConservativeParams): number {
    const Ez = params.weather === "storm" ? 5000 : 130; // V/m
    // For a bare vertical monopole, effective collector height is h/2
    const hEff = params.antennaHeightM * 0.5;
    return Ez * hEff;
  }

  private getRsource(params: ConservativeParams): number {
    // Monopole self-capacitance
    const h = Math.max(params.antennaHeightM, 0.2);
    const a = 0.006;
    const Ctop = (2 * Math.PI * EPS0 * h) / Math.log((2 * h) / a);
    return EPS0 / (RHO_AIR * Math.max(Ctop, 1e-12));
  }

  getReport(params: ConservativeParams, V_cap: number): EnvironmentalSourceReport {
    const Voc = this.getVoc(params);
    const Rth = this.getRsource(params);
    const P_avail = (Voc * Voc) / (4 * Rth);
    const I_del = this.getDeliveredCurrent(params, V_cap);
    const P_del = Math.max(0, V_cap * I_del);

    return {
      id: this.id,
      name: this.name,
      classification: "ANALYTICAL",
      f_Hz: 0,
      V_oc_V: Voc,
      Z_source_mag_ohm: Rth,
      P_available_W: P_avail,
      P_delivered_W: P_del,
    };
  }

  getDeliveredCurrent(params: ConservativeParams, V_cap: number): number {
    const Voc = this.getVoc(params);
    const Rth = this.getRsource(params);
    // Direct diode connection to storage capacitor
    // Diode forward drop ~ 0.6V
    if (V_cap + 0.6 >= Voc) return 0;
    return (Voc - (V_cap + 0.6)) / Rth;
  }
}

/**
 * Telluric Currents (Magnetotelluric Crustal Gradient)
 */
export class TelluricSource implements IEnvironmentalSource {
  readonly id = "telluric";
  readonly name = "Telluric Crustal Currents";

  getReport(params: ConservativeParams, V_cap: number): EnvironmentalSourceReport {
    const dWheelbase = 2.5; // m
    const Etelluric = 1e-5; // V/m (typical quiet magnetotelluric field)
    const Voc = Etelluric * dWheelbase; // ~25 µV
    const Rloop = 30; // Ω (bulk soil spreading resistance + contacts)
    const P_avail = (Voc * Voc) / (4 * Rloop); // ~5.2 pW
    const I_del = this.getDeliveredCurrent(params, V_cap);

    return {
      id: this.id,
      name: this.name,
      classification: "MEASURED",
      f_Hz: 0.1,
      V_oc_V: Voc,
      Z_source_mag_ohm: Rloop,
      P_available_W: P_avail,
      P_delivered_W: Math.max(0, V_cap * I_del),
    };
  }

  getDeliveredCurrent(_params: ConservativeParams, _V_cap: number): number {
    // Passive diode rectifier threshold is >= 200 mV.
    // Voc is 25 µV (4 orders of magnitude below threshold). Zero delivery.
    return 0;
  }
}

/**
 * Geomagnetic Motional Induction (v x B)
 */
export class GeomagneticMotionalSource implements IEnvironmentalSource {
  readonly id = "geomagnetic";
  readonly name = "Geomagnetic Motional EMF (v × B)";

  getReport(_params: ConservativeParams, _V_cap: number): EnvironmentalSourceReport {
    // Closed-loop Faraday cancellation in uniform magnetic field
    return {
      id: this.id,
      name: this.name,
      classification: "ANALYTICAL",
      f_Hz: 0,
      V_oc_V: 0,
      Z_source_mag_ohm: 8,
      P_available_W: 0,
      P_delivered_W: 0,
    };
  }

  getDeliveredCurrent(_params: ConservativeParams, _V_cap: number): number {
    return 0;
  }
}

/**
 * Schumann Cavity Mode (7.83 Hz)
 */
export class SchumannSource implements IEnvironmentalSource {
  readonly id = "schumann";
  readonly name = "Earth-Ionosphere Schumann Resonance";

  getReport(params: ConservativeParams, _V_cap: number): EnvironmentalSourceReport {
    const f = 7.83;
    const Erms = 0.75e-3; // V/m
    const hEff = params.antennaHeightM * 0.5;
    const Voc = Erms * hEff; // ~0.69 µV

    const h = Math.max(params.antennaHeightM, 0.2);
    const a = 0.006;
    const Ctop = (2 * Math.PI * EPS0 * h) / Math.log((2 * h) / a);
    const Xc = 1 / (2 * Math.PI * f * Math.max(Ctop, 1e-12)); // ~1.27 GΩ

    // Resistive unmatched ceiling: Voc^2 / (2 * Xc)
    const P_avail = (Voc * Voc) / (2 * Xc); // ~0.19 zW

    return {
      id: this.id,
      name: this.name,
      classification: "MEASURED",
      f_Hz: f,
      V_oc_V: Voc,
      Z_source_mag_ohm: Xc,
      P_available_W: P_avail,
      P_delivered_W: 0, // Cannot overcome diode threshold into HV capacitor
    };
  }

  getDeliveredCurrent(_params: ConservativeParams, _V_cap: number): number {
    return 0;
  }
}

/**
 * Ambient RF Radiation
 */
export class AmbientRFSource implements IEnvironmentalSource {
  readonly id = "ambient_rf";
  readonly name = "Ambient RF Spectral Flux";

  getReport(_params: ConservativeParams, _V_cap: number): EnvironmentalSourceReport {
    // 1931 historical background flux at natural coil resonance (~30-190 kHz)
    const S_inc = 1e-10; // W/m²
    const A_eff = 0.5;   // m²
    const P_avail = S_inc * A_eff; // ~50 pW

    return {
      id: this.id,
      name: this.name,
      classification: "ESTIMATED",
      f_Hz: 191000,
      V_oc_V: 1e-5, // 10 µV
      Z_source_mag_ohm: 50,
      P_available_W: P_avail,
      P_delivered_W: 0,
    };
  }

  getDeliveredCurrent(_params: ConservativeParams, _V_cap: number): number {
    return 0;
  }
}

/**
 * Environmental Sources Manager
 */
export class EnvironmentalManager {
  readonly sources: IEnvironmentalSource[] = [
    new AtmosphericSource(),
    new TelluricSource(),
    new GeomagneticMotionalSource(),
    new SchumannSource(),
    new AmbientRFSource(),
  ];

  getReports(params: ConservativeParams, V_cap: number): EnvironmentalSourceReport[] {
    return this.sources.map((s) => s.getReport(params, V_cap));
  }

  getTotalDeliveredCurrent(params: ConservativeParams, V_cap: number): number {
    return this.sources.reduce((sum, s) => sum + s.getDeliveredCurrent(params, V_cap), 0);
  }

  getTotalDeliveredPower(params: ConservativeParams, V_cap: number): number {
    const I = this.getTotalDeliveredCurrent(params, V_cap);
    return Math.max(0, V_cap * I);
  }
}
