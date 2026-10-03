# Quiver Lab

*Tesla-Inspired Electromagnetic & Earth-Coupling Simulation*

Quiver Lab is an interactive, browser-based simulation laboratory for exploring coupled electrical resonance, Tesla-coil-inspired systems, spark-gap discharges, electromechanical motor conversion, and environmental electromagnetic coupling hypotheses.

The core objective of the project is to provide a rigorous, transparent, and auditable computational environment where every energy flow, storage reservoir, and dissipation mechanism is explicitly accounted for.

---

## 1. Overview

Quiver Lab models the electrodynamics of high-voltage, high-frequency resonant circuits coupled to electromechanical loads and geoelectric/electromagnetic environmental interfaces:

- **Coupled Resonant Circuits:** Primary LC tank coupled magnetically to a secondary/extra-coil helical resonator.
- **Spark-Gap Discharges:** Non-linear dielectric breakdown, dynamic arc conduction, and deionization quenching.
- **Electromechanical Transduction:** Motor stator winding back-EMF, electromagnetic torque generation, and drivetrain dynamics.
- **Vehicle Mechanics:** Aerodynamic drag, rolling resistance, and rotational inertia reflected through a rigid gearbox.
- **Environmental Source Equivalents:** Thevenin circuit representations of the atmospheric electric field (Global Electrical Circuit), telluric ground currents, Schumann cavity resonance, and ambient RF radiation.
- **Energy Accounting:** A real-time energy ledger evaluating stored, injected, and dissipated energy.

---

## 2. Why Quiver Lab Exists

Early iterations of the simulator employed a phenomenological model with heuristic coupling parameters such as `earthGrip`, `regenerativeGain`, `loopGain`, and virtual ground capacitances (`Cearth`). While visually responsive, these parameters could produce sustained or high-energy oscillations without identifying an explicit physical source for each joule.

Quiver Lab introduces the **Conservative Energy-Conserved Model** to eliminate this ambiguity. The simulation architecture adheres to a strict physical principle:

> **Every joule must have an identifiable source, storage path, conversion path, or dissipation sink.**

Energy cannot be created or sustained merely by increasing a slider or coupling coefficient.

---

## 3. What the Simulator Models

```text
External / Environmental Energy
            ↓
     Source Equivalent
            ↓
        Converter
            ↓
     Primary Capacitor
            ↓
       Spark / Primary
            ↓
      Coupled Extra Coil
            ↓
          Motor
            ↓
       Drivetrain
            ↓
          Wheels
```

Energy enters the system through initial stored charges or external power supplies (e.g., starter battery). Inflow passes through intermediate coupling networks into storage capacitors, discharges through the primary winding upon spark breakdown, couples magnetically into the extra coil, transfers to the motor stator, and converts into mechanical work at the wheels.

---

## 4. Architecture

Quiver Lab maintains two strictly isolated simulation engines accessible via the UI mode toggle:

```
               ┌─────────────────────────────────┐
               │         Quiver Lab UI           │
               └────────────────┬────────────────┘
                                │
               ┌────────────────┴────────────────┐
               │        Zustand Lab Store        │
               └────────┬───────────────┬────────┘
                        │               │
        ┌───────────────▼──┐   ┌────────▼───────────────┐
        │   Conservative   │   │     Historical /       │
        │  Physics Engine  │   │ Phenomenological Engine│
        │  (7-State ODE)   │   │  (Heuristic / Legacy)  │
        └──────────────────┘   └────────────────────────┘
```

1. **Energy-Conserved Model:** 7-state differential equation solver enforcing closed First Law energy accounting.
2. **Historical / Phenomenological Model:** Retained for historical comparison and exploration of early heuristic models.

---

## 5. Conservative Energy-Conserved Model

### State Vector
The conservative system is defined by a 7-dimensional physical coordinate vector:

$$\vec{x}(t) = \begin{bmatrix} q_{\text{cap}} \\ i_{\text{prim}} \\ q_{\text{extra}} \\ i_{\text{extra}} \\ i_{\text{motor}} \\ \omega \\ \theta \end{bmatrix} \in \mathbb{R}^7$$

