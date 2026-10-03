import { useLab } from "@/lib/lab-store";
import { stabilityOf } from "@/lib/engine/engine";

function n(v: number): number {
  return Math.round(v * 100) / 100;
}

export function Schematic() {
  const mode = useLab((s) => s.mode);
  const live = useLab((s) => s.live);
  const cParams = useLab((s) => s.conservativeParams);
  const spark = live.sparkState > 0;
  const stab = stabilityOf(live.loopGain);
  const glow = Math.min(1, Math.abs(live.V_extra_V) / Math.max(live.V_break_V * 4, 1));
  const quiver = stab === "unstable";
  const rpm = Math.round(live.rpm);

  return (
    <div className="flex h-full min-h-48 flex-col overflow-hidden rounded-lg bg-surface p-3 shadow-[0_0_0_1px_rgba(230,228,220,0.08)] sm:p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-medium tracking-tight">Schematic</h2>
        <p className="truncate font-mono text-xs text-muted">
          {mode === "conservative" ? "Coupled 3-Coil Inductive Circuit" : "787,412 · 462,418"}
        </p>
      </div>
      <svg
        viewBox="0 0 360 220"
        className="h-full w-full grow"
        role="img"
        aria-label="Tesla extra coil, spark gap, earth ground, elevated terminal, and induction motor"
      >
        <ellipse
          cx="180"
          cy="198"
          rx={quiver ? 92 : 88}
          ry="14"
          className={quiver ? "fill-accent/25" : "fill-raised"}
        />
        <text x="180" y="202" textAnchor="middle" className="fill-muted" fontSize="8" fontFamily="IBM Plex Mono, monospace">
          EARTH E
        </text>
        <line x1="180" y1="184" x2="180" y2="148" className="stroke-fg/50" strokeWidth="2" />
        <rect x="172" y="148" width="16" height="10" className="fill-raised stroke-border" />
        <text x="154" y="156" textAnchor="end" className="fill-muted" fontSize="7" fontFamily="IBM Plex Mono, monospace">
          {mode === "conservative"
            ? `Rg ${cParams.groundResistanceOhm.toFixed(1)}Ω`
            : `GRIP ${live.earthGrip.toFixed(2)}`}
        </text>
        <line x1="120" y1="148" x2="240" y2="148" className="stroke-border" strokeWidth="1" />
        <g transform="translate(54 92)">
          <rect x="0" y="8" width="28" height="36" rx="2" className="fill-raised stroke-border" />
          <line x1="6" y1="16" x2="22" y2="16" className="stroke-fg/70" />
          <line x1="6" y1="22" x2="22" y2="22" className="stroke-fg/70" />
          <line x1="6" y1="28" x2="22" y2="28" className="stroke-fg/70" />
          <line x1="14" y1="44" x2="14" y2="56" className="stroke-fg/50" strokeWidth="1.5" />
          <text x="14" y="6" textAnchor="middle" className="fill-muted" fontSize="7" fontFamily="IBM Plex Mono, monospace">
            C
          </text>
        </g>
        <g transform="translate(102 108)">
          <line x1="0" y1="0" x2="16" y2="0" className="stroke-fg/60" />
          <line x1="16" y1="-8" x2="16" y2="8" className="stroke-fg/80" strokeWidth="2" />
          <line
            x1="24"
            y1="-8"
            x2="24"
            y2="8"
            className={spark ? "stroke-accent" : "stroke-fg/80"}
            strokeWidth="2"
          />
          <line x1="24" y1="0" x2="40" y2="0" className="stroke-fg/60" />
          {spark ? (
            <path d="M18 -2 L22 2 L20 -6 L26 4" className="spark-flash fill-none stroke-accent" strokeWidth="1.5" />
          ) : null}
          <text x="20" y="20" textAnchor="middle" className="fill-muted" fontSize="7" fontFamily="IBM Plex Mono, monospace">
            SPARK
          </text>
        </g>
        <g transform="translate(168 38)">
          <rect
            x="0"
            y="0"
            width="24"
            height="106"
            rx="12"
            className="stroke-accent/80 fill-raised"
            strokeWidth="1.5"
            opacity={0.35 + glow * 0.65}
          />
          {Array.from({ length: 9 }).map((_, i) => (
            <ellipse
              key={i}
              cx="12"
              cy={10 + i * 10}
              rx="10"
              ry="3.2"
              className="fill-none stroke-accent"
              strokeWidth="1.1"
              opacity={0.4 + glow * 0.6}
            />
          ))}
          <text x="12" y="-6" textAnchor="middle" className="fill-muted" fontSize="7" fontFamily="IBM Plex Mono, monospace">
            EXTRA B
          </text>
        </g>
        <line x1="180" y1="38" x2="180" y2="18" className="stroke-fg/50" strokeWidth="1.5" />
        <circle cx="180" cy="14" r="8" className="fill-raised stroke-fg/70" />
        <text x="196" y="17" className="fill-muted" fontSize="7" fontFamily="IBM Plex Mono, monospace">
          D
        </text>
        <g transform="translate(268 118)">
          <circle cx="22" cy="22" r="22" className="fill-raised stroke-border" />
          <circle cx="22" cy="22" r="6" className="fill-bg stroke-accent" />
          {[0, 60, 120, 180, 240, 300].map((a) => {
            const r = ((a + rpm * 3) * Math.PI) / 180;
            return (
              <line
                key={a}
                x1={n(22 + Math.cos(r) * 8)}
                y1={n(22 + Math.sin(r) * 8)}
                x2={n(22 + Math.cos(r) * 18)}
                y2={n(22 + Math.sin(r) * 18)}
                className="stroke-fg/70"
                strokeWidth="1.5"
              />
            );
          })}
          <text x="22" y="56" textAnchor="middle" className="fill-muted" fontSize="7" fontFamily="IBM Plex Mono, monospace">
            MOTOR
          </text>
        </g>
        <path
          d="M300 96 h28 v44 h-12 v-18 h-16 z"
          className="fill-none stroke-fg/40"
          strokeWidth="1.2"
        />
        <circle cx="312" cy="144" r="5" className="fill-none stroke-fg/40" />
        <circle cx="324" cy="144" r="5" className="fill-none stroke-fg/40" />
      </svg>
    </div>
  );
}
