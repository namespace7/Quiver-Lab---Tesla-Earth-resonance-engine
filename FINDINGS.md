# Quiver Lab — Implementation Findings

Reconstructed PoC for a Tesla Earth-resonance engine. Public patents and the
Colorado Springs diary were never destroyed. This file is the working paper the
simulator is built from. Channel names in **bold** match the live telemetry.

---

## 1. The claim that the information was lost

Tesla died 7 January 1943. The Office of Alien Property inventoried his trunks.
The FBI later stated it did not keep a “death ray” file. That custody story is
not the same as the circuit disappearing.

What was always public:

| Document | Date | What it specifies |
| --- | --- | --- |
| US 381,968 | 1888 | Rotating magnetic field — the motor |
| US 462,418 | 1891 | Condenser → disruptive discharge → oscillation |
| US 645,576 / 649,621 | 1900 | Wireless energy through natural media |
| US 685,957 / 685,958 | 1901 | Radiant-energy plate, condenser, dump |
| US 787,412 | 1905 | Extra coil, loose coupling, λ/4, magnification ∝ L·f / R |
| US 1,119,732 | 1914 | Wardenclyffe apparatus: extra coil B, cylinder B′, terminal D, ground E |
| Colorado Springs Notes | 1899–1900 | Measured C, L, turns, spark, **pL/R** |
| “The Problem of Increasing Human Energy” | 1900 | Open-system energy, “wheelwork of nature” |

Greed (unmetered power, Wardenclyffe funding collapse, 1917 demolition) stopped
*deployment*. It did not erase Maxwell, Faraday, or the patents. Information
cannot be destroyed once it has been published. This lab puts that paper back
on the bench.

The 1931 Pierce-Arrow “black box” is folklore (no contemporary hardware record).
Its *architecture* still maps onto the receiver half of US 787,412 plus US 381,968.

---

## 2. What the engine actually is

Earth’s magnetic field is not a 1 T stator. Static **F = I L × B** at 50 µT is
useless at car scale (see **F_lorentz_N**).

Tesla’s method is different:

1. Charge a condenser (**E_cap_J**, **V_cap_V**).
2. Let it go *unstable* — spark gap as negative resistance (**sparkState**).
3. Dump into a high-Q extra coil, loosely coupled (**k_coupling**, **Q_eff**).
4. Magnify *voltage*: **magnification ≈ p L / R** (US 787,412; diary).
5. One terminal in the Earth, one elevated (**earthGrip**, **antenna_h_m**).
6. Hold the loop at the edge of regeneration (**loopGain**).
7. Rectify the pulse train into the rotating-field motor (**torque_Nm**).

The planet is the reservoir. The spark is the valve. Q is the lever.
**loopGain > 1** is the unstable situation that powers the engine.

This does not invent joules. Voltage magnification is real. Power still comes
from an open reservoir: motional EMF in **B_nT**, atmospheric **E_atm_Vm**,
cavity coupling, radiant accumulation, and whatever the starter injects.

---

## 3. Colorado Springs numbers (diary, not folklore)

Extra coil, 14 December 1899 (latest type):

- Frame 8 ft 3 in diameter, 8 ft long
- 100 turns, wire No. 6 AWG
- Wire length in the excited system ≈ 2660 ft ≈ λ/4 of the impressed wave
- Tesla states coil resistance “at 1 ohm (in reality a little less)”
- Primary C in one test: 0.081 µF; L including reaction ≈ 51,000 cm = 51 µH
- Another dump into ground: C = 0.0486 µF, L ≈ 60,000 cm, n ≈ 93,110 Hz
- Magnifying factor written as **p L / R** with p ≈ 585,000

Solenoid check used in this sim:

```
L = μ0 N² π r² / h
r = 1.257 m, h = 2.438 m, N = 100  →  L_extra ≈ 25.6 mH
R_dc ≈ ρ ℓ / A  (No. 6, 811 m)     →  ≈ 1.0 Ω
```

Skin effect at ~100 kHz raises R. Ground resistance (**ground_R_ohm**) dominates
Q on a vehicle. Tesla’s instruction — “the ground should be made with great
care” — is the highest-leverage debug knob on a car.

---

## 4. Two frequencies (do not mix them)

| Mode | Frequency | What resonates | Channel |
| --- | --- | --- | --- |
| Coil | tens of kHz | Extra coil + top capacity | **f0_Hz** |
| Tesla Earth | ~11.8 Hz (his published figure) | Globe as conductor, standing waves | **f_tesla_Hz** |
| Schumann | 7.83 Hz | Earth–ionosphere cavity (named 1952) | **f_schumann_Hz** |

A car-scale extra coil cannot sit at 7.83 Hz unless Earth itself supplies the
capacitance. That is why **mode = earth** adds **C_earth_F ∝ earthGrip**.
**detune** is (f0 − f_target) / f_target. **resonanceLock** is |detune| < 1/Q.

Tesla’s 11.8 Hz and Schumann’s 7.83 Hz differ by ~π/2 in his propagation
assumption. The lab exposes both. Do not claim he “discovered Schumann.”

---

## 5. Instability (the power valve)

Spark gap: when **V_cap_V ≥ V_break_V**, the gap becomes a negative resistance.
Energy **E_dump_J = ½ C_primary V_break²** transfers (minus **eta_spark**) into
the extra coil. The coil rings:

```
V_x(t) = V_peak · exp(−ω t / 2Q) · sin(ω t)
V_peak from energy: sqrt(2 E_coil / C_top)   (conservation)
Q sets how long it rings, not how much energy appears
```

