import { create } from "zustand";
import { ALL_EVENT_TYPES } from "./engine/channels.ts";
import { Engine } from "./engine/engine.ts";
import { ConservativeEngine } from "./engine/conservative-engine.ts";
import { DEFAULT_PARAMS, PRESETS, PRESET_CONSERVATIVE_PARAMS } from "./engine/presets.ts";
import type {
  ChannelGroup,
  EngineEvent,
  EngineParams,
  EventType,
  PresetId,
  Telemetry,
  WaveSample,
} from "./engine/types.ts";
import type {
  ConservativeParams,
  ConservativeTelemetry,
  SimulationMode,
} from "./engine/conservative-types.ts";

type Tab = "data" | "log" | "papers" | "findings" | "ledger";

export const DEFAULT_CONSERVATIVE_PARAMS: ConservativeParams = {
  primaryCapacitanceF: 22e-9,
  sparkVoltageV: 8000,
  primaryInductanceH: 51e-6,
  primaryResistanceOhm: 0.2,

  extraCoilTurns: 420,
  extraCoilRadiusM: 0.18,
  extraCoilHeightM: 0.55,
  loadingCoilH: 0.8,
  groundResistanceOhm: 8.0,
  antennaHeightM: 1.85,
  couplingK: 0.18,

  motorInductanceH: 0.05,
  motorResistanceOhm: 2.5,
  motorCouplingKm: 0.15,
  torqueConstantKt: 0.42,
  rotorInertiaKgm2: 0.35,
  rotorFrictionNmS: 0.05,
  gearRatioG: 4.2,
  gearEfficiency: 0.95,
  wheelRadiusM: 0.32,
  vehicleMassKg: 1450,
  dragCoefficientCd: 0.35,
  frontalAreaM2: 2.2,
  rollingResistanceCrr: 0.015,

  starterOn: true,
  starterVoltageV: 10000,
  starterResistanceOhm: 1000,

  weather: "fair",
  latitude: 42.88,
  altitudeM: 180,
  speedMs: 0,
};

type LabState = {
  mode: SimulationMode;
  engine: Engine;
  conservativeEngine: ConservativeEngine;
  params: EngineParams;
  conservativeParams: ConservativeParams;
  live: Telemetry;
  conservativeLive: ConservativeTelemetry;
  events: EngineEvent[];
  running: boolean;
  timeScale: number;
  tab: Tab;
  group: ChannelGroup | "all";
  breakOn: Record<EventType, boolean>;
  selectedEventId: string | null;
  preset: PresetId;
  pausedBy: EventType | null;
  tick: number;
  setMode: (m: SimulationMode) => void;
  setRunning: (v: boolean) => void;
  setTimeScale: (v: number) => void;
  setTab: (t: Tab) => void;
  setGroup: (g: ChannelGroup | "all") => void;
  toggleBreak: (t: EventType) => void;
  selectEvent: (id: string | null) => void;
  patchParams: (p: Partial<EngineParams>) => void;
  patchConservativeParams: (p: Partial<ConservativeParams>) => void;
  loadPreset: (id: PresetId) => void;
  reset: () => void;
  stepOnce: () => EventType | null;
  advance: (dt: number) => EventType | null;
  selectedEvent: () => EngineEvent | null;
  dumpWave: () => WaveSample[];
  strip: () => { t: number; gain: number; vCap: number; pMech: number }[];
};

function emptyBreak(): Record<EventType, boolean> {
  return Object.fromEntries(ALL_EVENT_TYPES.map((t) => [t, false])) as Record<
    EventType,
    boolean
  >;
}

const engine = new Engine({ ...DEFAULT_PARAMS });
const conservativeEngine = new ConservativeEngine({ ...DEFAULT_CONSERVATIVE_PARAMS });