- $q_{\text{cap}}$ (C): Charge on primary capacitor $C_p$ ($\dot{q}_{\text{cap}} = -i_{\text{prim}} + I_{\text{starter}} + I_{\text{env}} - I_{\text{leak}}$).
- $i_{\text{prim}}$ (A): Current in primary inductor $L_p$.
- $q_{\text{extra}}$ (C): Terminal charge on extra-coil top-load capacitance $C_{\text{tot}}$ ($\dot{q}_{\text{extra}} = i_{\text{extra}}$).
- $i_{\text{extra}}$ (A): Oscillatory current in extra-coil inductance $L_e$.
- $i_{\text{motor}}$ (A): Current in motor stator winding $L_m$.
- $\omega$ (rad/s): Angular velocity of motor rotor shaft.
- $\theta$ (rad): Angular position of motor shaft ($\dot{\theta} = \omega$).

### Coupled Inductance Matrix
The 3-coil inductive subsystem ($L_p, L_e, L_m$) is governed by:

$$\mathbf{L} = \begin{bmatrix} L_p & M & 0 \\ M & L_e & M_m \\ 0 & M_m & L_m \end{bmatrix}$$

where mutual inductances are defined by coupling coefficients $k$ and $k_m$:

$$M = k \sqrt{L_p L_e}, \quad M_m = k_m \sqrt{L_e L_m}$$

Stored magnetic energy is:

$$E_{\text{mag}} = \frac{1}{2} \vec{i}^T \mathbf{L} \vec{i} = \frac{1}{2} L_p i_{\text{prim}}^2 + \frac{1}{2} L_e i_{\text{extra}}^2 + \frac{1}{2} L_m i_{\text{motor}}^2 + M i_{\text{prim}} i_{\text{extra}} + M_m i_{\text{extra}} i_{\text{motor}}$$

### Positive Definiteness
To ensure magnetic energy $E_{\text{mag}} \ge 0$ for all non-zero currents, $\mathbf{L}$ must be positive definite ($\det(\mathbf{L}) > 0$). Expanding the determinant:

$$\det(\mathbf{L}) = L_p L_e L_m (1 - k^2 - k_m^2) > 0 \iff k^2 + k_m^2 < 1$$

The engine enforces this condition automatically, scaling mutual coupling parameters if $k^2 + k_m^2 \ge 0.98^2$.

### Spark-Gap Quench Model
The spark gap conducts when $V_{\text{cap}} \ge V_{\text{break}}$. During conduction, dynamic arc resistance follows a modified Cassie-Mayr model:

$$R_{\text{arc}} = \frac{V_{\text{arc}}}{|i_{\text{prim}}| + 0.1} + R_{\text{plasma}} + R_{\text{quench}}$$

When the arc timer expires, deionization resistance ($R_{\text{quench}} = 50\,\Omega$) damps primary current via Joule heating. Upon open-circuit cutoff, any residual magnetic energy $\frac{1}{2} L_p i_{\text{prim}}^2 + M i_{\text{prim}} i_{\text{extra}}$ is explicitly transferred to arc channel heat ($E_{\text{arc\_heat}}$), eliminating discontinuous energy destruction.

---

## 6. Motor / Mechanical Model

The motor electromechanical interface couples the electrical stator to the mechanical drivetrain:

- **Back-EMF:** Stator voltage opposes current via $e = K_t \omega$.
- **Electromagnetic Torque:** Driving torque is $\tau_{\text{em}} = K_t i_{\text{motor}}$.
- **Power Transduction Identity:** Electrical power converted equals mechanical power delivered:
  $$P_{\text{em\_elec}} = e \cdot i_{\text{motor}} = (K_t \omega) i_{\text{motor}} = (K_t i_{\text{motor}}) \omega = \tau_{\text{em}} \omega = P_{\text{em\_mech}}$$
- **Drivetrain Kinematics:** Vehicle road velocity $v$ is constrained rigidly by wheel radius $r_{\text{wheel}}$ and gear ratio $G$:
  $$v = \omega \cdot \frac{r_{\text{wheel}}}{G}$$