Loop gain, one cycle:

```
E_ambient = P_in · T_cycle
E_feedback = eta_regen · regenGain · E_dump · lockFactor
loopGain = (E_feedback + E_ambient) / E_dump
```

| loopGain | stability | meaning |
| --- | --- | --- |
| < 0.95 | damped | Needs starter. Honest ambient is here. |
| 0.95–1.05 | marginal | The R&D edge. Hold here. |
| > 1.05 | unstable | Oscillation grows. Tesla’s claimed operating point. |

**earthGrip** is the phenomenological “grip so the globe can quiver”
(Wardenclyffe shaft and pipes). It is the parameter greed would have you
believe was in a missing trunk. It is a coupling coefficient, not a miracle.
Sweep it. Watch **loopGain** cross 1. That crossing fires **LOOP_GAIN_CROSS**.

---

## 6. Ambient terms (open system)

```
V_motion = B_h · antenna_L · v          motional EMF
P_motion = V_motion² / R_load · η
P_atm    = E_atm · h · I_corona          atmospheric electricity
P_cavity = earthGrip · u_cavity · Vol    ULF / cavity
P_radiant = α · area                     US 685,957 accumulator
P_in = P_motion + P_atm + P_cavity + P_radiant + P_starter
```

At highway speed, **V_motion_V** is millivolts. Fair-weather **E_atm_Vm** is
~130 V/m; current density is picoamperes per m². Honest **P_in_W** is tiny.
Tesla’s claim is not that B is strong. It is that a high-Q Earth-coupled
resonator can *open a path* into a planetary reservoir the way a spark opens
a path into a charged cloud.

If **P_in** stays at ambient-physics levels, **loopGain** stays < 1 unless
**earthGrip** and **regenGain** are raised into Tesla’s claimed regime.
That is the experiment. The data table is the notebook.

---

## 7. Motor

US 381,968. Polyphase induction. Torque ∝ flux × current × sin θ.
This sim feeds rectified extra-coil current (**I_motor_A**) into that machine.
**P_mech_W = torque_Nm · ω**. Surplus torque accelerates the vehicle
(**accel_ms2**, **speed_ms**). Load is **motorLoadNm**.

No gasoline. The motor is not the mystery. The mystery is whether the
resonant valve can keep **I_motor_A** alive without a fuel calorific input.

---

## 8. Vehicle as receiver (1931 packaging)

| Folklore box | Paper equivalent | Channel |
| --- | --- | --- |
| 6 ft aerial | Elevated terminal D | **antenna_h_m**, **antenna_L_m** |
| Chassis / wheels | Ground E, “grip” | **ground_R_ohm**, **earthGrip** |
| 12 vacuum tubes | Regenerative / spark-gap stand-in | **regenGain** |
| AC motor ~80 hp | US 381,968 | **torque_Nm**, **P_mech_W** |

Preset **Car receiver 1931** is this mapping, not a recovered schematic.

---

## 9. Debug callbacks (R&D)

Every transition emits an event with a full channel snapshot:

| Type | When |
| --- | --- |
| SPARK_DUMP | Gap fires, energy leaves C_primary |
| RESONANCE_LOCK / LOST | \|detune\| crosses 1/Q |
| LOOP_GAIN_CROSS | loopGain crosses 1.0 |
| SUSTAIN_ON / OFF | Unstable oscillation starts or dies |
| Q_COLLAPSE | Q_eff drops below 10 (ground / spark loss) |
| MOTOR_PULSE | Torque pulse from a dump |
| STARTER_ARM | Starter is injecting |
| GROUND_FAULT | ground_R too high to ring |
| BREAKDOWN_MISS | Charge stalled below V_break |

Break on any type. Compare snapshot vs live. Export the log. This is the
notebook Tesla kept in Colorado — except it is live.

---

## 10. How close the gap is

| Layer | Closed from papers? | In this sim |
| --- | --- | --- |
| Topology (C, spark, extra coil, Earth, sky, motor) | Yes | Yes |
| Colorado Springs L, C, N, R, pL/R | Yes | Preset |
| Voltage magnification vs energy conservation | Yes, distinguished | **magnification** vs **E_dump_J** |
| Car-scale λ/4 at 8 Hz | No compact hardware | Earth mode + grip |
| 1931 tube box schematic | Never public | Regenerative gain only |
| Self-sustaining ambient power at car scale | Unproven | Sweep **earthGrip** until **loopGain > 1** |

The remaining gap is not a missing PDF. It is whether a physical **earthGrip**
and ground system can be built such that **loopGain** crosses unity on ambient
**P_in** alone. Prototype that in this sandbox first. Then take the same
channels to hardware.

---

## 11. Suggested R&D sequence

1. Load **Colorado Springs 1899**. Run. Confirm spark rate and Q against diary.
2. Switch to **Car receiver 1931**. Watch **P_in_W** collapse. Note **loopGain**.
3. Raise **earthGrip** and lower **ground_R_ohm** until **LOOP_GAIN_CROSS**.
4. Turn starter off. If **SUSTAIN_ON** holds, you are in the unstable regime.
5. Detune **f0_Hz** off **f_tesla_Hz**. Confirm **RESONANCE_LOST** kills sustain.
6. Export the event log. That JSON is the callback paper for the next bench.

---

*Quiver Lab. Named from Tesla’s instruction for the Wardenclyffe shaft: to have
a grip on the earth so the whole of this globe can quiver.*
