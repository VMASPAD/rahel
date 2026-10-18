export function EstTag({ info }: { info: { sampleCount: number; confidence: 'low' | 'medium' } }) {
  return (
    <span
      className="est-tag"
      tabIndex={0}
      title={`Estimated from the watch history (${info.sampleCount} samples, ${info.confidence === 'low' ? 'low' : 'medium'} confidence). Not a direct measurement.`}
    >
      est.
    </span>
  )
}