- **Rotor Dynamics:**
  $$J_{\text{eq}} \frac{d\omega}{dt} = \eta_{\text{gear}} \tau_{\text{em}} - b \omega - \tau_{\text{road}}$$
  where $J_{\text{eq}} = J_{\text{rotor}} + m_{\text{veh}} (r_{\text{wheel}} / G)^2$ and $\tau_{\text{road}} = (F_{\text{drag}} + F_{\text{rr}}) (r_{\text{wheel}} / G)$.

Vehicle velocity is algebraically constrained to drivetrain rotation; road-load power is purely a dissipative loss rather than an independent energy source.

---

## 7. Environmental Energy Sources

The conservative engine implements analytical Thevenin equivalent circuits for ambient sources:

| Source | Open-Circuit Voltage $V_{\text{oc}}$ | Source Impedance $Z_{\text{source}}$ | Available Power $P_{\text{avail}}$ | Delivered Power into HV Bus |
| :--- | :--- | :--- | :--- | :--- |
| **Atmospheric Electric Field (GEC)** | $120.25\,\text{V}$ | $27.63\,\text{T}\Omega$ | $130.8\,\text{pW}$ | **$0.000\,\text{W}$** |
| **Telluric Crustal Currents** | $25.0\,\mu\text{V}$ | $30\,\Omega$ | $5.21\,\text{pW}$ | **$0.000\,\text{W}$** |
| **Geomagnetic Motional ($v \times B$)** | $0.000\,\text{V}$ | $8\,\Omega$ | $0.000\,\text{W}$ | **$0.000\,\text{W}$** |
| **Schumann Resonance (7.83 Hz)** | $0.693\,\mu\text{V}$ | $1.27\,\text{G}\Omega$ ($X_c$) | $0.189\,\text{zW}$ | **$0.000\,\text{W}$** |
| **Ambient RF Spectral Flux** | $10.0\,\mu\text{V}$ | $50\,\Omega$ | $50.0\,\text{pW}$ | **$0.000\,\text{W}$** |
| **External Starter Battery** | $10,000\,\text{V}$ | $1,000\,\Omega$ | $25.0\,\text{kW}$ | **$\le 25.0\,\text{kW}$** |

### Environmental Harvesting Realities
- **Voltage Mismatch:** The primary capacitor operates at $V_{\text{cap}} \sim 8\,\text{kV}$. Atmospheric $V_{\text{oc}} \approx 120\,\text{V}$ leaves passive diode rectifiers reverse-biased ($I_{\text{del}} \equiv 0$).
- **Impedance Mismatch:** Atmospheric air column resistance ($R_{\text{th}} \approx 27.6\,\text{T}\Omega$) limits maximum fair-weather available power to $\sim 130\,\text{pW}$.
- **Traction Power Deficit:** Sustaining a $60\,\text{kW}$ electric motor requires 14 orders of magnitude more power than ambient fair-weather harvesting can provide. In the conservative model, the simulation operates exclusively on external starter battery input.

---

## 8. Energy Accounting

The continuous First Law energy balance is evaluated at every timestep:

$$\underbrace{E_{\text{initial}} + E_{\text{external}} + E_{\text{environment}} + W_{\text{param}}}_{E_{\text{inflows}}} - \left( \underbrace{E_{\text{stored}}}_{E_{\text{cap}} + E_{\text{extra}} + E_{\text{mag}} + E_{\text{kin}}} + \underbrace{E_{\text{heat}} + E_{\text{rad}}}_{E_{\text{losses}}} \right) = E_{\text{residual}}$$

- **Invariant:** $E_{\text{residual}} \to 0$ (ledger tolerance: absolute $\le 100\,\mu\text{J}$, relative $\le 0.01\%$).
- **Parameter Re-baselining:** Changing physical parameters (e.g., swapping capacitors via sliders) reconfigures the physical experiment baseline, re-syncing $E_{\text{initial}} = E_{\text{stored}}$ and setting $W_{\text{param}} = 0$ to prevent phantom energy accumulation.

---

## 9. Numerical Model

- **Integrator:** **Classical explicit fourth-order Runge-Kutta (RK4)**.
- **Symplecticity Notice:** Classical explicit RK4 is **not a symplectic integrator**. It exhibits standard $\mathcal{O}(h^4)$ global numerical energy dissipation that decreases systematically with smaller timesteps ($32\times$ error reduction per halving of $h$).
- **Loss Quadrature:** Instantaneous dissipation rates are integrated using 4th-order Simpson quadrature weights $(1/6, 2/6, 2/6, 1/6)$ matching the intermediate RK4 stages.

