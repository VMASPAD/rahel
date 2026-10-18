/** Deterministic hashing / noise helpers (pure, no Math.random). */

export function hash32(...parts: number[]): number {
  let h = 0x811c9dc5
  for (const x of parts) {
    h ^= Math.floor(x) | 0
    h = Math.imul(h, 0x01000193)
    h ^= h >>> 15
    h = Math.imul(h, 0x85ebca6b)
    h ^= h >>> 13
  }
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

/** Uniform in [0, 1). */
export function u01(...parts: number[]): number {
  return hash32(...parts) / 4294967296
}

/** Standard normal (Box-Muller), deterministic in its arguments. */
export function gauss(...parts: number[]): number {
  const a = Math.max(u01(...parts, 7001), 1e-9)
  const b = u01(...parts, 7002)
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b)
}

export function strSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
export const lerp = (a: number, b: number, w: number) => a + (b - a) * w
export const smooth = (w: number) => {
  const x = clamp(w, 0, 1)
  return x * x * (3 - 2 * x)
}
export const r1 = (n: number) => Math.round(n * 10) / 10
export const r2 = (n: number) => Math.round(n * 100) / 100
