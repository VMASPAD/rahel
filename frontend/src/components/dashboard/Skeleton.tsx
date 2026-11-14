export function Skeleton({ h = 16, w = '100%', r = 8 }: { h?: number; w?: number | string; r?: number }) {
  return <span className="dx-skel" aria-hidden style={{ height: h, width: w, borderRadius: r }} />
}
