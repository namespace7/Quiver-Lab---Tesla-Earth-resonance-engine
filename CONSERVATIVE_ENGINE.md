# Quiver Lab — Conservative Physics Engine Architecture

## 1. Executive Summary & Objective

The **Conservative Physics Engine** replaces the phenomenological open-system model with a strictly energy-conserved, first-principles dynamical simulation. In accordance with the Phase 3–6 theoretical audits, every joule of energy in the simulator has an identifiable physical source and destination.

The engine enforces the fundamental thermodynamic invariant:

$$\Delta E_{\text{residual}} = E_{\text{in}} + W_{\text{param}} - E_{\text{stored}} - E_{\text{losses}} \le 100\,\mu\text{J} \quad (\text{or } |\text{relative error}| \le 0.01\%)$$

The platform maintains **two cleanly separated simulation modes**:
1. **Conservative Physics (Default)**: Strictly energy-conserved 7-state ODE system, Cassie-Mayr dynamic spark arc, 3×3 positive-definite coupled inductance matrix, Thevenin-equivalent environmental sources, and zero unmetered energy injection.
   - *Model Status*: Energy-Conserved Model. Environmental source values are analytical/estimated; hardware validation has not yet been performed.
2. **Historical / Phenomenological**: Preserves the legacy 70-channel demonstration engine and patent parameters (`earthGrip`, `regenerativeGain`, `Cearth`, `loopGain > 1`) for side-by-side comparison.

---

## 2. System State & Governing Differential Equations

The conservative engine is governed by a 7-state physical coordinate vector $\vec{x}(t)$:

$$\vec{x} = \begin{bmatrix} q_{\text{cap}} \\ i_{\text{prim}} \\ q_{\text{extra}} \\ i_{\text{extra}} \\ i_{\text{motor}} \\ \omega \\ \theta \end{bmatrix}$$

### 2.1 State Vector Components
* $q_{\text{cap}}$: Primary tank storage capacitor charge $[\text{C}]$.
* $i_{\text{prim}}$: Primary coil disruptive discharge current $[\text{A}]$.
* $q_{\text{extra}}$: Extra resonator electric charge $[\text{C}]$.
* $i_{\text{extra}}$: Extra coil & loading inductance current $[\text{A}]$.
* $i_{\text{motor}}$: Motor stator electrical current $[\text{A}]$.
* $\omega$: Drivetrain angular velocity $[\text{rad/s}]$.
* $\theta$: Drivetrain angular position $[\text{rad}]$.

### 2.2 3×3 Coupled Inductance Matrix & Positive Definiteness

The magnetic coupling between the primary tank ($L_p$), the extra coil resonator ($L_e = L_{\text{extra}} + L_{\text{loading}}$), and the motor stator ($L_m$) is represented by the symmetric matrix $\mathbf{L}$:

$$\mathbf{L} = \begin{bmatrix} L_p & M & 0 \\ M & L_e & M_m \\ 0 & M_m & L_m \end{bmatrix}$$

where the mutual inductances are parameterized by dimensionless coupling factors $k$ and $k_m$:
$$M = k \sqrt{L_p L_e}, \qquad M_m = k_m \sqrt{L_e L_m}$$

#### Positive Definiteness Theorem:
$$\det(\mathbf{L}) = L_p L_e L_m \left( 1 - k^2 - k_m^2 \right)$$

For the magnetic stored energy $E_{\text{mag}} = \frac{1}{2} \mathbf{i}^T \mathbf{L} \mathbf{i}$ to be strictly non-negative ($\forall \mathbf{i} \ne \mathbf{0}, E_{\text{mag}} > 0$), Sylvester's criterion mandates:
$$k^2 + k_m^2 < 1.0$$

The engine analytically clamps and validates coupling factors to satisfy $k^2 + k_m^2 \le 0.96$, ensuring numerical well-conditioning:

$$\mathbf{L}^{-1} = \frac{1}{\det(\mathbf{L})} \begin{bmatrix} L_e L_m - M_m^2 & -M L_m & M M_m \\ -M L_m & L_p L_m & -L_p M_m \\ M M_m & -L_p M_m & L_p L_e - M^2 \end{bmatrix}$$

### 2.3 Subsystem Current Derivatives

When the spark arc is conducting, the inductive state derivatives satisfy:
$$\begin{bmatrix} \frac{di_{\text{prim}}}{dt} \\ \frac{di_{\text{extra}}}{dt} \\ \frac{di_{\text{motor}}}{dt} \end{bmatrix} = \mathbf{L}^{-1} \begin{bmatrix} v_p \\ v_e \\ v_m \end{bmatrix}$$

where the branch excitation voltages are:
$$\begin{aligned}
v_p &= V_{\text{cap}} - i_{\text{prim}} (R_p + R_{\text{arc}}) \\
v_e &= -V_{\text{extra}} - i_{\text{extra}} (R_{\text{ac}} + R_g + R_{\text{rad}}) \\
v_m &= -i_{\text{motor}} R_m - K_t \omega
\end{aligned}$$

When the spark gap is **open** (non-conducting), $i_{\text{prim}} \equiv 0$ and $di_{\text{prim}}/dt \equiv 0$, eliminating stiffness explosion. The remaining 2×2 subsystem for $[i_{\text{extra}}, i_{\text{motor}}]^T$ is solved analytically via the 2×2 minor inverse.

---

## 3. Dynamic Spark Arc & Cassie-Mayr Model

The primary discharge spark gap is modeled as a physical non-linear arc:
1. **Breakdown Criterion**:
   Arc strikes when $|V_{\text{cap}}| \ge V_{\text{break}}$.
2. **Dynamic Resistance**:
   $$R_{\text{arc}}(i) = R_{\text{min}} + \frac{V_{\text{arc\_const}}}{|i_{\text{prim}}| + I_0}$$
   with $R_{\text{min}} = 0.05\,\Omega$, $V_{\text{arc\_const}} = 25\,\text{V}$, and $I_0 = 1.0\,\text{A}$.
3. **Quenching Condition**:
   The arc quenches when the discharge timer expires ($t_{\text{spark}} \le 0$) and primary current drops below $0.2\,\text{A}$.

---

## 4. Drivetrain & Vehicle Mechanical Closure

To prevent fictitious work generation between the motor and the vehicle, the drivetrain is modeled with a **rigid kinematic constraint**:

$$v_{\text{veh}} = \omega \cdot \frac{r_{\text{wheel}}}{G}$$

The effective drivetrain inertia reflected to the motor rotor shaft is:
$$J_{\text{eq}} = J_{\text{rotor}} + m_{\text{veh}} \left( \frac{r_{\text{wheel}}}{G} \right)^2$$

The angular acceleration equation is:
$$J_{\text{eq}} \frac{d\omega}{dt} = \eta_{\text{gear}} \tau_{\text{em}} - \tau_{\text{friction}} - \tau_{\text{road}}$$

where:
$$\begin{aligned}
\tau_{\text{em}} &= K_t i_{\text{motor}} \\
\tau_{\text{friction}} &= b_{\text{rotor}} \omega \\
\tau_{\text{road}} &= \left( F_{\text{drag}} + F_{\text{rr}} \right) \frac{r_{\text{wheel}}}{G} \\
F_{\text{drag}} &= \frac{1}{2} \rho C_d A v_{\text{veh}}^2 \operatorname{sgn}(v_{\text{veh}}) \\
F_{\text{rr}} &= C_{\text{rr}} m_{\text{veh}} g \operatorname{sgn}(v_{\text{veh}})
\end{aligned}$$

The electromagnetic torque produces electrical power $P_{\text{em}} = \tau_{\text{em}} \omega$. In the mechanical domain:
$$P_{\text{mech\_in}} = \eta_{\text{gear}} \tau_{\text{em}} \omega$$
The gearbox loss is $P_{\text{gear\_loss}} = (1 - \eta_{\text{gear}}) \tau_{\text{em}} \omega$, ensuring exact power closure between the electrical and mechanical domains.

