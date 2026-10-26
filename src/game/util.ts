export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = (h ^ (h >> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return h;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export function titleCase(s: string): string {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

export function choice<T>(arr: readonly T[], rnd = Math.random): T {
  return arr[Math.floor(rnd() * arr.length)]!;
}

export function clockLabel(minutes: number): string {
  const total = 6 * 60 + minutes;
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const ap = h24 >= 12 ? "pm" : "am";
  const h = h24 % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}

export const DIRS = {
  n: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
  e: { x: 1, y: 0 },
} as const;
