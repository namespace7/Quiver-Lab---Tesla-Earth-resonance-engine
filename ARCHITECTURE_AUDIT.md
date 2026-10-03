# ARCHITECTURE AUDIT — Quiver Lab

## 1. System Overview

Quiver Lab is a browser-based Tesla-coil/Earth-resonance simulation built on the
Grok App Builder scaffold (TanStack Start + React 19 + Zustand + Vite). It models
a system loosely based on Tesla's published patents: a capacitor charged by
ambient/starter power, discharged through a spark gap into a high-Q extra coil,
with a regenerative feedback path and an AC motor output.

---

## 2. File Inventory

### Engine Core (`src/lib/engine/`)

| File | Lines | Role |
|------|-------|------|
| `engine.ts` | 499 | Physics simulation: `Engine` class with `step(dt)`, `telemetry()`, `derived()` |
| `types.ts` | 157 | TypeScript types: `EngineParams`, `Telemetry`, `EngineEvent`, `WaveSample` |
| `presets.ts` | 135 | Four presets: `colorado`, `wardenclyffe`, `car1931`, `honest` |
| `channels.ts` | 1 | **BROKEN** — 15 bytes, contains only fragment `run: "Clock",` |
| `findings.md` | 238 | Embedded research document (rendered in FindingsPanel) |

### State Management (`src/lib/`)

| File | Lines | Role |
|------|-------|------|
| `lab-store.ts` | 134 | Zustand store: wraps Engine, manages UI state, simulation loop interface |

### UI Components (`src/components/lab/`)

| File | Lines | Role |
|------|-------|------|
| `lab-app.tsx` | 150 | Root app: header, rAF loop, tab navigation |
| `controls-panel.tsx` | 119 | Sliders for 12 parameters + preset/mode/starter/weather buttons |
| `stability-card.tsx` | 61 | Summary card: loopGain, Q, f0, P_in, P_mech, dumps, lock |
| `telemetry-table.tsx` | 107 | Full channel table with live/snapshot comparison (imports broken `CHANNELS`) |
| `scope.tsx` | 119 | SVG oscilloscope: dump waveform + loop-gain strip chart |
| `schematic.tsx` | 137 | SVG circuit diagram: capacitor, spark gap, extra coil, antenna, motor, Earth |
| `event-log.tsx` | 95 | Event list with breakpoints and JSON export (imports broken `ALL_EVENT_TYPES`) |
| `papers-panel.tsx` | 75 | Static list of 8 Tesla patents/documents |
| `findings-panel.tsx` | 186 | Renders `findings.md` as React components |

### Routes

| File | Role |
|------|------|
| `src/routes/index.tsx` | Mounts `<LabApp />` |
| `src/routes/__root.tsx` | Document shell with AuthProvider and PreviewHostBridge |

---

## 3. Critical Build Blocker

**`channels.ts` is truncated/corrupt.** It should export:
- `CHANNELS: ChannelDef[]` — array of channel definitions mapping telemetry keys
  to labels/units/formulas
- `GROUP_LABEL: Record<ChannelGroup, string>` — human-readable group names
- `ALL_EVENT_TYPES: EventType[]` — array of all 11 event type strings
- `EVENT_META: Record<EventType, { hint: string }>` — tooltips for each event type

These are imported by:
- `telemetry-table.tsx` (line 1): `CHANNELS`, `GROUP_LABEL`
- `event-log.tsx` (line 1): `ALL_EVENT_TYPES`, `EVENT_META`
- `lab-store.ts` (line 2): `ALL_EVENT_TYPES`

**The project cannot compile or run without restoring this file.**

---