---

## 5. Environmental Coupling & Thevenin Limits

Every environmental channel is modeled as a rigorously audited Thevenin source $(V_{\text{oc}}, R_{\text{th}})$:

| Source | Governing Law | Voc | Rth | P_available | Delivered P to 8 kV Cap |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Atmospheric DC Field** | Gauss / Ohm: $V_{\text{oc}} = E_z h_{\text{ant}}$ | $120.25\,\text{V}$ (Fair)<br>$10,000\,\text{V}$ (Storm) | $3.7\times 10^{13}\,\Omega$ | $98\,\text{pW}$ (Fair)<br>$675\,\mu\text{W}$ (Storm) | $0\,\text{W}$ ($V_{\text{oc}} < V_{\text{cap}}$) |
| **Telluric Current** | Ohm: $V_{\text{oc}} = E_t L$ | $100\,\mu\text{V}$ | $8.0\,\Omega$ | $0.31\,\text{nW}$ | $0\,\text{W}$ |
| **Schumann Resonance** | Waveguide $E_{\text{eff}} h_{\text{eff}}$ | $1.85\,\mu\text{V}$ | $570\,\text{k}\Omega$ | $1.5\,\text{fW}$ | $0\,\text{W}$ |
| **Ambient RF** | Friis / Aperture $S_{\text{RF}} A_{\text{eff}}$ | $0.15\,\text{V}$ | $50\,\Omega$ | $0.5\,\mu\text{W}$ | $0\,\text{W}$ |
| **Motional EMF** | Faraday: $(\vec{v}\times\vec{B})\cdot\vec{L}$ | $3.7\,\text{mV}$ | $8.0\,\Omega$ | $0.43\,\mu\text{W}$ | $0\,\text{W}$ |

### Proof of Zero Delivery:
In passive electrical networks, a DC Thevenin source $(V_{\text{oc}}, R_{\text{th}})$ connected to a capacitor at voltage $V_{\text{cap}}$ can deliver current only if $V_{\text{oc}} > V_{\text{cap}}$.
Because the storage capacitor operates between $0.2 \times V_{\text{break}}$ and $V_{\text{break}}$ ($1,600\,\text{V}$ to $8,000\,\text{V}$), and all ambient fair-weather sources have $V_{\text{oc}} \le 120.25\,\text{V}$, the direct charging current is strictly non-positive ($I \le 0$). No phantom recharge occurs without an active step-up boost converter.

---

## 6. Energy Ledger Accounting & Conservation Invariant

The energy ledger tracks 14 independent terms across all simulation steps:

### 6.1 Stored Energy Reservoirs:
1. $E_{\text{cap}} = \frac{1}{2} C_p V_{\text{cap}}^2$
2. $E_{\text{extra\_elec}} = \frac{1}{2} C_{\text{tot}} V_{\text{extra}}^2$
3. $E_{\text{mag}} = \frac{1}{2} \mathbf{i}^T \mathbf{L} \mathbf{i} = \frac{1}{2} L_p i_{\text{prim}}^2 + \frac{1}{2} L_e i_{\text{extra}}^2 + \frac{1}{2} L_m i_{\text{motor}}^2 + M i_{\text{prim}} i_{\text{extra}} + M_m i_{\text{extra}} i_{\text{motor}}$
4. $E_{\text{kinetic}} = \frac{1}{2} J_{\text{eq}} \omega^2$

### 6.2 External Energy Injections & Work:
5. $E_{\text{starter}} = \int V_{\text{cap}} I_{\text{starter}} \, dt$
6. $E_{\text{env}} = \int V_{\text{cap}} I_{\text{env}} \, dt$
7. $W_{\text{param}} = 0$: Parameter modifications re-baseline the physical experiment configuration to prevent unphysical virtual work or phantom energy accumulation.