---

## 10. Historical / Phenomenological Model

The simulator retains the original phenomenological engine under the "Historical / Phenomenological" mode toggle. This mode preserves:
- The historical concept of "Earth grip" and regenerative loop gain.
- Non-conservative feedback channels (`earthGrip`, `regenerativeGain`, `loopGain`).
- Interactive resonance animations and historical Pierce-Arrow parameters.

> **Notice:** The Historical Mode is provided strictly for educational comparison. It is not an energy-conserving model and must not be interpreted as physically validated.

---

## 11. Current Verification Status

| Area | Status | Notes |
| :--- | :--- | :--- |
| **Conservative Engine Unit Tests** | **18/18 Passed** | Validates positive definiteness, LC ringdown, spark quench, and RK4 convergence |
| **Playwright Browser Smoke Tests** | **14/14 Passed** | Verifies UI controls, mode switching, ledger panel, and SVG renderings |
| **TypeScript Typecheck** | **Passed (0 errors)** | `npm run typecheck` (`tsc --noEmit`) clean |
| **Production Build** | **Passed** | `npm run build` generates client bundle and Nitro SSR server |
| **Global Application Test Suite** | **195 Passed / 2 Failed** | 2 failures are pre-existing template SVG card tests in `grok-pwa-plugin.test.mjs` |
| **Inductance Positive Definiteness** | **Verified Mathematically** | Sylvester condition $k^2 + k_m^2 < 1$ enforced |
| **Motor Power Transduction** | **Verified Mathematically** | $P_{\text{em\_elec}} \equiv P_{\text{em\_mech}} = K_t \omega i_{\text{motor}}$ |
| **Spark Quench Continuity** | **Verified Computationally** | Balance error $0.0\,\text{J}$ across quench transition |
| **Environmental Power Delivery** | **Verified Computationally** | Ambient harvesting into HV bus is $0.000\,\text{W}$ |
| **Hardware Validation** | **Not Performed** | Model parameters are analytical/theoretical estimates |

---

## 12. Physical Validation Status

The Quiver Lab simulator is computationally and mathematically verified within its implemented equations. However:

- It is **NOT** an experimental validation of atmospheric energy harvesting.
- It is **NOT** an experimental validation of Earth resonance wireless power transmission.
- It is **NOT** an experimental validation of Schumann resonance vehicle propulsion.
- It does **NOT** validate historical claims of a fuel-free 1931 Pierce-Arrow automobile.
- It does **NOT** demonstrate or support over-unity or "free energy" generation.

All environmental source numbers represent theoretical upper bounds derived from fair-weather geoelectric literature.

---

## 13. Historical Context

In 1899 at Colorado Springs and 1901 at Wardenclyffe, Nikola Tesla investigated high-frequency electrical resonance, quarter-wave extra coils, and ground conduction phenomena.

Accounts published decades later alleging that Tesla demonstrated an 80-horsepower electric Pierce-Arrow automobile powered by ambient energy in Buffalo, New York (1931) remain historically unverified and lack contemporaneous engineering documentation. Quiver Lab evaluates the physical plausibility of such concepts using modern electrodynamics and circuit theory.

---

## 14. Limitations

1. **Lumped-Element Approximation:** Helical extra coils are modeled as lumped $L_e$-$C_e$-$R_e$ resonators rather than distributed transmission lines with non-uniform velocity factors.
2. **Simplified Arc Kinetics:** Spark discharges use an empirical Cassie-Mayr resistance rather than dynamic plasma ionization equations.
3. **Idealized Thevenin Sources:** Atmospheric and telluric coupling assume uniform planar fields rather than three-dimensional turbulent boundary layers.
4. **Earth Contact Modeling:** Ground resistance ($R_{\text{ground}} = 8\,\Omega$) assumes a galvanic ground contact; standard rubber automobile tires provide $> 10^{10}\,\Omega$ insulation.
5. **Classical RK4 Integration:** Standard explicit RK4 exhibits slight numerical damping over long runtimes.
6. **No Physical Hardware Measurements:** Coil Q factors, coupling coefficients, and field strengths have not been measured on physical apparatus.

