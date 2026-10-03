import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function siFormat(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const units = [
    { g: 1e12, s: "T" },
    { g: 1e9, s: "G" },
    { g: 1e6, s: "M" },
    { g: 1e3, s: "k" },
    { g: 1, s: "" },
    { g: 1e-3, s: "m" },
    { g: 1e-6, s: "µ" },
    { g: 1e-9, s: "n" },
    { g: 1e-12, s: "p" },
    { g: 1e-15, s: "f" },
  ];
  const u = units.find((x) => abs >= x.g) ?? units[units.length - 1]!;
  const n = abs / u.g;
  const d = n >= 100 ? 1 : n >= 10 ? 2 : digits;
  return `${sign}${n.toFixed(d)}${u.s}`;
}