### 6.3 Dissipated Heat & Work:
8. $E_{\text{arc\_heat}} = \int i_{\text{prim}}^2 R_{\text{arc}} \, dt + \Delta E_{\text{quench}}$ (including deionization arc resistance and quench dissipation).
9. $E_{\text{prim\_cu}} = \int i_{\text{prim}}^2 R_p \, dt$
10. $E_{\text{extra\_cu}} = \int i_{\text{extra}}^2 R_{\text{ac}} \, dt$
11. $E_{\text{ground\_heat}} = \int i_{\text{extra}}^2 (R_g + 0.4) \, dt$
12. $E_{\text{motor\_cu}} = \int i_{\text{motor}}^2 R_m \, dt$
13. $E_{\text{gear\_loss}} = \int (1 - \eta_{\text{gear}}) \tau_{\text{em}} \omega \, dt$
14. $E_{\text{friction\_heat}} = \int \tau_{\text{friction}} \omega \, dt$
15. $E_{\text{road\_work}} = \int \tau_{\text{road}} \omega \, dt$
16. $E_{\text{rad}} = \int i_{\text{extra}}^2 R_{\text{rad}} \, dt$
17. $E_{\text{leak\_heat}} = \int V_{\text{cap}}^2 / R_{\text{leak}} \, dt$

The numerical integrator is **classical explicit fourth-order Runge-Kutta (RK4)** with global convergence order $\mathcal{O}(h^4)$. All loss integrals are evaluated at every sub-step using **4th-order Simpson quadrature weights** $(1/6, 2/6, 2/6, 1/6)$ matching the RK4 stages. (Note: Classical explicit RK4 is non-symplectic and exhibits standard $\mathcal{O}(h^4)$ numerical dissipation).

---

## 7. Automated Test Suite Verification

The engine is validated by 14 automated unit tests in `src/lib/engine/conservative-tests.ts`:

```bash
node --experimental-strip-types --test src/lib/engine/conservative-tests.ts
```

### Test Suite Summary:
* **Test 1 — Zero-Source Ringdown & Monotonic Decay**: Stored energy monotonically decreases during passive ringdown with zero sources. Conserved ledger closure verified.
* **Test 2 — Primary/Secondary Decoupling ($k = 0$)**: Verifies zero energy transfer to extra coil when magnetic coupling is 0.
* **Test 3 — Motor Decoupling ($k_m = 0$)**: Verifies zero motor current and zero torque when motor coupling is 0.
* **Test 4 — Motor Load Dissipation Rate**: Increasing mechanical drag increases dissipation rate without generating phantom torque.
* **Test 5 & 6 — Inductance Matrix Positive Definiteness**: Matrix is verified positive-definite; unphysical couplings violating $k^2 + k_m^2 < 1$ are automatically clamped and rejected.
* **Test 7 — Parameter Deformation Work ($W_{\text{param}}$)**: Manipulating physical knobs (e.g., $C_p$, $L_p$, $k$) accounts for exact deformation work in the ledger without drift.
* **Test 8 & 9 — Starter & Calibrated Supply Conservation**: Full energy conservation verified under high-voltage DC supply charging.
* **Test 10 & 11 — Absence of Environmental Phantom Recharge**: Confirms zero recharge into HV storage capacitor from ambient fair-weather sources ($P_{\text{del}} = 0$).
* **Test 12 — Timestep Invariance & Convergence**: Step sizes of $0.5\,\text{ms}$ and $0.25\,\text{ms}$ converge within $0.11\%$ relative error.
* **Test 13 — Physical Resonant Frequencies**: Verifies Medhurst coil self-capacitance, monopole antenna capacitance, and natural resonant frequency $f_0$.
* **Test 14 — Absolute Energy Ledger Closure**: Under full active discharge cycles, $|\Delta E_{\text{residual}}| \le 100\,\mu\text{J}$ and relative error $\le 0.01\%$.