## 4. Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER CONTROLS                            │
│  controls-panel.tsx: 12 sliders + preset/mode/starter/weather   │
│                         │                                       │
│                         ▼                                       │
│              useLab.patchParams(patch)                          │
│              useLab.loadPreset(id)                              │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                     ZUSTAND STORE (lab-store.ts)                │
│  engine: Engine instance (singleton)                            │
│  params: EngineParams (shallow copy)                            │
│  running: boolean → triggers rAF loop in lab-app.tsx            │
│  advance(dt): calls engine.step(dt), checks breakpoints        │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                    ENGINE (engine.ts)                            │
│                                                                 │
│  1. derived()  →  L, C, R, f0, Q, B, Eatm from params          │
│  2. telemetry()  →  P_motion, P_atm, P_cavity, P_radiant,      │
│                      P_starter, P_in, I_motor, torque, P_mech   │
│  3. step(dt):                                                   │
│     a. Accumulate eCap += P_in * dt                             │
│     b. Spark: if V_cap >= V_break, dump energy                  │
│     c. On dump: transfer to extra coil, compute loopGain,       │
│        inject eFb (feedback energy) back into capacitor         │
│     d. Decay extra coil: vExtra *= exp(-ωdt/2Q)                 │
│     e. Update motor: torque → omegaMotor, speed                 │
│     f. Emit events                                              │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                        UI RENDERING                             │
│                                                                 │
│  stability-card  ←  loopGain, Q, f0, P_in, P_mech              │
│  telemetry-table ←  all Telemetry fields (needs CHANNELS)       │
│  scope           ←  dumpWave[], engine.wave[], strip[]          │
│  schematic       ←  sparkState, vExtra, earthGrip, rpm          │
│  event-log       ←  engine.events[]                             │
└──────────────────────────────────────────────────────────────────┘
```

## 5. Simulation Architecture Map

```
INPUTS                         PHYSICAL MODEL            FEEDBACK
┌─────────────┐               ┌─────────────┐          ┌──────────┐
│ P_starter   │──┐            │ Capacitor   │          │ eFb =    │
│ P_motion    │  │  P_in      │ eCap (J)    │  Spark   │ ηr·g·E·  │
│ P_atm       │──┼───────────▶│ charges at  │─────────▶│ lock·    │
│ P_cavity    │  │            │ rate P_in   │  Dump    │ (0.35+   │
│ P_radiant   │──┘            │             │  E_dump  │  grip)   │
└─────────────┘               └──────┬──────┘          └────┬─────┘
                                     │                      │
                                     ▼                      │
                              ┌─────────────┐               │
                              │ Extra Coil  │               │
                              │ vExtra rings│               │
                              │ decays by Q │◄──────────────┘
                              └──────┬──────┘     (back into eCap)
                                     │
                                     ▼
                              ┌─────────────┐
                              │ Motor       │
                              │ I = |iX|·   │
                              │   0.08·k    │
                              │ τ = 0.42·I  │
                              │ P = τ·ω     │
                              └──────┬──────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │ Vehicle     │
                              │ F = τ/0.32  │
                              │ drag=0.35v² │
                              │ m = 1450 kg │
                              └─────────────┘
```

## 6. Key State Variables (Engine class)

| Variable | Type | Meaning |
|----------|------|---------|
| `t` | number | Simulation time (s) |
| `eCap` | number | Capacitor stored energy (J) |
| `vExtra` | number | Extra coil peak voltage envelope (V) |
| `iExtra` | number | Instantaneous extra coil current (A) |
| `iPrimary` | number | Primary circuit current (A) |
| `phase` | number | Ring-down oscillation phase (rad) |
| `omegaMotor` | number | Motor angular velocity (rad/s) |
| `speedMs` | number | Vehicle speed (m/s) |
| `loopGain` | number | Ratio of recovered-to-dumped energy per cycle |
| `sparkOn` | boolean | Whether spark gap is conducting |
| `sustain` | boolean | loopGain > 1.02 AND resonance locked |
| `locked` | boolean | f0 within 1/Q of target frequency |

## 7. Integration Method

Euler integration (first-order forward) with an analytical exponential decay
for the coil ring-down. The rAF loop in `lab-app.tsx` (lines 39–53) caps
wall-clock dt at 50 ms, then sub-divides into up to 12 sub-steps of <= 8 ms
simulation time each (multiplied by `timeScale` up to 20×).

The exponential decay `vExtra *= exp(-ωdt/2Q)` is analytically exact and
unconditionally stable. However, energy injection (eCap accumulation, feedback)
uses simple Euler addition, which can create energy-accounting errors at large
timesteps.

## 8. Physical Constants

| Name | Value | SI Units | Source | Correct? |
|------|-------|----------|--------|----------|
| `MU0` | 4π × 10⁻⁷ | H/m | Vacuum permeability | ✓ |
| `EPS0` | 8.854 × 10⁻¹² | F/m | Vacuum permittivity | ✓ |
| `RHO_CU` | 1.68 × 10⁻⁸ | Ω·m | Copper resistivity at 20°C | ✓ |
| `AWG6_M2` | 13.3 × 10⁻⁶ | m² | AWG 6 wire cross-section | ✓ (13.30 mm²) |
| `B0` | 3.12 × 10⁻⁵ | T | Earth dipole field at equator | ✓ (~31.2 µT) |
| `MASS_KG` | 1450 | kg | Vehicle mass | Reasonable for 1930s car |
| `F_SCHUMANN` | 7.83 | Hz | Schumann resonance fundamental | ✓ |
| `F_TESLA` | 11.78 | Hz | Tesla's published Earth frequency | Documented claim |

## 9. Preset Parameter Summary

| Preset | Mode | Starter (W) | earthGrip | regenGain | sparkV (V) | C_prim (F) | Turns | Load (Nm) |
|--------|------|-------------|-----------|-----------|------------|------------|-------|-----------|
| Colorado Springs | coil | 400 | 0.28 | 0.55 | 20,000 | 81 nF | 100 | 40 |
| Wardenclyffe | earth | 2000 | 0.85 | 0.70 | 50,000 | 120 nF | 140 | 80 |
| Car 1931 | earth | 120 | 0.32 | 0.80 | 8,000 | 22 nF | 420 | 18 |
| Honest ambient | earth | 80 | 0.02 | 0.10 | 20,000 | 81 nF | 200 | 12 |

---

*Audit performed by reading all source files without modification.*
