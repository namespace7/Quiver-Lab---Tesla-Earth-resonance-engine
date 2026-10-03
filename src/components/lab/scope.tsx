import { useLab } from "@/lib/lab-store";

function polyline(
  wave: { t: number; vCap: number; vExtra: number; iExtra: number }[],
  key: "vCap" | "vExtra" | "iExtra",
  scale: number,
  maxV: number,
  w: number,
  h: number,
): string {
  if (wave.length < 2) return "";
  return wave
    .map((s, i) => {
      const x = (i / (wave.length - 1)) * w;
      const y = h / 2 - ((s[key] * scale) / maxV) * (h * 0.42);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function Grid({ w, h }: { w: number; h: number }) {
  const xs = [];
  const ys = [];
  for (let x = 0; x <= w; x += 32) xs.push(x);
  for (let y = 0; y <= h; y += 28) ys.push(y);
  return (
    <g className="stroke-fg/10" strokeWidth="1">
      {xs.map((x) => (
        <line key={`x${x}`} x1={x} y1={0} x2={x} y2={h} />
      ))}
      {ys.map((y) => (
        <line key={`y${y}`} x1={0} y1={y} x2={w} y2={y} />
      ))}
    </g>
  );
}

export function Scope() {
  const mode = useLab((s) => s.mode);
  const tick = useLab((s) => s.tick);
  const dump = useLab((s) => s.dumpWave());
  const liveWave = useLab((s) =>
    s.mode === "conservative" ? s.conservativeEngine.wave : s.engine.wave,
  );
  const strip = useLab((s) => s.strip());
  void tick;

  const wave = dump.length ? dump : liveWave;
  const maxV = Math.max(
    1,
    ...wave.map((s) => Math.max(Math.abs(s.vCap), Math.abs(s.vExtra) * 0.15, Math.abs(s.iExtra) * 40)),
  );
  const w = 640;
  const h1 = 160;
  const h2 = 80;
  const maxG = Math.max(1.2, ...strip.map((s) => s.gain), 0);

  const gainLine = strip
    .map((s, i) => {
      const x = strip.length < 2 ? 0 : (i / (strip.length - 1)) * w;
      const y = h2 - (s.gain / maxG) * (h2 - 10) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const unityY = h2 - (1 / maxG) * (h2 - 10) - 4;

  return (
    <div className="flex min-h-48 flex-col gap-2 rounded-lg bg-surface p-3 shadow-[0_0_0_1px_rgba(230,228,220,0.08)] sm:p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-medium tracking-tight">Scope</h2>
        <p className="font-mono text-xs text-muted">dump · gain strip</p>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h1}`}
        className="h-36 w-full rounded-md bg-scope sm:h-40"
        aria-label="Dump-triggered oscilloscope"
      >
        <Grid w={w} h={h1} />
        {wave.length > 1 ? (
          <>
            <polyline
              fill="none"
              className="stroke-accent"
              strokeWidth="1.6"
              points={polyline(wave, "vCap", 1, maxV, w, h1)}
            />
            <polyline
              fill="none"
              className="stroke-fg/80"
              strokeWidth="1.4"
              points={polyline(wave, "vExtra", 0.15, maxV, w, h1)}
            />
            <polyline
              fill="none"
              className="stroke-warn/80"
              strokeWidth="1.3"
              points={polyline(wave, "iExtra", 40, maxV, w, h1)}
            />
          </>
        ) : null}
        <text x="12" y="18" className="fill-muted" fontSize="12" fontFamily="IBM Plex Mono, monospace">
          {dump.length ? "DUMP  Vcap  Vx  I" : "LIVE  Vcap  Vx  I"}
        </text>
      </svg>
      <svg
        viewBox={`0 0 ${w} ${h2}`}
        className="h-20 w-full rounded-md bg-scope"
        aria-label="Loop gain strip chart"
      >
        <Grid w={w} h={h2} />
        <line x1="0" y1={unityY} x2={w} y2={unityY} className="stroke-fg/20" />
        {strip.length > 1 ? (
          <polyline fill="none" className="stroke-accent" strokeWidth="1.6" points={gainLine} />
        ) : null}
        <text x="12" y="16" className="fill-muted" fontSize="12" fontFamily="IBM Plex Mono, monospace">
          LOOP GAIN  unity
        </text>
      </svg>
    </div>
  );
}