---

## 15. Project Structure

```text
src/
├── components/
│   ├── lab/                   # Lab UI (Controls, Telemetry, Scope, Ledger, Schematic)
│   └── ui/                    # Base UI components (Radix slider, button)
├── lib/
│   ├── engine/
│   │   ├── conservative-engine.ts   # 7-state RK4 conservative physics solver
│   │   ├── conservative-types.ts    # Types for state vectors, ledger reports, sources
│   │   ├── conservative-sources.ts  # Thevenin ambient source models
│   │   ├── conservative-ledger.ts   # First Law energy auditor
│   │   ├── conservative-tests.ts    # 18 automated unit tests
│   │   ├── legacy-engine.ts         # Historical phenomenological engine
│   │   ├── presets.ts               # Archetype parameters (Colorado, Car 1931, etc.)
│   │   └── release-verification.ts  # Application-level verification runner
│   └── lab-store.ts                 # Zustand store managing dual-mode simulation state
├── routes/                    # TanStack Start routing (__root.tsx, index.tsx)
└── router.tsx                 # Client router configuration
scripts/
├── smoke-test-quiver.mjs      # Playwright browser smoke verification script
├── with-app-env.mjs           # Environment wrapper for Vite
└── migrate.mjs                # Database migration runner
migrations/                    # SQL migrations
public/                        # Static assets (favicons, PWA icons)
CONSERVATIVE_ENGINE.md         # Detailed mathematical specification of conservative engine
ARCHITECTURE_AUDIT.md          # Architectural audit and system boundaries
FINDINGS.md                    # Research findings and theoretical audit
```

---

## 16. Running the Project

### Prerequisites
- Node.js 22+
- npm

### Installation
```bash
npm install
```

### Development Server
Starts the local dev server on `http://0.0.0.0:8080/`:
```bash
npm run dev
```

### Production Build
Builds client assets and Nitro server:
```bash
npm run build
```

---

## 17. Testing

### Run All Unit & Application Tests
```bash
npm test
```

### Run Conservative Engine Test Suite
Runs the 18 automated physics and energy conservation unit tests:
```bash
node --experimental-strip-types --test src/lib/engine/conservative-tests.ts
```

### TypeScript Static Analysis
```bash
npm run typecheck
```

### Automated Browser Smoke Test
Runs Playwright headless browser QA verifying UI rendering and telemetry:
```bash
node scripts/smoke-test-quiver.mjs
```

---

## 18. Scientific Interpretation

A primary goal of Quiver Lab is to illustrate the distinction between:

$$\textbf{Mathematical Consistency} \quad \neq \quad \textbf{Physical Reality}$$

A computer simulation can achieve exact First Law energy conservation ($\Delta E_{\text{residual}} = 0.000\,\text{J}$) while operating on simplified assumptions or unverified parameters. Mathematical consistency confirms that the implemented equations do not violate conservation laws; it does not prove that those equations accurately capture complex real-world physical environments.

---

## 19. Roadmap

- [ ] **Distributed Transmission Line Model:** Replace lumped $L_e$-$C_e$ with distributed telegrapher equations for non-uniform helical coils.
- [ ] **Symplectic Integration:** Implement a symplectic Störmer-Verlet or Gauss-Legendre integrator for exact Hamiltonian preservation in lossless limits.
- [ ] **Empirical Plasma Kinetics:** Incorporate dynamic electron density and temperature equations for spark breakdown and arc recovery.
- [ ] **Laboratory Validation Protocols:** Develop standardized test procedures for comparing simulation telemetry against physical oscilloscope and current-probe measurements.
- [ ] **Measured Source Spectra:** Import real-world Schumann resonance spectra and ambient RF flux measurements from calibrated monitoring stations.

---

## 20. Disclaimer

> **Quiver Lab is an educational and research simulation tool.**
> Environmental source parameters are analytical estimates, and hardware validation has not been performed. The project does not establish over-unity energy generation, "free energy," or historical claims regarding fuel-free automobiles. All physical findings must be verified through reproducible laboratory instrumentation.

---

## 21. License

License: Not yet specified.