export const useLab = create<LabState>((set, get) => ({
  mode: "conservative",
  engine,
  conservativeEngine,
  params: engine.params,
  conservativeParams: conservativeEngine.params,
  live: engine.telemetry(),
  conservativeLive: conservativeEngine.telemetry(),
  events: [],
  running: false,
  timeScale: 1,
  tab: "data",
  group: "all",
  breakOn: emptyBreak(),
  selectedEventId: null,
  preset: "colorado",
  pausedBy: null,
  tick: 0,
  setMode: (mode) => set({ mode, tick: get().tick + 1 }),
  setRunning: (v) => set({ running: v, pausedBy: v ? null : get().pausedBy }),
  setTimeScale: (v) => set({ timeScale: v }),
  setTab: (tab) => set({ tab }),
  setGroup: (group) => set({ group }),
  toggleBreak: (t) =>
    set((s) => ({ breakOn: { ...s.breakOn, [t]: !s.breakOn[t] } })),
  selectEvent: (id) => set({ selectedEventId: id, tab: id ? "log" : get().tab }),
  patchParams: (p) => {
    const engine = get().engine;
    engine.setParams(p);
    set({
      params: { ...engine.params },
      live: engine.telemetry(),
      tick: get().tick + 1,
    });
  },
  patchConservativeParams: (p) => {
    const cEngine = get().conservativeEngine;
    cEngine.setParams(p);
    set({
      conservativeParams: { ...cEngine.params },
      conservativeLive: cEngine.telemetry(),
      live: cEngine.toLegacyTelemetry(),
      tick: get().tick + 1,
    });
  },
  loadPreset: (id) => {
    const engine = get().engine;
    const p = PRESETS[id].params;
    engine.reset(p);

    const cEngine = get().conservativeEngine;
    const cp = PRESET_CONSERVATIVE_PARAMS[id];
    cEngine.setParams({
      ...cp,
      extraCoilTurns: p.extraCoilTurns,
      extraCoilRadiusM: p.extraCoilRadiusM,
      extraCoilHeightM: p.extraCoilHeightM,
      loadingCoilH: p.loadingCoilH,
      antennaHeightM: p.antennaHeightM,
      groundResistanceOhm: p.groundResistanceOhm,
      primaryCapacitanceF: p.primaryCapacitanceF,
      sparkVoltageV: p.sparkVoltageV,
      couplingK: p.couplingK,
      weather: p.weather,
      latitude: p.latitude,
      altitudeM: p.altitudeM,
      ...(cp?.primaryInductanceH ? { primaryInductanceH: cp.primaryInductanceH } : {}),
    });

    set({
      preset: id,
      params: { ...engine.params },
      conservativeParams: { ...cEngine.params },
      live: get().mode === "conservative" ? cEngine.toLegacyTelemetry() : engine.telemetry(),
      conservativeLive: cEngine.telemetry(),
      events: [],
      selectedEventId: null,
      pausedBy: null,
      tick: get().tick + 1,
    });
  },
  reset: () => {
    const { mode, engine, conservativeEngine, params, conservativeParams } = get();
    if (mode === "conservative") {
      conservativeEngine.reset({ ...conservativeParams });
      set({
        conservativeLive: conservativeEngine.telemetry(),
        live: conservativeEngine.toLegacyTelemetry(),
        events: [],
        selectedEventId: null,
        pausedBy: null,
        running: false,
        tick: get().tick + 1,
      });
    } else {
      engine.reset({ ...params });
      set({
        live: engine.telemetry(),
        events: [],
        selectedEventId: null,
        pausedBy: null,
        running: false,
        tick: get().tick + 1,
      });
    }
  },
  stepOnce: () => get().advance(1 / 60),
  advance: (dt) => {
    const { mode, engine, conservativeEngine, breakOn } = get();
    if (mode === "conservative") {
      const fired = conservativeEngine.step(dt);
      const hit = fired.find((e) => breakOn[e.type]);
      set({
        conservativeLive: conservativeEngine.lastSnap(),
        live: conservativeEngine.toLegacyTelemetry(),
        events: conservativeEngine.events,
        conservativeParams: { ...conservativeEngine.params },
        tick: get().tick + 1,
        running: hit ? false : get().running,
        pausedBy: hit ? hit.type : get().pausedBy,
        selectedEventId: hit ? hit.id : get().selectedEventId,
      });
      return hit?.type ?? null;
    } else {
      const fired = engine.step(dt);
      const hit = fired.find((e) => breakOn[e.type]);
      set({
        live: engine.lastSnap(),
        events: engine.events,
        params: { ...engine.params, speedMs: engine.speedMs },
        tick: get().tick + 1,
        running: hit ? false : get().running,
        pausedBy: hit ? hit.type : get().pausedBy,
        selectedEventId: hit ? hit.id : get().selectedEventId,
      });
      return hit?.type ?? null;
    }
  },
  selectedEvent: () => {
    const { selectedEventId, events } = get();
    return events.find((e) => e.id === selectedEventId) ?? null;
  },
  dumpWave: () =>
    get().mode === "conservative"
      ? get().conservativeEngine.dumpScope()
      : get().engine.dumpScope(),
  strip: () =>
    get().mode === "conservative"
      ? get().conservativeEngine.strip
      : get().engine.strip,
}));
